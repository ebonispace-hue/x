/* =====================================================
   NAVIGASI HALAMAN + KARTU RINGKASAN HOME
   - Pindah halaman lewat #hash (Home, Sewa, Kas, Loan, Keluar, Rekap)
   - Kartu Home (saldo kas, loan) menyalin angka dari kartu aslinya,
     jadi app.js tidak perlu diubah.
===================================================== */
(function() {
  "use strict";

  const PAGES = ["dashboard", "sewa", "kas", "loan", "pengeluaran", "rekap", "promo"];
  const TITLES = {
    dashboard: "Home",
    sewa: "Input Sewa",
    kas: "Kas",
    loan: "Loan",
    pengeluaran: "Pengeluaran",
    rekap: "Rekap Bulanan",
    promo: "Info Promo"
  };

  function currentPage() {
    const hash = (location.hash || "").replace("#", "");
    return PAGES.indexOf(hash) !== -1 ? hash : "dashboard";
  }

  function showPage(name, scroll) {
    document.querySelectorAll(".page[data-page]").forEach(function(el) {
      el.hidden = el.getAttribute("data-page") !== name;
    });

    document.querySelectorAll("[data-nav]").forEach(function(link) {
      const active = link.getAttribute("data-nav") === name;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });

    document.title = TITLES[name] + " · Panel Eboni Space";
    if (scroll !== false) window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", function() {
    showPage(currentPage());
  });

  showPage(currentPage(), false);

  /* ---------- angka dari teks "Rp 1.234" ---------- */
  function readRp(el) {
    if (!el) return 0;
    const m = /(-?)\s*Rp\s?(-?)([\d.]+)/.exec(el.textContent || "");
    if (!m) return 0;
    const v = Number(m[3].replace(/\./g, "")) || 0;
    return (m[1] || m[2]) ? -v : v;
  }

  function finalValue(el) {
    // fx.js menyimpan nilai akhir animasi di __fxValue
    if (el && typeof el.__fxValue === "number") return el.__fxValue;
    return readRp(el);
  }

  function rp(value) {
    return "Rp " + Math.round(value).toLocaleString("id-ID");
  }

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function watch(sourceId, update) {
    const src = document.getElementById(sourceId);
    if (!src) return;
    // ditunda sebentar supaya fx.js sempat mencatat nilai akhir (__fxValue)
    let pending = false;
    const run = function() {
      if (pending) return;
      pending = true;
      setTimeout(function() { pending = false; update(src); }, 0);
    };
    new MutationObserver(run).observe(src, { childList: true, characterData: true, subtree: true });
    run();
  }

  /* ---------- kartu salinan di Home ---------- */
  function mirror(sourceId, targetId) {
    const target = document.getElementById(targetId);
    watch(sourceId, function(src) {
      setText(target, rp(finalValue(src)));
    });
  }

  mirror("kasSaldo", "dashKasSaldo");
  mirror("kasLoan", "dashKasLoan");
  mirror("kasLoanSisa", "dashKasLoanSisa");

  watch("kasLoan", function(src) {
    setText(document.getElementById("dashKasLoanInfo"), "Total loan " + rp(finalValue(src)));
  });

  /* ---------- bar perbandingan Aldo vs Glena ---------- */
  function updateShare() {
    const aldo = Math.max(0, finalValue(document.getElementById("totalB")));
    const glena = Math.max(0, finalValue(document.getElementById("totalAC")));
    const sum = aldo + glena;
    const pa = sum > 0 ? Math.round((aldo / sum) * 100) : 50;
    const pg = sum > 0 ? 100 - pa : 50;

    const barA = document.getElementById("shareAldoBar");
    const barG = document.getElementById("shareGlenaBar");
    if (barA) barA.style.width = pa + "%";
    if (barG) barG.style.width = pg + "%";
    setText(document.getElementById("shareAldoPct"), sum > 0 ? pa + "%" : "-");
    setText(document.getElementById("shareGlenaPct"), sum > 0 ? pg + "%" : "-");
  }

  watch("totalB", updateShare);
  watch("totalAC", updateShare);
})();
