/* =====================================================
   EBONI SPACE — BOT WHATSAPP (tidak resmi, via WhatsApp Web)
   Cara kerja:
   - Panel menulis pesan ke Firebase: waOutbox/{id} = {phone, text, status:"pending"}
   - Bot ini membaca antrian itu, mengirim lewat WhatsApp, lalu menandai "sent"/"failed"
   - Bot menulis status online ke waBot/status supaya panel tahu bot hidup
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
  query, orderByChild, startAt
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
let processing = false;
const sentLog = {};   // phone -> [timestamps]

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
      needQr: !connected && !!lastQr
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

async function kirimSatu(item) {
  const id = item.id;

  // kunci pesan supaya tidak terkirim dua kali
  const lock = await runTransaction(ref(db, "waOutbox/" + id + "/status"), function(cur) {
    return cur === "pending" ? "sending" : undefined;
  });
  if (!lock.committed) return;

  const phone = normalizePhone(item.phone);
  const text = String(item.text || "").slice(0, 2000);

  if (!phone || !text) return tandai(id, { status: "failed", error: "nomor/pesan kosong", doneAt: Date.now() });
  if (Date.now() - Number(item.createdAt || 0) > UMUR_MAKS_PESAN_MS) {
    return tandai(id, { status: "failed", error: "pesan kedaluwarsa", doneAt: Date.now() });
  }

  if (!knownCustomers.has(phone)) await refreshCustomers();
  if (!knownCustomers.has(phone)) {
    return tandai(id, { status: "failed", error: "nomor bukan pelanggan", doneAt: Date.now() });
  }
  if (!bolehKirim(phone)) {
    return tandai(id, { status: "failed", error: "batas pesan harian nomor ini", doneAt: Date.now() });
  }

  try {
    const cek = await sock.onWhatsApp(phone);
    if (!cek || !cek[0] || !cek[0].exists) {
      return tandai(id, { status: "failed", error: "nomor tidak terdaftar di WhatsApp", doneAt: Date.now() });
    }

    const jid = cek[0].jid;
    await sock.presenceSubscribe(jid).catch(function() {});
    await sock.sendPresenceUpdate("composing", jid).catch(function() {});
    await sleep(1500 + Math.random() * 2000);
    await sock.sendMessage(jid, { text: text });
    await sock.sendPresenceUpdate("paused", jid).catch(function() {});

    (sentLog[phone] = sentLog[phone] || []).push(Date.now());
    log("Terkirim ke", phone, "(" + id + ")");
    await tandai(id, { status: "sent", doneAt: Date.now(), error: null });
  } catch (e) {
    log("Gagal kirim ke", phone, e.message);
    await tandai(id, { status: "failed", error: String(e.message || e).slice(0, 200), doneAt: Date.now() });
  }
}

async function processQueue() {
  if (processing) return;
  processing = true;

  try {
    while (queue.length && connected) {
      const item = queue.shift();
      await kirimSatu(item);
      await sleep(JEDA_MIN_MS + Math.random() * (JEDA_MAX_MS - JEDA_MIN_MS));
    }
  } finally {
    processing = false;
  }
}

function watchOutbox() {
  const since = Date.now() - UMUR_MAKS_PESAN_MS;
  const q = query(ref(db, "waOutbox"), orderByChild("createdAt"), startAt(since));

  onChildAdded(q, function(snap) {
    const item = snap.val() || {};
    if (item.status !== "pending") return;
    item.id = snap.key;
    queue.push(item);
    processQueue();
  });
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
watchOutbox();
startWhatsApp().catch(function(e) {
  log("Gagal start WhatsApp:", e.message);
});

process.on("unhandledRejection", function(e) { log("unhandledRejection:", e && e.message); });
