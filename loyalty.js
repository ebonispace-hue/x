/* =====================================================
   PROGRAM BONUS JAM (LOYALTY)
   - Setiap total sewa 72 jam  -> bonus GRATIS 6 jam
   - Promo Mabar Puas 200rb    -> dihitung 48 jam
   - Semua durasi sewa PS dihitung; sewa TV saja tidak dihitung
   - Tabungan bonus maksimal 2x (12 jam). Kalau sudah penuh,
     jam sewa berikutnya baru terhitung lagi setelah bonus diklaim.
   - Klaim dicatat di Firebase: loyaltyClaims/{id}
   - Info ke pelanggan dikirim lewat tombol WA (tanpa bot).
===================================================== */
(function() {
  "use strict";

  const TARGET_JAM = 72;
  const BONUS_JAM = 6;
  const MAX_TABUNGAN = 2;          // 2 x 6 jam = 12 jam
  const PROMO_NOMINAL = 200000;
  const PROMO_JAM = 48;
  const MULAI_PROGRAM = Date.parse("2026-10-01T00:00:00+07:00"); // sewa sebelum ini tidak dihitung

  let claims = [];
  let claimsStarted = false;
  let searchText = "";

  const $id = function(id) { return document.getElementById(id); };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /* ---------- nomor & nama dari teks "Nomor Penyewa" ---------- */
  function normalizePhone(text) {
    const match = String(text || "").match(/[+\d][\d\s\-‐-―.]{6,}/);
    if (!match) return "";
    let digits = match[0].replace(/\D/g, "");
    if (digits.indexOf("0") === 0) digits = "62" + digits.slice(1);
    else if (digits.indexOf("8") === 0) digits = "62" + digits;
    return digits.length >= 10 ? digits : "";
  }

  function nameFrom(text) {
    const s = String(text || "");
    const inParen = s.match(/\(([^)]+)\)/);
    if (inParen) return inParen[1].trim();
    const after = s.replace(/[+\d\s\-‐-―.‪-‮]+/, "").trim();
    return after;
  }

  function prettyPhone(digits) {
    return digits ? "0" + digits.slice(2) : "-";
  }

  /* ---------- jam yang dihitung per transaksi ---------- */
  function countedHours(rental) {
    const unit = String(rental.psUnit || "");
    if (unit.indexOf("TV") === 0) return 0;

    const durasi = Number(rental.durasi || 0);
    const jam = rental.durasiUnit === "hari" ? durasi * 24 : durasi;
    if (!jam || jam <= 0) return 0;

    const nominal = Number(rental.nominalKotor || rental.nominal || 0);
    if (nominal === PROMO_NOMINAL && jam >= PROMO_JAM) return PROMO_JAM;

    return jam;
  }

  /* ---------- hitung status satu pelanggan ---------- */
  function rentalsList() {
    let list = [];
    try { list = Array.isArray(allRentals) ? allRentals : []; } catch (e) { list = []; }
    return list.filter(function(r) { return Number(r.createdAt || 0) >= MULAI_PROGRAM; });
  }

  function statusFor(phone, extraRental) {
    const list = rentalsList().filter(function(r) { return normalizePhone(r.nomorPenyewa) === phone; });
    if (extraRental && !list.some(function(r) { return r.id === extraRental.id; })) list.push(extraRental);

    const events = list.map(function(r) { return { t: Number(r.createdAt || 0), type: "sewa", r: r }; })
      .concat(claims.filter(function(c) { return c.phone === phone; })
        .map(function(c) { return { t: Number(c.createdAt || 0), type: "klaim", c: c }; }));

    events.sort(function(a, b) { return a.t - b.t || (a.type === "sewa" ? -1 : 1); });

    const st = {
      phone: phone,
      name: "",
      progress: 0,
      tabungan: 0,
      diklaim: 0,
      totalJam: 0,
      sewaCount: 0,
      lastAt: 0,
      lastJam: 0
    };

    events.forEach(function(ev) {
      if (ev.type === "klaim") {
        if (st.tabungan > 0) st.tabungan -= 1;
        st.diklaim += 1;
        return;
      }

      const jam = countedHours(ev.r);
      st.sewaCount += 1;
      st.lastAt = ev.t;
      st.lastJam = jam;
      const nm = nameFrom(ev.r.nomorPenyewa);
      if (nm) st.name = nm;

      if (!jam || st.tabungan >= MAX_TABUNGAN) return;   // tabungan penuh: tidak dihitung

      st.totalJam += jam;
      st.progress += jam;

      while (st.progress >= TARGET_JAM && st.tabungan < MAX_TABUNGAN) {
        st.progress -= TARGET_JAM;
        st.tabungan += 1;
      }

      if (st.tabungan >= MAX_TABUNGAN) st.progress = 0;
    });

    return st;
  }

  function allStatuses() {
    const phones = {};
    rentalsList().forEach(function(r) {
      const p = normalizePhone(r.nomorPenyewa);
      if (p) phones[p] = true;
    });
    return Object.keys(phones).map(function(p) { return statusFor(p); });
  }

  /* ---------- pesan WA ---------- */
  function waMessage(st, jamSewaIni) {
    const lines = [
      "Halo Kak 👋",
      "Terima kasih sudah sewa PS di *Eboni Space*! 🎮",
      ""
    ];

    if (jamSewaIni !== undefined) {
      lines.push(jamSewaIni > 0
        ? "Sewa kali ini tercatat *" + jamSewaIni + " jam XP* di *Level Up Rewards* 🚀"
        : "Sewa kali ini belum masuk hitungan Level Up Rewards.");
    }

    lines.push("📊 XP terkumpul: *" + st.progress + "/" + TARGET_JAM + " jam*");
    lines.push("🎁 Bonus siap klaim: *" + (st.tabungan * BONUS_JAM) + " jam* (" + st.tabungan + "x gratis " + BONUS_JAM + " jam)");

    if (st.tabungan >= MAX_TABUNGAN) {
      lines.push("⚠️ Tabungan bonus sudah maksimal (12 jam). Klaim dulu ya, supaya jam sewa berikutnya terhitung lagi.");
    } else {
      lines.push("⏳ Kurang *" + (TARGET_JAM - st.progress) + " jam* lagi untuk Level Up berikutnya.");
    }

    lines.push("");
    lines.push("*Level Up Rewards*: setiap total sewa 72 jam = Level Up, dapat GRATIS 6 jam main (tabungan maks. 12 jam). Semua durasi sewa dihitung, Mabar Puas 200rb = 48 jam.");
    lines.push("Bonus bisa dipakai di booking berikutnya 🙏");

    return lines.join("\n");
  }

  /* ---------- Bot WA (server Hostinger) ---------- */
  let botStatus = null;
  let botStarted = false;

  function botOnline() {
    return !!(botStatus && botStatus.online && Date.now() - Number(botStatus.lastSeen || 0) < 3 * 60 * 1000);
  }

  function renderBotPill() {
    let pill = $id("botPill");
    const head = document.querySelector(".loyalty-card .card-title-row");
    if (!pill && head) {
      pill = document.createElement("span");
      pill.id = "botPill";
      pill.className = "bot-pill";
      head.insertBefore(pill, head.children[1] || null);
    }
    if (!pill) return;
    const on = botOnline();
    pill.className = "bot-pill " + (on ? "on" : "off");
    pill.innerHTML = '<i class="fas fa-robot"></i> Bot WA ' + (on ? "online" : "offline");
    pill.title = on
      ? "Pesan Level Up Rewards dikirim otomatis dari nomor " + (botStatus.number ? "0" + String(botStatus.number).slice(2) : "bot")
      : "Bot belum aktif: pesan dikirim manual lewat tombol WhatsApp";
  }

  function startBotWatch() {
    if (botStarted || typeof db === "undefined" || !db) return;
    botStarted = true;
    db.ref("waBot/status").on("value", function(snap) {
      botStatus = snap.val();
      renderBotPill();
    });
    setInterval(renderBotPill, 60 * 1000);
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

  function queueMessage(phone, text, source) {
    return db.ref("waOutbox").push({
      phone: phone,
      text: text,
      source: source || "manual",
      status: "pending",
      createdAt: Date.now(),
      createdBy: (typeof currentUser !== "undefined" && currentUser) ? currentUser.role : "Admin"
    });
  }

  function claimMessage(st) {
    const sisa = Math.max(0, st.tabungan - 1) * BONUS_JAM;
    return [
      "Halo Kak 👋",
      "Bonus *GRATIS " + BONUS_JAM + " jam* dari *Level Up Rewards* Eboni Space sudah dipakai ya. Selamat main! 🎮",
      "",
      "🎁 Sisa bonus: *" + sisa + " jam*",
      "📊 XP terkumpul: *" + st.progress + "/" + TARGET_JAM + " jam*",
      "",
      "Terima kasih sudah langganan 🙏"
    ].join("\n");
  }

  function waLink(phone, text) {
    return "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
  }

  /* ---------- modal kirim WA ---------- */
  function ensureModal() {
    let modal = $id("loyaltyModal");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.id = "loyaltyModal";
    modal.className = "modal hidden";
    modal.innerHTML =
      '<div class="modal-overlay" data-close="1"></div>' +
      '<div class="modal-card">' +
        '<div class="modal-header">' +
          '<h3><i class="fas fa-gift"></i> Kirim Info Level Up Rewards</h3>' +
          '<button type="button" class="btn-icon" data-close="1"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="loyalty-summary" id="loyaltyModalSummary"></div>' +
        '<div class="form-group full-width">' +
          '<label for="loyaltyModalText">Pesan (bisa diubah)</label>' +
          '<textarea id="loyaltyModalText" rows="9"></textarea>' +
        '</div>' +
        '<div class="modal-actions">' +
          '<button type="button" class="btn-secondary" data-close="1">Nanti saja</button>' +
          '<a id="loyaltyModalSend" class="btn-secondary" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> Buka WhatsApp</a>' +
          '<button type="button" id="loyaltyModalBot" class="btn-primary"><i class="fas fa-robot"></i> Kirim lewat Bot</button>' +
        '</div>' +
      '</div>';

    modal.addEventListener("click", function(e) {
      if (e.target.closest("[data-close]")) modal.classList.add("hidden");
    });

    document.body.appendChild(modal);

    const text = $id("loyaltyModalText");
    const send = $id("loyaltyModalSend");
    text.addEventListener("input", function() {
      send.href = waLink(send.dataset.phone, text.value);
    });
    send.addEventListener("click", function() {
      setTimeout(function() { modal.classList.add("hidden"); }, 300);
    });

    $id("loyaltyModalBot").addEventListener("click", function() {
      queueMessage(send.dataset.phone, text.value, "manual").then(function() {
        modal.classList.add("hidden");
        toast("Pesan masuk antrian bot WA, terkirim dalam beberapa detik.");
      }).catch(function(e) { alert("Gagal antri ke bot: " + e.message); });
    });

    return modal;
  }

  function summaryHtml(st) {
    const pct = Math.min(100, Math.round((st.progress / TARGET_JAM) * 100));
    return '<div class="loyalty-head">' +
        '<strong>' + esc(st.name || prettyPhone(st.phone)) + '</strong>' +
        '<span>' + esc(prettyPhone(st.phone)) + ' · ' + st.sewaCount + 'x sewa</span>' +
      '</div>' +
      '<div class="loyalty-bar"><span style="width:' + pct + '%"></span></div>' +
      '<div class="loyalty-meta">' +
        '<span>' + st.progress + '/' + TARGET_JAM + ' jam</span>' +
        '<span class="loyalty-bonus' + (st.tabungan ? ' has' : '') + '"><i class="fas fa-gift"></i> ' +
          (st.tabungan * BONUS_JAM) + ' jam bonus</span>' +
      '</div>';
  }

  function openWaModal(st, jamSewaIni) {
    if (!st.phone) {
      alert("Nomor WA pelanggan tidak terbaca. Pastikan nomor diisi dengan benar (contoh 0812xxxx).");
      return;
    }

    const modal = ensureModal();
    const text = waMessage(st, jamSewaIni);
    $id("loyaltyModalSummary").innerHTML = summaryHtml(st);
    $id("loyaltyModalText").value = text;
    const send = $id("loyaltyModalSend");
    send.dataset.phone = st.phone;
    send.href = waLink(st.phone, text);
    $id("loyaltyModalBot").style.display = botOnline() ? "" : "none";
    modal.classList.remove("hidden");
  }

  /* ---------- klaim bonus ---------- */
  function claimBonus(phone) {
    const st = statusFor(phone);
    if (st.tabungan <= 0) {
      alert("Pelanggan ini belum punya bonus untuk diklaim.");
      return;
    }

    if (typeof db === "undefined" || !db) {
      alert("Database belum siap.");
      return;
    }

    const nama = st.name || prettyPhone(phone);
    if (!confirm("Klaim bonus GRATIS " + BONUS_JAM + " jam untuk " + nama + "?\n\nSisa tabungan setelah klaim: " +
      ((st.tabungan - 1) * BONUS_JAM) + " jam.")) return;

    db.ref("loyaltyClaims").push({
      phone: phone,
      nama: st.name || "",
      jam: BONUS_JAM,
      createdAt: Date.now(),
      createdBy: (typeof currentUser !== "undefined" && currentUser) ? currentUser.role : "Admin"
    }).then(function() {
      let pesan = "Bonus " + BONUS_JAM + " jam untuk " + nama + " berhasil diklaim.\n\nCatat sewa gratisnya seperti biasa (nominal sesuai yang dibayar).";
      if (botOnline()) {
        queueMessage(phone, claimMessage(st), "klaim");
        pesan += "\n\nKonfirmasi klaim dikirim otomatis ke WA pelanggan.";
      }
      alert(pesan);
    }).catch(function(error) {
      alert("Gagal klaim bonus: " + error.message);
    });
  }

  /* ---------- daftar member di halaman Sewa ---------- */
  function renderList() {
    const listEl = $id("loyaltyList");
    if (!listEl) return;

    let rows = allStatuses().filter(function(st) { return st.totalJam > 0 || st.tabungan > 0; });

    if (searchText) {
      const q = searchText.toLowerCase();
      rows = rows.filter(function(st) {
        return (st.name || "").toLowerCase().indexOf(q) !== -1 || prettyPhone(st.phone).indexOf(q.replace(/\D/g, "") || "~") !== -1;
      });
    }

    rows.sort(function(a, b) {
      return (b.tabungan - a.tabungan) || (b.progress - a.progress) || (b.lastAt - a.lastAt);
    });

    const siap = allStatuses().filter(function(st) { return st.tabungan > 0; }).length;
    const info = $id("loyaltyInfo");
    if (info) info.textContent = siap + " pelanggan punya bonus siap klaim.";

    if (!rows.length) {
      listEl.innerHTML = '<p class="empty">Belum ada pelanggan yang masuk hitungan.</p>';
      return;
    }

    listEl.innerHTML = rows.slice(0, 40).map(function(st) {
      return '<div class="loyalty-row">' +
        summaryHtml(st) +
        '<div class="loyalty-actions">' +
          '<button type="button" class="btn-mini" data-wa="' + st.phone + '"><i class="fab fa-whatsapp"></i> Kirim info</button>' +
          (st.tabungan > 0
            ? '<button type="button" class="btn-mini btn-claim" data-claim="' + st.phone + '"><i class="fas fa-gift"></i> Klaim 6 jam</button>'
            : '') +
        '</div>' +
      '</div>';
    }).join("");
  }

  /* ---------- petunjuk saat nomor diketik ---------- */
  function renderHint() {
    const input = $id("nomorPenyewa");
    const hint = $id("loyaltyHint");
    if (!input || !hint) return;

    const phone = normalizePhone(input.value);
    if (!phone) {
      hint.classList.add("hidden");
      return;
    }

    const st = statusFor(phone);
    hint.classList.remove("hidden");

    if (!st.sewaCount) {
      hint.innerHTML = '<i class="fas fa-user-plus"></i> Pelanggan baru, belum ada riwayat Level Up Rewards.';
      return;
    }

    hint.innerHTML = '<i class="fas fa-gift"></i> ' + esc(st.name || "Pelanggan") + ': ' +
      st.progress + '/' + TARGET_JAM + ' jam' +
      (st.tabungan
        ? ' · <strong>bonus ' + (st.tabungan * BONUS_JAM) + ' jam siap klaim</strong> ' +
          '<button type="button" class="btn-mini btn-claim" data-claim="' + phone + '">Klaim</button>'
        : ' · kurang ' + (TARGET_JAM - st.progress) + ' jam lagi');
  }

  /* ---------- event ---------- */
  document.addEventListener("click", function(e) {
    const wa = e.target.closest && e.target.closest("[data-wa]");
    if (wa) {
      openWaModal(statusFor(wa.getAttribute("data-wa")));
      return;
    }

    const claim = e.target.closest && e.target.closest("[data-claim]");
    if (claim) claimBonus(claim.getAttribute("data-claim"));
  });

  const nomorInput = $id("nomorPenyewa");
  if (nomorInput) nomorInput.addEventListener("input", renderHint);

  const search = $id("loyaltySearch");
  if (search) search.addEventListener("input", function() {
    searchText = search.value.trim();
    renderList();
  });

  function startClaims() {
    if (claimsStarted || typeof db === "undefined" || !db) return;
    claimsStarted = true;

    db.ref("loyaltyClaims").on("value", function(snap) {
      const list = [];
      snap.forEach(function(child) {
        const c = child.val() || {};
        c.id = child.key;
        list.push(c);
      });
      claims = list;
      renderList();
      renderHint();
    });
  }

  window.onRentalsUpdated = function() {
    startClaims();
    startBotWatch();
    renderList();
    renderHint();
  };

  window.onRentalSaved = function(nomorText, rentalId) {
    const phone = normalizePhone(nomorText);
    if (!phone) return;

    const saved = rentalsList().find(function(r) { return r.id === rentalId; });
    const st = statusFor(phone);
    const jam = saved ? countedHours(saved) : undefined;

    if (botOnline()) {
      queueMessage(phone, waMessage(st, jam), "sewa").then(function() {
        toast("Info Level Up Rewards dikirim otomatis ke WA pelanggan.");
      }).catch(function() { openWaModal(st, jam); });
      return;
    }

    openWaModal(st, jam);
  };

  // dipakai untuk tes
  window.__loyalty = { normalizePhone: normalizePhone, countedHours: countedHours, statusFor: statusFor,
    _setBot: function(v) { botStatus = v; renderBotPill(); }, _waMessage: waMessage };
})();
