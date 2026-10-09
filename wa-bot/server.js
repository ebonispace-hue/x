/* =====================================================
   EBONI SPACE — BOT WHATSAPP (tidak resmi, via WhatsApp Web)
   Cara kerja:
   - Panel menulis pesan ke Firebase: waOutbox/{id} = {phone, text, status:"pending"}
   - Bot ini membaca antrian itu, mengirim lewat WhatsApp, lalu menandai "sent"/"failed"
   - Bot menulis status online ke waBot/status supaya panel tahu bot hidup
   - Follow-up dari panel (source "followup"): bisa pakai gambar
     (waBroadcastMedia/{broadcastId}), dikirim lebih pelan, dibatasi per hari;
     sisanya otomatis dilanjut hari berikutnya
   - Pelanggan yang membalas STOP dicatat di waOptOut/{nomor}, tidak dikirimi follow-up lagi
   - Bot TIDAK PERNAH mengirim pesan sendiri: hanya pesan di antrian yang
     bertanda klik:true (dibuat saat pemilik menekan tombol kirim di panel).
     Balasan STOP/MULAI hanya dicatat, tidak dibalas otomatis.
   Tidak ada endpoint kirim pesan yang terbuka ke publik.

   Pengaturan lewat environment variable (hPanel > Node.js > Environment):
   - ADMIN_KEY   : kata sandi untuk membuka halaman QR (wajib diganti!)
   - PORT        : diisi otomatis oleh Hostinger
===================================================== */
"use strict";

const http = require("http");
const path = require("path");
const fs = require("fs");
const QRCode = require("qrcode");
const pino = require("pino");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers
} = require("@whiskeysockets/baileys");

const { initializeApp } = require("firebase/app");
const {
  getDatabase, ref, onChildAdded, update, get, set, runTransaction,
  query, orderByChild, startAt, onValue
} = require("firebase/database");

/* ---------- konfigurasi ---------- */
const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = process.env.ADMIN_KEY || "ganti-kata-sandi-ini";
// Nomor WA bot (format 628xxx). Kalau diisi, bot memakai KODE PAIRING (tanpa scan QR) —
// cocok kalau bot jalan di HP yang sama dengan WhatsApp nomor bot.
const BOT_NUMBER = String(process.env.BOT_NUMBER || "").replace(/\D/g, "").replace(/^0/, "62");
const AUTH_DIR = path.join(__dirname, "auth");

const MAX_PER_NOMOR_PER_HARI = 4;      // anti-spam
const JEDA_MIN_MS = 4000;              // jeda antar pesan (acak 4–9 detik)
const JEDA_MAX_MS = 9000;
const UMUR_MAKS_PESAN_MS = 24 * 3600 * 1000;  // pesan lebih tua dari 24 jam tidak dikirim

// Follow-up massal: lebih pelan & dibatasi per hari supaya nomor bot tidak diblokir
const FOLLOWUP_PER_HARI = Math.max(1, Number(process.env.FOLLOWUP_PER_HARI || 50));
const JEDA_FU_MIN_MS = 30000;          // jeda antar follow-up (acak 30–75 detik)
const JEDA_FU_MAX_MS = 75000;
const UMUR_MAKS_FOLLOWUP_MS = 7 * 24 * 3600 * 1000;  // follow-up boleh menunggu sampai 7 hari

const firebaseConfig = {
  apiKey: "AIzaSyCWl_SOWyPuXUETZzXkGC8Cm_WhdqXTATg",
  authDomain: "ggyu-66f09.firebaseapp.com",
  databaseURL: "https://ggyu-66f09-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ggyu-66f09",
  storageBucket: "ggyu-66f09.firebasestorage.app",
  messagingSenderId: "108449585539",
  appId: "1:108449585539:web:8dcfec087d7eddf5c83eb6"
};

const logger = pino({ level: "warn" });
const db = getDatabase(initializeApp(firebaseConfig));

/* ---------- state ---------- */
let sock = null;
let connected = false;
let lastQr = "";
let pairingCode = "";
let myNumber = "";
let knownCustomers = new Set();
const queue = [];
let deferred = [];    // follow-up yang menunggu kuota hari berikutnya
let processing = false;
const sentLog = {};   // phone -> [timestamps]
let optOut = {};      // phone -> {at}
let kuotaPenuhTanggal = "";
const mediaCache = new Map();

function log() {
  const args = Array.prototype.slice.call(arguments);
  console.log.apply(console, [new Date().toISOString()].concat(args));
}

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function normalizePhone(text) {
  const m = String(text || "").match(/[+\d][\d\s\-‐-―.]{6,}/);
  if (!m) return "";
  let d = m[0].replace(/\D/g, "");
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  return d.length >= 10 && d.length <= 15 ? d : "";
}

/* ---------- daftar pelanggan (hanya nomor yang pernah sewa yang boleh dikirimi) ---------- */
async function refreshCustomers() {
  try {
    const snap = await get(ref(db, "rentals"));
    const set_ = new Set();
    snap.forEach(function(child) {
      const p = normalizePhone((child.val() || {}).nomorPenyewa);
      if (p) set_.add(p);
    });
    // nomor pelanggan lama yang ditambah manual dari panel (menu Promo)
    const manual = await get(ref(db, "waContacts"));
    manual.forEach(function(child) {
      const p = normalizePhone(child.key);
      if (p) set_.add(p);
    });
    knownCustomers = set_;
  } catch (e) {
    log("Gagal ambil daftar pelanggan:", e.message);
  }
}

/* ---------- status bot untuk panel ---------- */
async function heartbeat() {
  try {
    await set(ref(db, "waBot/status"), {
      online: connected,
      number: myNumber || "",
      lastSeen: Date.now(),
      needQr: !connected && !!lastQr,
      followupCap: FOLLOWUP_PER_HARI,
      followupDeferred: deferred.length
    });
  } catch (e) {
    log("Heartbeat gagal:", e.message);
  }
}

/* ---------- koneksi WhatsApp ---------- */
async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(function() { return { version: undefined }; });

  sock = makeWASocket({
    version: version,
    auth: state,
    logger: logger,
    // Kode pairing hanya diterima WhatsApp kalau nama browser-nya standar
    browser: Browsers.ubuntu("Chrome"),
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("messages.upsert", tanganiPesanMasuk);

  let pairingRequested = false;
  const thisSock = sock;

  async function mintaKodePairing() {
    pairingRequested = true;
    try {
      const code = await thisSock.requestPairingCode(BOT_NUMBER);
      const rapi = code.length === 8 ? code.slice(0, 4) + "-" + code.slice(4) : code;
      pairingCode = rapi;
      const jam = new Date().toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta" });
      console.log("\n==============================");
      console.log(" KODE PAIRING (" + jam + "): " + rapi);
      console.log(" Masukkan SEGERA (berlaku ±1 menit).");
      console.log(" Kalau muncul kode baru, kode lama TIDAK berlaku.");
      console.log(" WhatsApp nomor bot > Perangkat tertaut > Tautkan perangkat");
      console.log(" > Tautkan dengan nomor telepon saja > masukkan kode di atas");
      console.log("==============================\n");
    } catch (e) {
      log("Gagal minta kode pairing:", e.message);
    }
  }

  sock.ev.on("connection.update", function(u) {
    // minta kode pairing sekali per koneksi, setelah koneksi ke WhatsApp siap
    if (u.qr && BOT_NUMBER && !state.creds.registered && !pairingRequested) {
      mintaKodePairing();
    }

    if (u.qr) {
      lastQr = u.qr;
      if (!BOT_NUMBER) log("QR baru tersedia di /qr?key=...");
      heartbeat();
    }

    if (u.connection === "open") {
      connected = true;
      lastQr = "";
      pairingCode = "";
      myNumber = ((sock.user && sock.user.id) || "").split(":")[0].split("@")[0];
      log("WhatsApp tersambung sebagai", myNumber);
      heartbeat();
      processQueue();
    }

    if (u.connection === "close") {
      connected = false;
      heartbeat();
      const code = u.lastDisconnect && u.lastDisconnect.error &&
        u.lastDisconnect.error.output && u.lastDisconnect.error.output.statusCode;

      if (code === DisconnectReason.loggedOut) {
        log("Logout dari WhatsApp. Hapus folder auth & scan QR ulang.");
        try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch (e) {}
        setTimeout(startWhatsApp, 3000);
      } else {
        log("Koneksi terputus (kode " + code + "), sambung ulang 5 detik lagi...");
        setTimeout(startWhatsApp, 5000);
      }
    }
  });
}

/* ---------- antrian pesan ---------- */
function bolehKirim(phone) {
  const now = Date.now();
  const list = (sentLog[phone] || []).filter(function(t) { return now - t < 24 * 3600 * 1000; });
  sentLog[phone] = list;
  return list.length < MAX_PER_NOMOR_PER_HARI;
}

async function tandai(id, data) {
  try { await update(ref(db, "waOutbox/" + id), data); } catch (e) { log("Gagal update status", id, e.message); }
}

function hariIni() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });
}

/* ambil 1 jatah follow-up hari ini; false kalau kuota sudah habis */
async function ambilKuotaFollowup() {
  const tgl = hariIni();
  if (kuotaPenuhTanggal === tgl) return false;
  const r = await runTransaction(ref(db, "waBot/followupHarian/" + tgl), function(cur) {
    const n = Number(cur || 0);
    return n < FOLLOWUP_PER_HARI ? n + 1 : undefined;
  });
  if (!r.committed) {
    kuotaPenuhTanggal = tgl;
    log("Kuota follow-up hari ini (" + FOLLOWUP_PER_HARI + ") habis, sisanya dilanjut besok.");
    return false;
  }
  return true;
}

/* gambar follow-up (disimpan sekali per broadcast) */
async function ambilMedia(bid) {
  if (mediaCache.has(bid)) return mediaCache.get(bid);
  let out = null;
  try {
    const snap = await get(ref(db, "waBroadcastMedia/" + bid));
    const v = snap.val() || {};
    const m = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(String(v.image || ""));
    if (m) out = { buffer: Buffer.from(m[2], "base64"), mimetype: m[1], thumb: String(v.thumb || "") };
  } catch (e) {
    log("Gagal ambil gambar", bid, e.message);
    return null;   // jangan di-cache, coba lagi nanti
  }
  mediaCache.set(bid, out);
  if (mediaCache.size > 5) mediaCache.delete(mediaCache.keys().next().value);
  return out;
}

/* hasil: "sent" | "failed" | "skip" | "deferred" */
async function kirimSatu(item) {
  const id = item.id;
  const followup = item.source === "followup";

  // kunci pesan supaya tidak terkirim dua kali
  const lock = await runTransaction(ref(db, "waOutbox/" + id + "/status"), function(cur) {
    return cur === "pending" ? "sending" : undefined;
  });
  if (!lock.committed) return "skip";

  const gagal = async function(error) {
    await tandai(id, { status: "failed", error: error, doneAt: Date.now() });
    return "skip";
  };

  const phone = normalizePhone(item.phone);
  const text = String(item.text || "").slice(0, item.hasImage ? 1024 : 2000);

  if (item.klik !== true) return gagal("ditolak: bukan dari tombol kirim di panel");
  if (!phone || !text) return gagal("nomor/pesan kosong");
  const umurMaks = followup ? UMUR_MAKS_FOLLOWUP_MS : UMUR_MAKS_PESAN_MS;
  if (Date.now() - Number(item.createdAt || 0) > umurMaks) return gagal("pesan kedaluwarsa");

  if (!knownCustomers.has(phone)) await refreshCustomers();
  if (!knownCustomers.has(phone)) return gagal("nomor bukan pelanggan");
  if (followup && optOut[phone]) return gagal("pelanggan minta STOP");
  if (!bolehKirim(phone)) return gagal("batas pesan harian nomor ini");

  if (followup && !(await ambilKuotaFollowup())) {
    await tandai(id, { status: "pending" });
    deferred.push(item);
    return "deferred";
  }

  let content = { text: text };
  if (item.hasImage && item.broadcastId) {
    const media = await ambilMedia(item.broadcastId);
    if (!media) return gagal("gambar follow-up tidak ditemukan");
    content = { image: media.buffer, caption: text, mimetype: media.mimetype };
    if (media.thumb) content.jpegThumbnail = media.thumb;
  }

  try {
    const cek = await sock.onWhatsApp(phone);
    if (!cek || !cek[0] || !cek[0].exists) return gagal("nomor tidak terdaftar di WhatsApp");

    const jid = cek[0].jid;
    await sock.presenceSubscribe(jid).catch(function() {});
    await sock.sendPresenceUpdate("composing", jid).catch(function() {});
    await sleep(1500 + Math.random() * 2000);
    await sock.sendMessage(jid, content);
    await sock.sendPresenceUpdate("paused", jid).catch(function() {});

    (sentLog[phone] = sentLog[phone] || []).push(Date.now());
    log("Terkirim ke", phone, "(" + id + (followup ? ", follow-up" : "") + ")");
    await tandai(id, { status: "sent", doneAt: Date.now(), error: null });
    return "sent";
  } catch (e) {
    log("Gagal kirim ke", phone, e.message);
    await tandai(id, { status: "failed", error: String(e.message || e).slice(0, 200), doneAt: Date.now() });
    return "failed";
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    while (queue.length && connected) {
      const item = queue.shift();
      const hasil = await kirimSatu(item);
      if (hasil !== "sent" && hasil !== "failed") continue;   // tidak ada pesan keluar: langsung lanjut
      const fu = item.source === "followup";
      const min = fu ? JEDA_FU_MIN_MS : JEDA_MIN_MS;
      const max = fu ? JEDA_FU_MAX_MS : JEDA_MAX_MS;
      await sleep(min + Math.random() * (max - min));
    }
  } finally {
    processing = false;
  }
}

/* follow-up yang tertunda dicoba lagi setelah ganti hari */
function cekTertunda() {
  if (!deferred.length || kuotaPenuhTanggal === hariIni()) return;
  const items = deferred;
  deferred = [];
  items.forEach(function(it) { queue.push(it); });
  log("Lanjut kirim " + items.length + " follow-up yang tertunda.");
  processQueue();
}

function watchOutbox() {
  const since = Date.now() - UMUR_MAKS_FOLLOWUP_MS;
  const q = query(ref(db, "waOutbox"), orderByChild("createdAt"), startAt(since));

  onChildAdded(q, function(snap) {
    const item = snap.val() || {};
    if (item.status !== "pending") return;
    item.id = snap.key;
    queue.push(item);
    processQueue();
  });
}

function watchOptOut() {
  onValue(ref(db, "waOptOut"), function(snap) {
    optOut = snap.val() || {};
  });
}

/* ---------- pesan masuk: STOP / MULAI ---------- */
function nomorDariKey(key) {
  const calon = [key.remoteJid, key.senderPn, key.participantPn];
  for (let i = 0; i < calon.length; i++) {
    const j = String(calon[i] || "");
    if (j.endsWith("@s.whatsapp.net")) return j.split("@")[0].split(":")[0];
  }
  return "";
}

async function tanganiPesanMasuk(ev) {
  if (!ev || ev.type !== "notify") return;
  for (const m of ev.messages || []) {
    try {
      if (!m.key || m.key.fromMe) continue;
      const jid = String(m.key.remoteJid || "");
      if (jid.endsWith("@g.us") || jid === "status@broadcast" || jid.endsWith("@newsletter")) continue;

      const msg = m.message || {};
      const text = String(msg.conversation || (msg.extendedTextMessage && msg.extendedTextMessage.text) || "")
        .trim().toLowerCase().replace(/[.!]+$/, "");

      const stop = /^(stop|berhenti|unsubscribe|unsub)$/.test(text);
      const mulai = /^(mulai|start)$/.test(text);
      if (!stop && !mulai) continue;

      const phone = nomorDariKey(m.key);
      if (!phone) {
        log("Pesan " + text.toUpperCase() + " masuk, tapi nomor pengirim tidak terbaca (" + jid + ")");
        continue;
      }

      if (stop) {
        // hanya dicatat, tidak dibalas otomatis
        await set(ref(db, "waOptOut/" + phone), { at: Date.now(), text: text });
        log("Opt-out STOP dari", phone);
      } else if (optOut[phone]) {
        await set(ref(db, "waOptOut/" + phone), null);
        log("Opt-in MULAI dari", phone);
      }
    } catch (e) {
      log("Gagal proses pesan masuk:", e.message);
    }
  }
}

/* ---------- halaman web kecil: /health, /qr ---------- */
const server = http.createServer(async function(req, res) {
  const url = new URL(req.url, "http://localhost");

  if (url.pathname === "/" || url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, whatsapp: connected ? "online" : "offline", queue: queue.length }));
    return;
  }

  if (url.pathname === "/qr") {
    if (url.searchParams.get("key") !== ADMIN_KEY) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Kunci salah.");
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });

    if (connected) {
      res.end('<meta name="viewport" content="width=device-width"><body style="font-family:sans-serif;padding:24px">' +
        "<h2>✅ Bot sudah tersambung</h2><p>Nomor: " + myNumber + "</p></body>");
      return;
    }

    if (pairingCode) {
      res.end('<meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="15">' +
        '<body style="font-family:sans-serif;padding:24px;text-align:center"><h2>Kode pairing</h2>' +
        '<p style="font-size:34px;letter-spacing:4px"><b>' + pairingCode + '</b></p>' +
        "<p>WhatsApp nomor bot → Perangkat tertaut → Tautkan perangkat → <b>Tautkan dengan nomor telepon saja</b></p></body>");
      return;
    }

    if (!lastQr) {
      res.end('<meta http-equiv="refresh" content="3"><body style="font-family:sans-serif;padding:24px">Menunggu QR... (halaman akan muat ulang)</body>');
      return;
    }

    const img = await QRCode.toDataURL(lastQr, { width: 320, margin: 2 });
    res.end('<meta name="viewport" content="width=device-width"><meta http-equiv="refresh" content="20">' +
      '<body style="font-family:sans-serif;padding:24px;text-align:center">' +
      "<h2>Scan dengan WhatsApp nomor bot</h2>" +
      "<p>WhatsApp → Perangkat tertaut → Tautkan perangkat</p>" +
      '<img src="' + img + '" alt="QR"><p><small>QR berganti tiap ±20 detik, halaman muat ulang otomatis.</small></p></body>');
    return;
  }

  res.writeHead(404);
  res.end();
});

/* ---------- mulai ---------- */
server.listen(PORT, function() {
  log("Server bot jalan di port", PORT);
});

refreshCustomers();
setInterval(refreshCustomers, 10 * 60 * 1000);
setInterval(heartbeat, 60 * 1000);
setInterval(cekTertunda, 15 * 60 * 1000);
watchOptOut();
watchOutbox();
startWhatsApp().catch(function(e) {
  log("Gagal start WhatsApp:", e.message);
});

process.on("unhandledRejection", function(e) { log("unhandledRejection:", e && e.message); });
