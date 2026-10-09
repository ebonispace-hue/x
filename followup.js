/* =====================================================
   INFO PROMO WA KE SEMUA PELANGGAN
   - Daftar pelanggan diambil dari semua data sewa (sejak awal)
   - Pesan & gambar diatur sendiri dari panel
   - Pesan masuk antrian Firebase: waOutbox/{id} (source: "followup")
     gambar disimpan sekali di waBroadcastMedia/{broadcastId}
   - Bot mengirim pelan-pelan (jeda acak) dengan batas per hari,
     sisanya otomatis dilanjut hari berikutnya.
   - Nomor pelanggan lama bisa ditambah manual: waContacts/{nomor}
     (ikut masuk daftar "pernah sewa", dan bot boleh mengirim ke nomor ini)
   - Pelanggan yang membalas STOP tercatat di waOptOut/{nomor}
     dan tidak akan dikirimi lagi.
===================================================== */
(function() {
  "use strict";

  const DRAFT_KEY = "eboni-followup-draft";
  // catatan tetap di setiap pesan: nomor bot hanya untuk pesan otomatis
  const WA_NOTE = "\n\n📌 _Nomor ini khusus pesan otomatis dari Eboni Space. Untuk tanya & booking, chat WA utama kami ya Kak: 0878-1654-6467 (wa.me/6287816546467)_";
  const STOP_FOOTER = "\n_Balas STOP kalau tidak mau menerima info promo lagi._";
  const DEFAULT_TEXT = [
    "Halo Kak 👋",
    "Ada promo seru dari *Eboni Space* nih 🎮🔥",
    "",
    "🎁 *Level Up Rewards*: setiap total sewa 72 jam, dapat *GRATIS 6 jam* main. Semua durasi sewa dihitung!",
    "🕹️ *Mabar Puas 200rb*: langsung dihitung 48 jam, tinggal sedikit lagi dapat jam gratis",
    "🚚 Antar-jemput *GRATIS* sampai rumah (radius 7 km Cileungsi & Gunung Putri), tinggal colok dan main",
    "",
    "Yuk booking sekarang 🙏"
  ].join("\n");
  // contoh pesan lama: kalau draf masih sama persis, otomatis diganti contoh baru
  const OLD_DEFAULT_BODY = "Lama nggak main PS bareng *Eboni Space* nih 🎮\n\nWeekend ini mau sewa PS4 lagi? Antar-jemput gratis sampai rumah, tinggal colok dan main.";
  const DAY = 24 * 3600 * 1000;
  const IMG_MAX_SIDE = 1280;
  const IMG_MAX_BYTES = 450 * 1024;

  let started = false;
  let optOut = {};
  let contacts = {};        // nomor pelanggan lama yang ditambah manual
  let contactsLoaded = false;
  let outbox = [];          // isi waOutbox 30 hari terakhir (tanpa gambar)
  let broadcasts = [];
  let botStatus = null;
  let selected = {};
  let selectionInit = false;
  let imageData = "";
  let thumbData = "";
  let sending = false;

  const $id = function(id) { return document.getElementById(id); };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function normalizePhone(text) {
    const match = String(text || "").match(/[+\d][\d\s\-‐-―.]{6,}/);
    if (!match) return "";
    let digits = match[0].replace(/\D/g, "");
    if (digits.indexOf("0") === 0) digits = "62" + digits.slice(1);
    else if (digits.indexOf("8") === 0) digits = "62" + digits;
    return digits.length >= 10 && digits.length <= 15 ? digits : "";
  }

  function nameFrom(text) {
    const s = String(text || "");
    const inParen = s.match(/\(([^)]+)\)/);
    if (inParen) return inParen[1].trim();
    return s.replace(/[+\d\s\-‐-―.‪-‮]+/, "").trim();
  }

  function prettyPhone(digits) { return digits ? "0" + digits.slice(2) : "-"; }

  function daysAgo(t) {
    if (!t) return "-";
    const d = Math.floor((Date.now() - t) / DAY);
    if (d <= 0) return "hari ini";
    if (d === 1) return "kemarin";
    return d + " hari lalu";
  }

  function role() {
    try { return (currentUser && currentUser.role) || "Admin"; } catch (e) { return "Admin"; }
  }

  function toast(msg) {
    let el = $id("loyaltyToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "loyaltyToast";
      el.className = "loyalty-toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(el.__t);
    el.__t = setTimeout(function() { el.classList.remove("show"); }, 3500);
  }

  /* ---------- data pelanggan ---------- */
  function customers() {
    let list = [];
    try { list = Array.isArray(allRentals) ? allRentals : []; } catch (e) { list = []; }

    const map = {};
    list.forEach(function(r) {
      const phone = normalizePhone(r.nomorPenyewa);
      if (!phone) return;
      const t = Number(r.createdAt || 0);
      const c = map[phone] || (map[phone] = { phone: phone, name: "", count: 0, lastAt: 0 });
      c.count += 1;
      if (t >= c.lastAt) {
        c.lastAt = t;
        const nm = nameFrom(r.nomorPenyewa);
        if (nm) c.name = nm;
      }
    });

    Object.keys(contacts).forEach(function(p) {
      const k = contacts[p] || {};
      const c = map[p] || (map[p] = { phone: p, name: "", count: 0, lastAt: 0 });
      c.manual = true;
      if (!c.name && k.name) c.name = k.name;
      const t = Number(k.lastSewa || 0);
      if (t > c.lastAt) c.lastAt = t;
    });

    const lastFu = {};
    outbox.forEach(function(m) {
      if (m.source !== "followup" || m.status !== "sent") return;
      const p = normalizePhone(m.phone);
      const t = Number(m.doneAt || m.createdAt || 0);
      if (p && t > (lastFu[p] || 0)) lastFu[p] = t;
    });

    return Object.keys(map).map(function(p) {
      const c = map[p];
      c.optOut = !!optOut[p];
      c.lastFollowup = lastFu[p] || 0;
      return c;
    }).sort(function(a, b) { return b.lastAt - a.lastAt; });
  }

  /* ---------- tambah nomor manual ---------- */
  function parseNumbers(raw) {
    const out = [];
    const bad = [];
    String(raw || "").split(/[\n,;]+/).forEach(function(line) {
      line = line.trim();
      if (!line) return;
      const phone = normalizePhone(line);
      if (!phone) { bad.push(line); return; }
      const name = line.replace(/[+\d\s\-‐-―.()]+/, " ").replace(/[()]/g, "").trim();
      out.push({ phone: phone, name: name });
    });
    return { list: out, bad: bad };
  }

  function addContacts() {
    const input = $id("fuManualNumbers");
    const result = $id("fuManualResult");
    const parsed = parseNumbers(input.value);
    if (!parsed.list.length) {
      result.textContent = parsed.bad.length ? "Nomor tidak terbaca. Contoh: 0812 3456 7890 Budi" : "Isi nomor dulu.";
      return;
    }

    const dateVal = ($id("fuManualDate") || {}).value || "";
    const lastSewa = dateVal ? Date.parse(dateVal + "T12:00:00+07:00") : 0;
    const known = {};
    customers().forEach(function(c) { known[c.phone] = true; });

    const updates = {};
    let baru = 0;
    let ada = 0;
    const seen = {};
    parsed.list.forEach(function(it) {
      if (seen[it.phone]) return;
      seen[it.phone] = true;
      const old = contacts[it.phone];
      if (known[it.phone]) {
        ada += 1;
        if (!old) return;   // sudah tercatat dari data sewa, tidak perlu disimpan lagi
      } else {
        baru += 1;
      }
      const rec = { addedAt: Date.now(), addedBy: role() };
      if (it.name) rec.name = it.name.slice(0, 60);
      if (lastSewa) rec.lastSewa = lastSewa;
      if (old) {
        if (it.name) updates["waContacts/" + it.phone + "/name"] = rec.name;
        if (lastSewa) updates["waContacts/" + it.phone + "/lastSewa"] = lastSewa;
      } else {
        updates["waContacts/" + it.phone] = rec;
      }
    });

    if (!Object.keys(updates).length) {
      result.textContent = "Semua nomor sudah ada di daftar" + (parsed.bad.length ? ", " + parsed.bad.length + " tidak terbaca" : "") + ".";
      return;
    }

    db.ref().update(updates).then(function() {
      Object.keys(seen).forEach(function(p) { selected[p] = true; });
      input.value = "";
      result.textContent = baru + " nomor baru ditambahkan" + (ada ? ", " + ada + " sudah ada" : "") +
        (parsed.bad.length ? ", " + parsed.bad.length + " tidak terbaca" : "") + ".";
      renderList();
    }).catch(function(e) {
      result.textContent = "Gagal simpan: " + e.message;
    });
  }

  function removeContact(phone) {
    const c = contacts[phone];
    if (!c) return;
    if (!confirm("Hapus " + prettyPhone(phone) + " dari daftar nomor manual?")) return;
    delete selected[phone];
    db.ref("waContacts/" + phone).remove().catch(function(e) { alert("Gagal hapus: " + e.message); });
  }

  function filterSettings() {
    return {
      minDays: Number(($id("fuFilterDays") || {}).value || 0),
      skipRecent: !!($id("fuSkipRecent") || {}).checked,
      search: String(($id("fuSearch") || {}).value || "").trim().toLowerCase()
    };
  }

  function eligible(c, f) {
    if (c.optOut) return false;
    if (f.minDays && c.lastAt && Date.now() - c.lastAt < f.minDays * DAY) return false;
    if (f.skipRecent && c.lastFollowup && Date.now() - c.lastFollowup < 7 * DAY) return false;
    return true;
  }

  function matchesSearch(c, f) {
    if (!f.search) return true;
    const digits = f.search.replace(/\D/g, "");
    return (c.name || "").toLowerCase().indexOf(f.search) !== -1 ||
      (digits && prettyPhone(c.phone).indexOf(digits) !== -1);
  }

  function selectAllEligible() {
    const f = filterSettings();
    selected = {};
    customers().forEach(function(c) { if (eligible(c, f)) selected[c.phone] = true; });
  }

  function selectedPhones() {
    const f = filterSettings();
    return customers().filter(function(c) { return selected[c.phone] && eligible(c, f); })
      .map(function(c) { return c.phone; });
  }

  /* ---------- bot ---------- */
  function botOnline() {
    return !!(botStatus && botStatus.online && Date.now() - Number(botStatus.lastSeen || 0) < 3 * 60 * 1000);
  }

  function dailyCap() {
    const cap = Number(botStatus && botStatus.followupCap);
    return cap > 0 ? cap : 50;
  }

  /* ---------- pesan ---------- */
  function finalText() {
    let text = String(($id("fuText") || {}).value || "").trim();
    if (!text) return "";
    text += WA_NOTE;
    if (($id("fuStopFooter") || {}).checked) text += STOP_FOOTER;
    return text;
  }

  function waFormat(text) {
    return esc(text)
      .replace(/\*([^*\n]+)\*/g, "<b>$1</b>")
      .replace(/_([^_\n]+)_/g, "<i>$1</i>")
      .replace(/~([^~\n]+)~/g, "<s>$1</s>")
      .replace(/\n/g, "<br>");
  }

  function renderPreview() {
    const box = $id("fuPreview");
    if (!box) return;
    const text = finalText();
    box.innerHTML = (imageData ? '<img src="' + imageData + '" alt="Gambar promo">' : "") +
      (text ? '<div class="fu-bubble-text">' + waFormat(text) + "</div>" : '<div class="fu-bubble-text muted">Tulis pesan di samping…</div>');
  }

  function saveDraft() {
    try { localStorage.setItem(DRAFT_KEY, ($id("fuText") || {}).value || ""); } catch (e) {}
  }

  function loadDraft() {
    let v = "";
    try { v = localStorage.getItem(DRAFT_KEY) || ""; } catch (e) {}
    // draf lama mengajak membalas ke nomor bot; arahkan ke WA utama lewat catatan
    v = v.replace("Balas chat ini aja ya Kak buat booking 🙏", "Yuk booking sekarang 🙏");
    if (v.indexOf(OLD_DEFAULT_BODY) !== -1) v = "";
    return v || DEFAULT_TEXT;
  }

  /* ---------- gambar ---------- */
  function loadImg(file) {
    return new Promise(function(resolve, reject) {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = function() { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = function() { URL.revokeObjectURL(url); reject(new Error("Format gambar tidak didukung browser ini.")); };
      img.src = url;
    });
  }

  function drawJpeg(img, maxSide, quality) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const scale = Math.min(1, maxSide / Math.max(w, h));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  }

  function prepareImage(file) {
    return loadImg(file).then(function(img) {
      let side = IMG_MAX_SIDE;
      let q = 0.85;
      let out = "";
      for (let i = 0; i < 6; i++) {
        out = drawJpeg(img, side, q);
        if (out.length * 0.75 <= IMG_MAX_BYTES) break;
        side = Math.round(side * 0.82);
        q = Math.max(0.6, q - 0.07);
      }
      return { image: out, thumb: drawJpeg(img, 96, 0.6).split(",")[1] || "" };
    });
  }

  function renderImageBox() {
    const box = $id("fuImageBox");
    if (!box) return;
    box.innerHTML = imageData
      ? '<img src="' + imageData + '" alt="Gambar terpilih">' +
        '<button type="button" class="btn-mini" id="fuImageRemove"><i class="fas fa-trash"></i> Hapus gambar</button>'
      : '<span class="fu-image-empty"><i class="fas fa-image"></i> Belum ada gambar (opsional)</span>';
  }

  /* ---------- tampilan ---------- */
  function renderBot() {
    const el = $id("fuBotStatus");
    if (!el) return;
    const on = botOnline();
    el.className = "bot-pill " + (on ? "on" : "off");
    el.innerHTML = '<i class="fas fa-robot"></i> Bot WA ' + (on ? "online" : "offline");
  }

  function renderList() {
    const listEl = $id("fuList");
    if (!listEl) return;

    if (!selectionInit) {
      let ada = false;
      try { ada = Array.isArray(allRentals) && allRentals.length > 0; } catch (e) {}
      if (ada && contactsLoaded) { selectAllEligible(); selectionInit = true; }
    }

    const f = filterSettings();
    const all = customers();
    const rows = all.filter(function(c) { return matchesSearch(c, f); });

    const target = all.filter(function(c) { return eligible(c, f); }).length;
    const count = selectedPhones().length;
    const stopCount = all.filter(function(c) { return c.optOut; }).length;

    const info = $id("fuCount");
    if (info) {
      info.innerHTML = "<strong>" + count + "</strong> dipilih dari " + target + " pelanggan sesuai filter · total " +
        all.length + " pernah sewa" + (stopCount ? " · " + stopCount + " minta STOP" : "");
    }

    if (!rows.length) {
      listEl.innerHTML = '<p class="empty">' + (all.length ? "Tidak ada yang cocok." : "Belum ada data sewa.") + "</p>";
    } else {
      listEl.innerHTML = rows.map(function(c) {
        const ok = eligible(c, f);
        const badges = [];
        if (c.manual && !c.count) badges.push('<span class="fu-badge manual">manual</span>' +
          '<button type="button" class="fu-del" data-fu-del="' + c.phone + '" title="Hapus nomor"><i class="fas fa-xmark"></i></button>');
        if (c.optOut) badges.push('<span class="fu-badge stop">STOP</span>');
        else if (c.lastFollowup) badges.push('<span class="fu-badge">dapat promo ' + daysAgo(c.lastFollowup) + "</span>");
        return '<label class="fu-row' + (ok ? "" : " off") + '">' +
          '<input type="checkbox" data-fu-phone="' + c.phone + '"' + (selected[c.phone] && ok ? " checked" : "") + (ok ? "" : " disabled") + ">" +
          '<span class="fu-row-main">' +
            "<strong>" + esc(c.name || prettyPhone(c.phone)) + "</strong>" +
            "<span>" + esc(prettyPhone(c.phone)) + " · " +
              (c.count ? c.count + "x sewa" : "pelanggan lama") + " · terakhir " + (c.lastAt ? daysAgo(c.lastAt) : "tidak tercatat") + "</span>" +
          "</span>" + badges.join("") +
        "</label>";
      }).join("");
    }

    renderSendButton(count);
  }

  function renderSendButton(count) {
    const btn = $id("fuSend");
    const note = $id("fuSendNote");
    if (!btn) return;
    if (count === undefined) count = selectedPhones().length;

    const on = botOnline();
    btn.disabled = sending || !on || !count || !finalText();
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Kirim ke ' + count + " pelanggan";

    if (!note) return;
    if (!on) {
      note.textContent = "Bot WA sedang offline. Nyalakan bot di Termux dulu, baru bisa kirim.";
      return;
    }
    if (imageData && finalText().length > 1000) {
      note.textContent = "Pesan dengan gambar maksimal ±1000 huruf (batas WhatsApp). Pendekkan pesannya dulu.";
      btn.disabled = true;
      return;
    }
    const cap = dailyCap();
    const menit = Math.max(1, Math.round(count * 50 / 60));
    note.textContent = count > cap
      ? "Maks. " + cap + " pesan promo per hari supaya nomor bot aman. Semua terkirim bertahap ±" + Math.ceil(count / cap) + " hari."
      : "Dikirim satu per satu dengan jeda acak, perkiraan selesai ±" + menit + " menit.";
  }

  function renderHistory() {
    const el = $id("fuHistory");
    if (!el) return;

    const stats = {};
    outbox.forEach(function(m) {
      if (!m.broadcastId) return;
      const s = stats[m.broadcastId] || (stats[m.broadcastId] = { sent: 0, failed: 0, pending: 0, cancelled: 0, pendingIds: [], failedItems: [], reasons: {} });
      if (m.status === "sent") s.sent += 1;
      else if (m.status === "failed") {
        s.failed += 1;
        s.failedItems.push(m);
        const why = String(m.error || "tidak diketahui");
        s.reasons[why] = (s.reasons[why] || 0) + 1;
      }
      else if (m.status === "cancelled") s.cancelled += 1;
      else if (m.status === "retried") { /* diganti pesan baru */ }
      else { s.pending += 1; if (m.status === "pending") s.pendingIds.push(m.id); }
    });

    if (!broadcasts.length) {
      el.innerHTML = '<p class="empty">Belum ada info promo yang dikirim.</p>';
      return;
    }

    el.innerHTML = broadcasts.map(function(b) {
      const s = stats[b.id] || { sent: 0, failed: 0, pending: 0, cancelled: 0, pendingIds: [], failedItems: [], reasons: {} };
      const reasons = Object.keys(s.reasons).map(function(r) { return esc(r) + (s.reasons[r] > 1 ? " (" + s.reasons[r] + ")" : ""); }).join(", ");
      const when = new Date(Number(b.createdAt || 0)).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const firstLine = String(b.text || "").split("\n").filter(Boolean).slice(0, 2).join(" · ");
      return '<div class="fu-hist">' +
        '<div class="fu-hist-head"><strong>' + esc(when) + "</strong>" +
          (b.hasImage ? ' <i class="fas fa-image" title="Dengan gambar"></i>' : "") +
          "<span>" + (b.total || 0) + " penerima · oleh " + esc(b.createdBy || "-") + "</span></div>" +
        '<p class="fu-hist-text">' + esc(firstLine.slice(0, 120)) + "</p>" +
        '<div class="fu-hist-stats">' +
          '<span class="ok"><i class="fas fa-check"></i> ' + s.sent + " terkirim</span>" +
          "<span><i class=\"fas fa-clock\"></i> " + s.pending + " antri</span>" +
          '<span class="bad"><i class="fas fa-xmark"></i> ' + s.failed + " gagal</span>" +
          (s.cancelled ? "<span>" + s.cancelled + " dibatalkan</span>" : "") +
          (s.pendingIds.length ? '<button type="button" class="btn-mini" data-fu-cancel="' + b.id + '">Batalkan sisa</button>' : "") +
          (s.failedItems.length ? '<button type="button" class="btn-mini" data-fu-retry="' + b.id + '"><i class="fas fa-rotate-right"></i> Kirim ulang yang gagal</button>' : "") +
        "</div>" +
        (reasons ? '<p class="fu-hist-why">Alasan gagal: ' + reasons + "</p>" : "") +
      "</div>";
    }).join("");

    el.__stats = stats;
  }

  function renderAll() {
    renderBot();
    renderList();
    renderHistory();
    renderPreview();
  }

  /* ---------- kirim ---------- */
  function send() {
    if (sending) return;
    const phones = selectedPhones();
    const text = finalText();
    if (!phones.length || !text) return;
    if (!botOnline()) { alert("Bot WA sedang offline."); return; }

    const cap = dailyCap();
    let msg = "Kirim info promo ke " + phones.length + " pelanggan" + (imageData ? " (dengan gambar)" : "") + "?";
    if (phones.length > cap) msg += "\n\nKarena batas " + cap + " pesan/hari, pengiriman berlangsung bertahap ±" + Math.ceil(phones.length / cap) + " hari.";
    msg += "\n\nPesan dikirim dari nomor bot satu per satu.";
    if (!confirm(msg)) return;

    sending = true;
    renderSendButton();

    const now = Date.now();
    const bid = db.ref("waBroadcasts").push().key;
    const updates = {};
    updates["waBroadcasts/" + bid] = {
      text: text,
      hasImage: !!imageData,
      total: phones.length,
      createdAt: now,
      createdBy: role()
    };
    if (imageData) updates["waBroadcastMedia/" + bid] = { image: imageData, thumb: thumbData || "" };

    phones.forEach(function(phone, i) {
      const key = db.ref("waOutbox").push().key;
      updates["waOutbox/" + key] = {
        phone: phone,
        text: text,
        source: "followup",
        broadcastId: bid,
        hasImage: !!imageData,
        status: "pending",
        klik: true,
        createdAt: now + i,
        createdBy: role()
      };
    });

    db.ref().update(updates).then(function() {
      toast("Info promo masuk antrian bot: " + phones.length + " pelanggan.");
      const hist = $id("fuHistory");
      if (hist && hist.scrollIntoView) hist.scrollIntoView({ behavior: "smooth", block: "start" });
    }).catch(function(e) {
      alert("Gagal antri info promo: " + e.message);
    }).then(function() {
      sending = false;
      renderSendButton();
    });
  }

  function retryFailed(bid) {
    const el = $id("fuHistory");
    const s = el && el.__stats && el.__stats[bid];
    if (!s || !s.failedItems.length) return;
    if (!botOnline()) { alert("Bot WA sedang offline."); return; }
    if (!confirm("Kirim ulang " + s.failedItems.length + " pesan yang gagal?")) return;
    const now = Date.now();
    const updates = {};
    s.failedItems.forEach(function(m, i) {
      updates["waOutbox/" + m.id + "/status"] = "retried";
      const key = db.ref("waOutbox").push().key;
      updates["waOutbox/" + key] = {
        phone: m.phone,
        text: m.text,
        source: "followup",
        broadcastId: bid,
        hasImage: !!m.hasImage,
        status: "pending",
        klik: true,
        createdAt: now + i,
        createdBy: role()
      };
    });
    db.ref().update(updates).then(function() {
      toast("Pesan yang gagal masuk antrian lagi.");
    }).catch(function(e) { alert("Gagal kirim ulang: " + e.message); });
  }

  function cancelBroadcast(bid) {
    const el = $id("fuHistory");
    const s = el && el.__stats && el.__stats[bid];
    if (!s || !s.pendingIds.length) return;
    if (!confirm("Batalkan " + s.pendingIds.length + " pesan yang belum terkirim?")) return;
    const updates = {};
    s.pendingIds.forEach(function(id) {
      updates["waOutbox/" + id + "/status"] = "cancelled";
      updates["waOutbox/" + id + "/doneAt"] = Date.now();
    });
    db.ref().update(updates).then(function() {
      toast("Sisa pesan dibatalkan.");
    }).catch(function(e) { alert("Gagal membatalkan: " + e.message); });
  }

  /* ---------- listener Firebase ---------- */
  function start() {
    if (started || typeof db === "undefined" || !db) return;
    started = true;

    db.ref("waBot/status").on("value", function(snap) {
      botStatus = snap.val();
      renderBot();
      renderSendButton();
    });

    db.ref("waContacts").on("value", function(snap) {
      contacts = snap.val() || {};
      contactsLoaded = true;
      renderList();
    });

    db.ref("waOptOut").on("value", function(snap) {
      optOut = snap.val() || {};
      renderList();
    });

    db.ref("waOutbox").orderByChild("createdAt").startAt(Date.now() - 30 * DAY).on("value", function(snap) {
      const list = [];
      snap.forEach(function(child) {
        const m = child.val() || {};
        m.id = child.key;
        list.push(m);
      });
      outbox = list;
      renderList();
      renderHistory();
    });

    db.ref("waBroadcasts").orderByChild("createdAt").limitToLast(10).on("value", function(snap) {
      const list = [];
      snap.forEach(function(child) {
        const b = child.val() || {};
        b.id = child.key;
        list.push(b);
      });
      broadcasts = list.reverse();
      renderHistory();
    });

    setInterval(function() { renderBot(); renderSendButton(); }, 60 * 1000);
  }

  /* ---------- event ---------- */
  function bind() {
    const text = $id("fuText");
    if (!text) return;

    text.value = loadDraft();
    text.addEventListener("input", function() { saveDraft(); renderPreview(); renderSendButton(); });

    $id("fuStopFooter").addEventListener("change", function() { renderPreview(); renderSendButton(); });

    $id("fuReset").addEventListener("click", function() {
      if (!confirm("Kembalikan pesan ke contoh awal?")) return;
      text.value = DEFAULT_TEXT;
      saveDraft();
      renderPreview();
      renderSendButton();
    });

    $id("fuImage").addEventListener("change", function(e) {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      const box = $id("fuImageBox");
      if (box) box.innerHTML = '<span class="fu-image-empty"><i class="fas fa-spinner fa-spin"></i> Menyiapkan gambar…</span>';
      prepareImage(file).then(function(res) {
        imageData = res.image;
        thumbData = res.thumb;
      }).catch(function(err) {
        alert(err.message);
      }).then(function() {
        renderImageBox();
        renderPreview();
        renderSendButton();
      });
    });

    $id("fuImageBox").addEventListener("click", function(e) {
      if (e.target.closest("#fuImageRemove")) {
        imageData = "";
        thumbData = "";
        renderImageBox();
        renderPreview();
        renderSendButton();
      }
    });

    ["fuFilterDays", "fuSkipRecent"].forEach(function(id) {
      $id(id).addEventListener("change", function() { selectAllEligible(); renderList(); });
    });

    $id("fuSearch").addEventListener("input", renderList);

    $id("fuSelectAll").addEventListener("click", function() { selectAllEligible(); renderList(); });
    $id("fuSelectNone").addEventListener("click", function() { selected = {}; renderList(); });

    $id("fuManualAdd").addEventListener("click", addContacts);

    $id("fuList").addEventListener("click", function(e) {
      const del = e.target.closest && e.target.closest("[data-fu-del]");
      if (!del) return;
      e.preventDefault();
      removeContact(del.getAttribute("data-fu-del"));
    });

    $id("fuList").addEventListener("change", function(e) {
      const phone = e.target.getAttribute && e.target.getAttribute("data-fu-phone");
      if (!phone) return;
      if (e.target.checked) selected[phone] = true;
      else delete selected[phone];
      renderList();
    });

    $id("fuSend").addEventListener("click", send);

    $id("fuHistory").addEventListener("click", function(e) {
      const btn = e.target.closest && e.target.closest("[data-fu-cancel]");
      if (btn) cancelBroadcast(btn.getAttribute("data-fu-cancel"));
      const retry = e.target.closest && e.target.closest("[data-fu-retry]");
      if (retry) retryFailed(retry.getAttribute("data-fu-retry"));
    });

    renderImageBox();
    renderPreview();
  }

  bind();

  const prevHook = window.onRentalsUpdated;
  window.onRentalsUpdated = function() {
    if (typeof prevHook === "function") prevHook.apply(this, arguments);
    start();
    renderList();
  };

  // dipakai untuk tes
  window.__followup = { customers: customers, selectedPhones: selectedPhones, finalText: finalText,
    _setBot: function(v) { botStatus = v; renderAll(); } };
})();
