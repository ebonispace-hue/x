// =====================================================
// PANEL OMSET SEWA PS — app.js FINAL
// Login Admin: 888999 | Master: 171717
// =====================================================

const firebaseConfig = {
  apiKey: "AIzaSyCWl_SOWyPuXUETZzXkGC8Cm_WhdqXTATg",
  authDomain: "ggyu-66f09.firebaseapp.com",
  databaseURL: "https://ggyu-66f09-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "ggyu-66f09",
  storageBucket: "ggyu-66f09.firebasestorage.app",
  messagingSenderId: "108449585539",
  appId: "1:108449585539:web:8dcfec087d7eddf5c83eb6"
};

const USERS = {
  "888999": { role: "Admin" },
  "171717": { role: "Master" }
};

const KAS_PERCENT = 0.05;
const TV_PRICE = 30000;
const TV_PRICE_12_JAM = 15000;
const MAX_FOTO_SIZE = 1.5 * 1024 * 1024;

let db = null;
let firebaseReady = false;
let firebaseErrorMsg = "";
let currentUser = null;
let allRentals = [];
let allExpenses = [];
let allKasTransactions = [];
let databaseListenersStarted = false;

const $ = (id) => document.getElementById(id);

const loginScreen = $("loginScreen");
const dashboardScreen = $("dashboardScreen");
const pinInput = $("pinInput");
const loginBtn = $("loginBtn");
const loginError = $("loginError");
const logoutBtn = $("logoutBtn");
const userRole = $("userRole");

const rentalForm = $("rentalForm");
const fotoInput = $("foto");
const fileName = $("fileName");
const previewContainer = $("previewContainer");
const fotoPreview = $("fotoPreview");
const removeFoto = $("removeFoto");
const submitBtn = $("submitBtn");

/* =========================
   MODAL PENGELUARAN
========================= */
const openExpenseModal = $("openExpenseModal");
const expenseModal = $("expenseModal");
const expenseModalOverlay = $("expenseModalOverlay");
const closeExpenseModal = $("closeExpenseModal");
const cancelExpense = $("cancelExpense");
const expenseForm = $("expenseForm");
const expenseNominal = $("expenseNominal");
const expenseKeterangan = $("expenseKeterangan");
const saveExpenseBtn = $("saveExpenseBtn");

/* =========================
   MODAL LOAN
========================= */
const openLoanModal = $("openLoanModal");
const loanModal = $("loanModal");
const loanModalOverlay = $("loanModalOverlay");
const closeLoanModal = $("closeLoanModal");
const cancelLoan = $("cancelLoan");
const loanForm = $("loanForm");
const loanNominal = $("loanNominal");
const loanKeterangan = $("loanKeterangan");
const saveLoanBtn = $("saveLoanBtn");

/* =========================
   MODAL BAYAR LOAN
========================= */
const openPayLoanModal = $("openPayLoanModal");
const payLoanModal = $("payLoanModal");
const payLoanModalOverlay = $("payLoanModalOverlay");
const closePayLoanModal = $("closePayLoanModal");
const cancelPayLoan = $("cancelPayLoan");
const payLoanForm = $("payLoanForm");
const payLoanSelect = $("payLoanSelect");
const payLoanNominal = $("payLoanNominal");
const payLoanSaldo = $("payLoanSaldo");
const payLoanInfo = $("payLoanInfo");
const savePayLoanBtn = $("savePayLoanBtn");
const autoPayLoanBtn = $("autoPayLoanBtn");

/* =========================
   HISTORY KAS & DOWNLOAD
========================= */
const toggleKasOrder = $("toggleKasOrder");
const kasOrderLabel = $("kasOrderLabel");
const downloadKasHistory = $("downloadKasHistory");
const downloadSelectedMonth = $("downloadSelectedMonth");
const downloadMonthlyDetail = $("downloadMonthlyDetail");
let kasOrderOldestFirst = true;
let currentDetailMonthKey = "";

const editModal = $("editModal");
const editForm = $("editForm");
const closeModal = $("closeModal");
const cancelEdit = $("cancelEdit");
const modalOverlay = $("modalOverlay");
const saveEditBtn = $("saveEditBtn");
const monthlySelect = $("monthlySelect");

const monthlyDetailModal = $("monthlyDetailModal");
const monthlyDetailOverlay = $("monthlyDetailOverlay");
const closeMonthlyDetailModal = $("closeMonthlyDetailModal");

const monthlyDetailTitle = $("monthlyDetailTitle");
const detailGross = $("detailGross");
const detailIncome = $("detailIncome");

const detailGlenaNet = $("detailGlenaNet");
const detailAldoNet = $("detailAldoNet");

const detailKas = $("detailKas");
const detailExpenses = $("detailExpenses");
const detailFinal = $("detailFinal");

const monthlyRentalDetailList = $("monthlyRentalDetailList");
const monthlyExpenseDetailList = $("monthlyExpenseDetailList");
const monthlyKasDetailList = $("monthlyKasDetailList");

const editExpenseModal = $("editExpenseModal");
const editExpenseModalOverlay = $("editExpenseModalOverlay");
const closeEditExpenseModal = $("closeEditExpenseModal");
const cancelEditExpense = $("cancelEditExpense");
const editExpenseForm = $("editExpenseForm");
const editExpenseId = $("editExpenseId");
const editExpenseNominal = $("editExpenseNominal");
const editExpenseKeterangan = $("editExpenseKeterangan");
const saveEditExpenseBtn = $("saveEditExpenseBtn");

const editKasModal = $("editKasModal");
const editKasModalOverlay = $("editKasModalOverlay");
const closeEditKasModal = $("closeEditKasModal");
const cancelEditKas = $("cancelEditKas");
const editKasForm = $("editKasForm");
const editKasId = $("editKasId");
const editKasJenis = $("editKasJenis");
const editKasNominal = $("editKasNominal");
const editKasKeterangan = $("editKasKeterangan");
const saveEditKasBtn = $("saveEditKasBtn");

function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      firebaseErrorMsg = "Library Firebase belum termuat.";
      return false;
    }

    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    db = firebase.database();
    firebaseReady = true;
    return true;
  } catch (error) {
    firebaseErrorMsg = error.message || String(error);
    firebaseReady = false;
    console.error("Firebase init error:", error);
    return false;
  }
}

function formatRp(value) {
  return "Rp " + Number(value || 0).toLocaleString("id-ID");
}

function formatDate(timestamp) {
  if (!timestamp) return "-";
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = String(value || "");
  return div.innerHTML;
}

function getMonthKey(timestamp) {
  const date = new Date(Number(timestamp || Date.now()));
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0");
}

function formatMonthKey(monthKey) {
  const parts = String(monthKey || "").split("-");
  if (parts.length !== 2) return monthKey || "-";

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric"
  }).format(new Date(Number(parts[0]), Number(parts[1]) - 1, 1));
}

/* Unit dengan sistem bagi hasil 30:30:40 (Kas 30% : Glena 30% : Aldo 40%) */
const UNIT_30_30_40 = ["E", "F", "G"];

function isUnit303040(unit) {
  return UNIT_30_30_40.indexOf(unit) !== -1;
}

function isMaster() {
  return currentUser && currentUser.role === "Master";
}

function getRentalGross(rental) {
  if (rental && rental.nominalKotor !== undefined) {
    return Number(rental.nominalKotor || 0);
  }

  return Number((rental && rental.nominal) || 0);
}

function getRentalKas(rental) {
  if (rental && rental.kasNominal !== undefined) {
    return Number(rental.kasNominal || 0);
  }

  return Math.round(getRentalGross(rental) * KAS_PERCENT);
}

function getPendapatanBersih(rental) {
  if (rental && rental.nominalKotor !== undefined) {
    return Number(rental.nominal || 0);
  }

  return getRentalGross(rental) - getRentalKas(rental);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function updateActiveMonthLabel() {
  const label = $("activeMonthLabel");
  if (label) label.textContent = formatMonthKey(getMonthKey(Date.now()));
}

function checkSession() {
  const saved = sessionStorage.getItem("ps_user");
  if (!saved) return;

  try {
    currentUser = JSON.parse(saved);

    if (!currentUser || !currentUser.role) {
      throw new Error("Session tidak valid");
    }

    showDashboard();
  } catch (error) {
    sessionStorage.removeItem("ps_user");
  }
}

function doLogin() {
  if (!pinInput) return;

  const pin = pinInput.value.trim();

  if (loginError) loginError.textContent = "";

  if (!USERS[pin]) {
    if (loginError) loginError.textContent = "PIN salah. Coba lagi.";
    pinInput.value = "";
    pinInput.focus();
    return;
  }

  currentUser = USERS[pin];
  sessionStorage.setItem("ps_user", JSON.stringify(currentUser));
  pinInput.value = "";
  showDashboard();
}

function showDashboard() {
  if (loginScreen) loginScreen.classList.add("hidden");
  if (dashboardScreen) dashboardScreen.classList.remove("hidden");
  if (userRole && currentUser) userRole.textContent = currentUser.role;

  updateActiveMonthLabel();

  if (!firebaseReady) initFirebase();

  if (!firebaseReady) {
    setText("totalAll", "Firebase Error");
    return;
  }

  startDatabaseListeners();
}

function startDatabaseListeners() {
  if (!db || databaseListenersStarted) return;

  databaseListenersStarted = true;

  db.ref("rentals").orderByChild("createdAt").on("value", function(snapshot) {
    const rentals = [];

    snapshot.forEach(function(child) {
      const data = child.val() || {};
      data.id = child.key;
      rentals.push(data);
    });

    rentals.sort(function(a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

    allRentals = rentals;
    updateDashboard();
    refreshExpenseSummary();
    refreshMonthlyRecap();
  }, databaseError);

  db.ref("expenses").orderByChild("createdAt").on("value", function(snapshot) {
    const expenses = [];

    snapshot.forEach(function(child) {
      const data = child.val() || {};
      data.id = child.key;
      expenses.push(data);
    });

    expenses.sort(function(a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

    allExpenses = expenses;
    renderExpenseHistory();
    refreshExpenseSummary();
    refreshMonthlyRecap();
  }, databaseError);

  db.ref("kasTransactions").orderByChild("createdAt").on("value", function(snapshot) {
    const kas = [];

    snapshot.forEach(function(child) {
      const data = child.val() || {};
      data.id = child.key;
      kas.push(data);
    });

    kas.sort(function(a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

    allKasTransactions = kas;
    renderKasSummary();
    refreshMonthlyRecap();
  }, databaseError);
}

function databaseError(error) {
  console.error("Firebase database error:", error);
}

function updateDashboard() {
  updateActiveMonthLabel();

  const currentMonth = getMonthKey(Date.now());
  const rentalsThisMonth = allRentals.filter(function(rental) {
    return getMonthKey(rental.createdAt) === currentMonth;
  });

  let totalAC = 0;
  let totalB = 0;
  let totalGross = 0;

 rentalsThisMonth.forEach(function(rental) {
  const gross = getRentalGross(rental);
  const net = getPendapatanBersih(rental);

  totalGross += gross;

  if (
    rental.psUnit === "A" ||
    rental.psUnit === "C" ||
    rental.psUnit === "TV_A"
  ) {
    totalAC += net;
  }

  if (
    rental.psUnit === "B" ||
    rental.psUnit === "TV_B"
  ) {
    totalB += net;
  }

  // TAMBAHAN KHUSUS PS D
  if (rental.psUnit === "D") {
    const bagianAldo = Math.floor(net / 2);
    const bagianGlena = net - bagianAldo;

    totalAC += bagianGlena;
    totalB += bagianAldo;
  }
   if (isUnit303040(rental.psUnit)) {
  const bagianGlena = rental.glenaNet !== undefined
    ? Number(rental.glenaNet || 0)
    : Math.round(gross * 0.30);

  const bagianAldo = rental.aldoNet !== undefined
    ? Number(rental.aldoNet || 0)
    : gross - Math.round(gross * 0.30) - bagianGlena;

  totalAC += bagianGlena;
  totalB += bagianAldo;
}
});

  setText("totalAC", formatRp(totalAC));
  setText("totalB", formatRp(totalB));
  setText("totalAll", formatRp(totalAC + totalB));
  setText("totalGross", formatRp(totalGross));

  renderLatestHistory();
  renderTopPenyewa(rentalsThisMonth);
}

function renderLatestHistory() {
  const latestEl = $("latestHistory");

  if (!latestEl) return;

  if (!allRentals.length) {
    latestEl.innerHTML = '<p class="empty">Belum ada data</p>';
    return;
  }

  latestEl.innerHTML = allRentals
  .filter(function(rental) {
    return getMonthKey(rental.createdAt) === getMonthKey(Date.now());
  })
  .map(function(rental) {

    const actions = isMaster()
      ? '<div class="item-actions">' +
          '<button class="btn-action btn-edit" data-id="' + rental.id + '" title="Edit transaksi">' +
            '<i class="fas fa-pen"></i>' +
          '</button>' +
          '<button class="btn-action btn-delete" data-id="' + rental.id + '" title="Hapus transaksi">' +
            '<i class="fas fa-trash"></i>' +
          '</button>' +
        '</div>'
      : "";

    return '<div class="history-item">' +
      (rental.fotoUrl
        ? '<img src="' + rental.fotoUrl + '" alt="Foto penyewa">'
        : '<div class="no-photo"><i class="fas fa-user"></i></div>') +
      '<div class="item-info">' +
        '<div class="nomor">' + escapeHtml(rental.nomorPenyewa) + '</div>' +
        '<div class="meta">PS ' + escapeHtml(rental.psUnit) + ' · ' +
          Number(rental.durasi || 0) + ' ' + escapeHtml(rental.durasiUnit || "jam") +
          ' · ' + formatDate(rental.createdAt) + '</div>' +
        '<div class="meta" style="color:#facc15; margin-top:4px;">' +
        'Omset kotor · Kas: ' + formatRp(getRentalKas(rental)) +
        '</div>' +
      '</div>' +
      '<div class="item-amount">' + formatRp(getRentalGross(rental)) + '</div>' +
      actions +
      '</div>';
  }).join("");

  if (isMaster()) {
    latestEl.querySelectorAll(".btn-edit").forEach(function(button) {
      button.addEventListener("click", function() {
        openEditModal(button.dataset.id);
      });
    });

    latestEl.querySelectorAll(".btn-delete").forEach(function(button) {
      button.addEventListener("click", function() {
        deleteRental(button.dataset.id);
      });
    });
  }
}

function renderTopPenyewa(rentals) {
  const topEl = $("topPenyewa");
  if (!topEl) return;

  const countMap = {};

  rentals.forEach(function(rental) {
    const key = rental.nomorPenyewa || "-";

    if (!countMap[key]) {
      countMap[key] = {
        nomor: key,
        count: 0,
        total: 0,
        lastFoto: rental.fotoUrl || ""
      };
    }

    countMap[key].count += 1;
    countMap[key].total += getPendapatanBersih(rental);

    if (rental.fotoUrl) countMap[key].lastFoto = rental.fotoUrl;
  });

  const sorted = Object.values(countMap).sort(function(a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return b.total - a.total;
  });

  if (!sorted.length) {
    topEl.innerHTML = '<p class="empty">Belum ada transaksi pada bulan ini</p>';
    return;
  }

  topEl.innerHTML = sorted.slice(0, 10).map(function(item, index) {
    const rankClass = index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "bronze" : "";

    return '<div class="history-item">' +
      '<div class="rank-badge ' + rankClass + '">' + (index + 1) + '</div>' +
      (item.lastFoto
        ? '<img src="' + item.lastFoto + '" alt="Foto penyewa">'
        : '<div class="no-photo"><i class="fas fa-user"></i></div>') +
      '<div class="item-info">' +
        '<div class="nomor">' + escapeHtml(item.nomor) + '</div>' +
        '<div class="meta">' + item.count + 'x sewa · Total ' + formatRp(item.total) + '</div>' +
      '</div>' +
      '</div>';
  }).join("");
}

function getKasFallbackFromRentals() {
  const rentalIdWithKas = new Set();

  allKasTransactions.forEach(function(kas) {
    if (kas && kas.rentalId) {
      rentalIdWithKas.add(kas.rentalId);
    }
  });

  let total = 0;

  allRentals.forEach(function(rental) {
    if (!rentalIdWithKas.has(rental.id)) {
      total += getRentalKas(rental);
    }
  });

  return total;
}

function getKasVirtualHistory() {
  const rentalIdWithKas = new Set();

  allKasTransactions.forEach(function(kas) {
    if (kas && kas.rentalId) {
      rentalIdWithKas.add(kas.rentalId);
    }
  });

  return allRentals
    .filter(function(rental) {
      return !rentalIdWithKas.has(rental.id);
    })
    .map(function(rental) {
      return {
        id: "virtual_" + rental.id,
        virtual: true,
        jenis: "masuk",
        nominal: getRentalKas(rental),
        keterangan: "Kas 5% dari transaksi lama PS " + (rental.psUnit || "-"),
        createdAt: rental.createdAt,
        rentalId: rental.id
      };
    });
}

function getKasLabel(kas) {
  if (kas.sumber === "loan") return "Loan Masuk";
  if (kas.sumber === "bayar_loan") return "Bayar Loan";
  return kas.jenis === "masuk" ? "Kas Masuk" : "Kas Keluar";
}

function sortByCreatedAsc(a, b) {
  const diff = Number(a.createdAt || 0) - Number(b.createdAt || 0);
  if (diff !== 0) return diff;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

/* Semua transaksi kas (termasuk kas virtual dari transaksi lama),
   urut dari yang PALING AWAL, lengkap dengan saldo setelah transaksi. */
function getKasLedger() {
  let saldo = 0;

  return allKasTransactions
    .concat(getKasVirtualHistory())
    .sort(sortByCreatedAsc)
    .map(function(kas, index) {
      const nominal = Number(kas.nominal || 0);
      saldo += kas.jenis === "masuk" ? nominal : -nominal;

      return Object.assign({}, kas, {
        urutan: index + 1,
        saldoSetelah: saldo
      });
    });
}

function getSaldoKas() {
  const ledger = getKasLedger();
  return ledger.length ? ledger[ledger.length - 1].saldoSetelah : 0;
}

/* Status setiap loan: total, sudah dibayar, sisa */
function getLoanStatuses() {
  const paidMap = {};

  allKasTransactions.forEach(function(kas) {
    if (kas.sumber === "bayar_loan" && kas.loanId) {
      paidMap[kas.loanId] = (paidMap[kas.loanId] || 0) + Number(kas.nominal || 0);
    }
  });

  return allKasTransactions
    .filter(function(kas) {
      return kas.sumber === "loan";
    })
    .sort(sortByCreatedAsc)
    .map(function(loan) {
      const total = Number(loan.nominal || 0);
      const dibayar = paidMap[loan.id] || 0;
      const sisa = Math.max(0, total - dibayar);

      return {
        id: loan.id,
        loan: loan,
        keterangan: String(loan.keterangan || "Loan").replace(/^Loan:\s*/, ""),
        total: total,
        dibayar: dibayar,
        sisa: sisa,
        lunas: sisa <= 0
      };
    });
}

function renderKasSummary() {
  let kasMasukTersimpan = 0;
  let kasLoan = 0;
  let kasKeluar = 0;

  allKasTransactions.forEach(function(kas) {
    const nominal = Number(kas.nominal || 0);

    if (kas.jenis === "masuk") {
      kasMasukTersimpan += nominal;
    }

    if (kas.sumber === "loan") {
      kasLoan += nominal;
    }

    if (kas.jenis === "keluar") {
      kasKeluar += nominal;
    }
  });

  const kasDariTransaksiLama = getKasFallbackFromRentals();
  const totalKasMasuk = kasMasukTersimpan + kasDariTransaksiLama;

  const loans = getLoanStatuses();
  const loanDibayar = loans.reduce(function(t, l) { return t + l.dibayar; }, 0);
  const loanSisa = loans.reduce(function(t, l) { return t + l.sisa; }, 0);

  setText("kasLoan", formatRp(kasLoan));
  setText("kasLoanSisa", formatRp(loanSisa));
  setText("kasLoanDibayar", "Sudah dibayar " + formatRp(loanDibayar));
  setText("kasMasuk", formatRp(totalKasMasuk));
  setText("kasKeluar", formatRp(kasKeluar));
  setText("kasSaldo", formatRp(totalKasMasuk - kasKeluar));

  renderKasHistory();
  renderLoanList();
}

function renderKasHistory() {
  const history = $("kasHistory");
  if (!history) return;

  const ledger = getKasLedger();

  if (kasOrderLabel) {
    kasOrderLabel.textContent = kasOrderOldestFirst ? "Terlama dulu" : "Terbaru dulu";
  }

  const info = $("kasHistoryInfo");
  if (info) {
    info.textContent = ledger.length
      ? ledger.length + " transaksi sejak " + formatDate(ledger[0].createdAt) +
        ". Saldo di kanan = saldo kas setelah transaksi tersebut."
      : "Semua transaksi kas sejak awal, lengkap dengan saldo setelah transaksi.";
  }

  if (!ledger.length) {
    history.innerHTML = '<p class="empty">Belum ada transaksi kas</p>';
    return;
  }

  const rows = kasOrderOldestFirst ? ledger : ledger.slice().reverse();

  history.innerHTML = rows.map(function(kas) {
    const masuk = kas.jenis === "masuk";
    const actions = isMaster() && !kas.virtual
      ? '<div class="item-actions">' +
          '<button class="btn-action btn-edit btn-edit-kas" data-id="' + kas.id + '" title="Edit kas">' +
          '<i class="fas fa-pen"></i>' +
          '</button>' +
          '<button class="btn-action btn-delete btn-delete-kas" data-id="' + kas.id + '" title="Hapus kas">' +
          '<i class="fas fa-trash"></i>' +
          '</button>' +
        '</div>'
      : "";

    const status = kas.virtual
      ? '<div class="meta" style="color:#facc15; margin-top:3px;">Kas sementara dari transaksi lama</div>'
      : "";

    return '<div class="history-item">' +
      '<div class="kas-row-number">#' + kas.urutan + '</div>' +
      '<div class="rank-badge ' + (masuk ? "gold" : "bronze") + '">' +
        (masuk ? '<i class="fas fa-arrow-down"></i>' : '<i class="fas fa-arrow-up"></i>') +
      '</div>' +
      '<div class="item-info">' +
        '<div class="nomor">' + getKasLabel(kas) + '</div>' +
        '<div class="meta">' +
          escapeHtml(kas.keterangan || "-") +
          ' · ' + formatDate(kas.createdAt) +
        '</div>' +
        status +
      '</div>' +
      '<div class="kas-amount-col">' +
        '<div class="item-amount" style="color:' + (masuk ? "#5eead4" : "#fb7185") + ';">' +
          (masuk ? "+" : "-") + formatRp(kas.nominal) +
        '</div>' +
        '<span class="kas-saldo-after">Saldo ' + formatRp(kas.saldoSetelah) + '</span>' +
      '</div>' +
      actions +
      '</div>';
  }).join("");
}

/* Event delegation: tidak perlu pasang listener ulang setiap render */
(function setupKasHistoryEvents() {
  const history = $("kasHistory");
  if (!history) return;

  history.addEventListener("click", function(event) {
    const editBtn = event.target.closest(".btn-edit-kas");
    const deleteBtn = event.target.closest(".btn-delete-kas");

    if (editBtn) openEditKasModal(editBtn.dataset.id);
    if (deleteBtn) deleteKasTransaction(deleteBtn.dataset.id);
  });
})();

if (toggleKasOrder) {
  toggleKasOrder.addEventListener("click", function() {
    kasOrderOldestFirst = !kasOrderOldestFirst;
    renderKasHistory();
  });
}

/* =========================
   DAFTAR & PEMBAYARAN LOAN
========================= */
function renderLoanList() {
  const list = $("loanList");
  if (!list) return;

  const loans = getLoanStatuses();
  const adaSisa = loans.some(function(l) { return !l.lunas; });

  if (autoPayLoanBtn) autoPayLoanBtn.disabled = !adaSisa;
  if (openPayLoanModal) openPayLoanModal.disabled = !adaSisa;

  if (!loans.length) {
    list.innerHTML = '<p class="empty">Belum ada loan</p>';
    return;
  }

  list.innerHTML = loans.slice().reverse().map(function(item) {
    const persen = item.total > 0 ? Math.min(100, Math.round(item.dibayar / item.total * 100)) : 100;

    return '<div class="history-item">' +
      '<div class="rank-badge ' + (item.lunas ? "gold" : "bronze") + '">' +
        '<i class="fas ' + (item.lunas ? "fa-check" : "fa-hand-holding-dollar") + '"></i>' +
      '</div>' +
      '<div class="item-info">' +
        '<div class="nomor">' + escapeHtml(item.keterangan) +
          '<span class="loan-badge ' + (item.lunas ? "lunas" : "belum") + '">' +
            (item.lunas ? "LUNAS" : "BELUM LUNAS") +
          '</span>' +
        '</div>' +
        '<div class="meta">' +
          formatDate(item.loan.createdAt) +
          ' · Dibayar ' + formatRp(item.dibayar) + ' dari ' + formatRp(item.total) +
        '</div>' +
        '<div class="loan-progress"><span style="width:' + persen + '%"></span></div>' +
      '</div>' +
      '<div class="kas-amount-col">' +
        '<div class="item-amount">' + formatRp(item.sisa) + '</div>' +
        '<span class="kas-saldo-after">sisa</span>' +
      '</div>' +
      (item.lunas
        ? ""
        : '<div class="item-actions">' +
            '<button class="btn-action btn-pay-loan" data-id="' + item.id + '" title="Bayar dari kas">' +
              '<i class="fas fa-money-check-dollar"></i>' +
            '</button>' +
          '</div>') +
      '</div>';
  }).join("");
}

(function setupLoanListEvents() {
  const list = $("loanList");
  if (!list) return;

  list.addEventListener("click", function(event) {
    const payBtn = event.target.closest(".btn-pay-loan");
    if (payBtn) openPayLoanModalForm(payBtn.dataset.id);
  });
})();

function updatePayLoanInfo() {
  if (!payLoanSelect || !payLoanInfo) return;

  const loan = getLoanStatuses().find(function(l) {
    return l.id === payLoanSelect.value;
  });

  const saldo = getSaldoKas();

  if (payLoanSaldo) payLoanSaldo.textContent = formatRp(saldo);

  if (!loan) {
    payLoanInfo.innerHTML = '<i class="fas fa-circle-info"></i> Pilih loan yang akan dibayar.';
    return;
  }

  const maxBayar = Math.max(0, Math.min(loan.sisa, saldo));

  if (payLoanNominal) payLoanNominal.max = String(maxBayar || "");

  payLoanInfo.innerHTML = '<i class="fas fa-circle-info"></i> ' +
    'Sisa loan ' + formatRp(loan.sisa) + '. Maksimal bisa dibayar sekarang ' + formatRp(maxBayar) +
    ' (dibatasi saldo kas). Nominal otomatis dipotong dari saldo kas.';
}

function openPayLoanModalForm(loanId) {
  if (!payLoanModal || !payLoanSelect) return;

  const outstanding = getLoanStatuses().filter(function(l) {
    return !l.lunas;
  });

  if (!outstanding.length) {
    alert("Semua loan sudah lunas.");
    return;
  }

  payLoanSelect.innerHTML = outstanding.map(function(l) {
    return '<option value="' + l.id + '">' +
      escapeHtml(l.keterangan) + ' — sisa ' + formatRp(l.sisa) +
      '</option>';
  }).join("");

  const target = outstanding.find(function(l) { return l.id === loanId; }) || outstanding[0];
  payLoanSelect.value = target.id;

  const saldo = getSaldoKas();
  if (payLoanNominal) payLoanNominal.value = Math.max(0, Math.min(target.sisa, saldo)) || "";

  updatePayLoanInfo();
  payLoanModal.classList.remove("hidden");
}

function closePayLoanModalForm() {
  if (payLoanModal) payLoanModal.classList.add("hidden");
  if (payLoanForm) payLoanForm.reset();
}

if (openPayLoanModal) openPayLoanModal.addEventListener("click", function() { openPayLoanModalForm(""); });
if (closePayLoanModal) closePayLoanModal.addEventListener("click", closePayLoanModalForm);
if (cancelPayLoan) cancelPayLoan.addEventListener("click", closePayLoanModalForm);
if (payLoanModalOverlay) payLoanModalOverlay.addEventListener("click", closePayLoanModalForm);

if (payLoanSelect) {
  payLoanSelect.addEventListener("change", function() {
    const loan = getLoanStatuses().find(function(l) { return l.id === payLoanSelect.value; });
    if (loan && payLoanNominal) {
      payLoanNominal.value = Math.max(0, Math.min(loan.sisa, getSaldoKas())) || "";
    }
    updatePayLoanInfo();
  });
}

function buildLoanPaymentUpdate(updates, loanStatus, nominal, waktu, catatan) {
  const ref = db.ref("kasTransactions").push();

  updates["kasTransactions/" + ref.key] = {
    jenis: "keluar",
    nominal: nominal,
    keterangan: "Bayar loan: " + loanStatus.keterangan + (catatan ? " (" + catatan + ")" : ""),
    sumber: "bayar_loan",
    loanId: loanStatus.id,
    createdAt: waktu,
    createdBy: currentUser ? currentUser.role : "Admin",
    monthKey: getMonthKey(waktu)
  };
}

if (payLoanForm) {
  payLoanForm.addEventListener("submit", function(event) {
    event.preventDefault();

    if (!firebaseReady) initFirebase();
    if (!firebaseReady || !db) {
      alert("Firebase belum siap: " + firebaseErrorMsg);
      return;
    }

    const loan = getLoanStatuses().find(function(l) {
      return l.id === (payLoanSelect ? payLoanSelect.value : "");
    });
    const nominal = Number(payLoanNominal ? payLoanNominal.value : 0);
    const saldo = getSaldoKas();

    if (!loan) {
      alert("Pilih loan yang akan dibayar.");
      return;
    }

    if (!nominal || nominal <= 0) {
      alert("Isi nominal pembayaran.");
      return;
    }

    if (nominal > loan.sisa) {
      alert("Nominal melebihi sisa loan (" + formatRp(loan.sisa) + ").");
      return;
    }

    if (nominal > saldo) {
      alert("Saldo kas tidak cukup.\n\nSaldo kas: " + formatRp(saldo) + "\nNominal: " + formatRp(nominal));
      return;
    }

    if (savePayLoanBtn) {
      savePayLoanBtn.disabled = true;
      savePayLoanBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    }

    const updates = {};
    const lunas = nominal >= loan.sisa;
    buildLoanPaymentUpdate(updates, loan, nominal, Date.now(), lunas ? "lunas" : "cicilan");

    db.ref().update(updates)
      .then(function() {
        closePayLoanModalForm();
        alert(
          "Pembayaran loan berhasil, diambil dari kas.\n\n" +
          "Dibayar: " + formatRp(nominal) + "\n" +
          "Sisa loan: " + formatRp(loan.sisa - nominal) + "\n" +
          "Saldo kas sekarang: " + formatRp(saldo - nominal)
        );
      })
      .catch(function(error) {
        alert("Gagal membayar loan: " + error.message);
      })
      .finally(function() {
        if (savePayLoanBtn) {
          savePayLoanBtn.disabled = false;
          savePayLoanBtn.innerHTML = '<i class="fas fa-check"></i> Bayar dari Kas';
        }
      });
  });
}

/* Bayar otomatis: pakai saldo kas yang ada untuk melunasi loan terlama dulu */
function autoPayLoansFromKas() {
  if (!firebaseReady) initFirebase();
  if (!firebaseReady || !db) {
    alert("Firebase belum siap: " + firebaseErrorMsg);
    return;
  }

  const outstanding = getLoanStatuses().filter(function(l) { return !l.lunas; });
  let saldo = getSaldoKas();

  if (!outstanding.length) {
    alert("Semua loan sudah lunas.");
    return;
  }

  if (saldo <= 0) {
    alert("Saldo kas kosong, belum bisa bayar loan.");
    return;
  }

  const rencana = [];

  outstanding.forEach(function(loan) {
    if (saldo <= 0) return;
    const bayar = Math.min(loan.sisa, saldo);
    saldo -= bayar;
    rencana.push({ loan: loan, bayar: bayar });
  });

  const totalBayar = rencana.reduce(function(t, r) { return t + r.bayar; }, 0);
  const rincian = rencana.map(function(r) {
    return "• " + r.loan.keterangan + ": " + formatRp(r.bayar) +
      (r.bayar >= r.loan.sisa ? " (lunas)" : " (sebagian)");
  }).join("\n");

  if (!confirm(
    "Bayar loan otomatis dari kas?\n\n" + rincian +
    "\n\nTotal diambil dari kas: " + formatRp(totalBayar) +
    "\nSaldo kas setelahnya: " + formatRp(saldo)
  )) return;

  const updates = {};
  const waktu = Date.now();

  rencana.forEach(function(r, i) {
    buildLoanPaymentUpdate(updates, r.loan, r.bayar, waktu + i, "otomatis");
  });

  if (autoPayLoanBtn) autoPayLoanBtn.disabled = true;

  db.ref().update(updates)
    .then(function() {
      alert("Pembayaran loan otomatis berhasil.\nTotal: " + formatRp(totalBayar));
    })
    .catch(function(error) {
      alert("Gagal bayar loan otomatis: " + error.message);
    })
    .finally(function() {
      renderLoanList();
    });
}

if (autoPayLoanBtn) autoPayLoanBtn.addEventListener("click", autoPayLoansFromKas);

function resetFotoInput() {
  if (fotoInput) fotoInput.value = "";
  if (fotoPreview) fotoPreview.src = "";
  if (fileName) fileName.textContent = "Pilih Foto dari Galeri / Kamera";
  if (previewContainer) previewContainer.classList.add("hidden");
}

if (fotoInput) {
  fotoInput.addEventListener("change", function(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      alert("File harus berupa gambar.");
      resetFotoInput();
      return;
    }

    if (file.size > MAX_FOTO_SIZE) {
      alert("Ukuran foto maksimal 1.5 MB.");
      resetFotoInput();
      return;
    }

    if (fileName) fileName.textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(loadEvent) {
      if (fotoPreview) fotoPreview.src = loadEvent.target.result;
      if (previewContainer) previewContainer.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });
}

if (removeFoto) removeFoto.addEventListener("click", resetFotoInput);

if (rentalForm) {
  rentalForm.addEventListener("submit", function(event) {
    event.preventDefault();

    if (!firebaseReady) initFirebase();

    if (!firebaseReady || !db) {
      alert("Firebase belum siap: " + firebaseErrorMsg);
      return;
    }

    const nomorEl = $("nomorPenyewa");
    const psUnitEl = $("psUnit");
    const durasiEl = $("durasi");
    const durasiUnitEl = $("durasiUnit");
    const nominalEl = $("nominal");

    const nomor = nomorEl ? nomorEl.value.trim() : "";
    const psUnit = psUnitEl ? psUnitEl.value : "";
    const durasi = durasiEl ? Number(durasiEl.value) : 0;
    const durasiUnit = durasiUnitEl ? durasiUnitEl.value : "jam";
   const nominalKotor = nominalEl ? Number(nominalEl.value) : 0;

const tvUnitEl = $("tvUnit");
const tvUnit = tvUnitEl ? tvUnitEl.value : "";

const file = fotoInput && fotoInput.files ? fotoInput.files[0] : null;

    if (!nomor || !psUnit || !durasi || !nominalKotor) {
      alert("Lengkapi semua form sewa.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }

    function finish() {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Sewa';
      }
    }

    function saveData(fotoUrl) {
  const rentalRef = db.ref("rentals").push();
  const kasRef = db.ref("kasTransactions").push();
  const waktu = Date.now();

  let kasNominal = Math.round(nominalKotor * KAS_PERCENT);
  let pendapatanBersih = nominalKotor - kasNominal;
  let kasPersen = 5;

  if (isUnit303040(psUnit)) {
    kasNominal = Math.round(nominalKotor * 0.30);
    pendapatanBersih = nominalKotor - kasNominal;
    kasPersen = 30;
  }

  const monthKey = getMonthKey(waktu);
  const updates = {};

  const bagianAldoPS_D = psUnit === "D"
    ? Math.floor(pendapatanBersih / 2)
    : 0;

  const bagianGlenaPS_D = psUnit === "D"
    ? pendapatanBersih - bagianAldoPS_D
    : 0;

  const bagianGlenaPS_E = isUnit303040(psUnit)
    ? Math.round(nominalKotor * 0.30)
    : 0;

  const bagianAldoPS_E = isUnit303040(psUnit)
    ? nominalKotor - kasNominal - bagianGlenaPS_E
    : 0;

  updates["rentals/" + rentalRef.key] = {
    nomorPenyewa: nomor,
    psUnit: psUnit,
    durasi: durasi,
    durasiUnit: durasiUnit,
    nominalKotor: nominalKotor,

    kasPersen: kasPersen,
    kasNominal: kasNominal,
    nominal: pendapatanBersih,

    owner:
      psUnit === "D" || isUnit303040(psUnit)
        ? "Aldo Laras & Adan Glena"
        : "",

    sistemBagiHasil:
      psUnit === "D"
        ? "50:50"
        : (isUnit303040(psUnit) ? "30:30:40" : ""),

    aldoNet:
      psUnit === "D"
        ? bagianAldoPS_D
        : bagianAldoPS_E,

    glenaNet:
      psUnit === "D"
        ? bagianGlenaPS_D
        : bagianGlenaPS_E,


        
        fotoUrl: fotoUrl || "",
        createdAt: waktu,
        createdBy: currentUser ? currentUser.role : "Admin",
        monthKey: monthKey
      };

      updates["kasTransactions/" + kasRef.key] = {
        jenis: "masuk",
        nominal: kasNominal,
       persentase: kasPersen,
keterangan: "Kas dari sewa PS " + psUnit,
        sumber: "sewa_otomatis",
        rentalId: rentalRef.key,
        createdAt: waktu,
        createdBy: currentUser ? currentUser.role : "Admin",
        monthKey: monthKey
      };
      
      const tvPackages = {
  TV_A_12JAM: {
    unit: "TV_A",
    durasi: 12,
    durasiUnit: "jam",
    nominal: TV_PRICE_12_JAM,
    owner: "Adan Glena"
  },

  TV_A_1: {
    unit: "TV_A",
    durasi: 1,
    durasiUnit: "hari",
    nominal: TV_PRICE * 1,
    owner: "Adan Glena"
  },

  TV_A_2: {
    unit: "TV_A",
    durasi: 2,
    durasiUnit: "hari",
    nominal: TV_PRICE * 2,
    owner: "Adan Glena"
  },

  TV_A_3: {
    unit: "TV_A",
    durasi: 3,
    durasiUnit: "hari",
    nominal: TV_PRICE * 3,
    owner: "Adan Glena"
  },

  TV_A_4: {
    unit: "TV_A",
    durasi: 4,
    durasiUnit: "hari",
    nominal: TV_PRICE * 4,
    owner: "Adan Glena"
  },

  TV_B_12JAM: {
    unit: "TV_B",
    durasi: 12,
    durasiUnit: "jam",
    nominal: TV_PRICE_12_JAM,
    owner: "Aldo Laras"
  },

  TV_B_1: {
    unit: "TV_B",
    durasi: 1,
    durasiUnit: "hari",
    nominal: TV_PRICE * 1,
    owner: "Aldo Laras"
  },

  TV_B_2: {
    unit: "TV_B",
    durasi: 2,
    durasiUnit: "hari",
    nominal: TV_PRICE * 2,
    owner: "Aldo Laras"
  },

  TV_B_3: {
    unit: "TV_B",
    durasi: 3,
    durasiUnit: "hari",
    nominal: TV_PRICE * 3,
    owner: "Aldo Laras"
  },

  TV_B_4: {
    unit: "TV_B",
    durasi: 4,
    durasiUnit: "hari",
    nominal: TV_PRICE * 4,
    owner: "Aldo Laras"
  }
};

const selectedTv = tvPackages[tvUnit];

if (selectedTv) {
  const tvRentalRef = db.ref("rentals").push();
  const tvKasRef = db.ref("kasTransactions").push();

  const tvKasNominal = Math.round(selectedTv.nominal * KAS_PERCENT);
  const tvPendapatanBersih = selectedTv.nominal - tvKasNominal;

  updates["rentals/" + tvRentalRef.key] = {
    nomorPenyewa: nomor,
    psUnit: selectedTv.unit,
    durasi: selectedTv.durasi,
    durasiUnit: selectedTv.durasiUnit,
    nominalKotor: selectedTv.nominal,
    kasPersen: 5,
    kasNominal: tvKasNominal,
    nominal: tvPendapatanBersih,
    fotoUrl: fotoUrl || "",
    createdAt: waktu,
    createdBy: currentUser ? currentUser.role : "Admin",
    monthKey: monthKey,
    owner: selectedTv.owner,
    sumberUnit: "tv_otomatis"
  };

  updates["kasTransactions/" + tvKasRef.key] = {
    jenis: "masuk",
    nominal: tvKasNominal,
    persentase: 5,
    keterangan: "Kas 5% dari sewa " +
      selectedTv.unit.replace("_", " ") +
      " · " + selectedTv.durasi + " " +
      selectedTv.durasiUnit +
      " · " + selectedTv.owner,
    sumber: "sewa_tv_otomatis",
    rentalId: tvRentalRef.key,
    createdAt: waktu,
    createdBy: currentUser ? currentUser.role : "Admin",
    monthKey: monthKey
  };
}
      
      db.ref().update(updates)
        .then(function() {
          rentalForm.reset();
          resetFotoInput();
          alert("Sewa berhasil disimpan!\n\nKas " + kasPersen + "%: " + formatRp(kasNominal) + "\nPendapatan bersih: " + formatRp(pendapatanBersih));
        })
        .catch(function(error) {
          alert("Gagal menyimpan sewa: " + error.message);
        })
        .finally(finish);
    }

    if (file) {
      const reader = new FileReader();
      reader.onload = function(loadEvent) {
        saveData(loadEvent.target.result);
      };
      reader.onerror = function() {
        alert("Foto gagal dibaca.");
        finish();
      };
      reader.readAsDataURL(file);
    } else {
      saveData("");
    }
  });
}

function openExpenseModalForm() {
  if (!expenseModal) return;
  if (expenseForm) expenseForm.reset();
  expenseModal.classList.remove("hidden");
}

function closeExpenseModalForm() {
  if (expenseModal) expenseModal.classList.add("hidden");
  if (expenseForm) expenseForm.reset();
}

if (openExpenseModal) openExpenseModal.addEventListener("click", openExpenseModalForm);
if (closeExpenseModal) closeExpenseModal.addEventListener("click", closeExpenseModalForm);
if (cancelExpense) cancelExpense.addEventListener("click", closeExpenseModalForm);
if (expenseModalOverlay) expenseModalOverlay.addEventListener("click", closeExpenseModalForm);

if (expenseForm) {
  expenseForm.addEventListener("submit", function(event) {
    event.preventDefault();
    if (!db) return;

    const nominalExpense = Number(expenseNominal ? expenseNominal.value : 0);
    const keterangan = expenseKeterangan ? expenseKeterangan.value.trim() : "";

    if (!nominalExpense || nominalExpense <= 0 || !keterangan) {
      alert("Lengkapi nominal dan keterangan pengeluaran.");
      return;
    }

    if (saveExpenseBtn) {
      saveExpenseBtn.disabled = true;
      saveExpenseBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }

    const expenseRef = db.ref("expenses").push();
    const kasRef = db.ref("kasTransactions").push();
    const waktu = Date.now();
    const monthKey = getMonthKey(waktu);
    const updates = {};

    updates["expenses/" + expenseRef.key] = {
      kategori: "Pengeluaran Usaha",
      nominal: nominalExpense,
      keterangan: keterangan,
      createdAt: waktu,
      createdBy: currentUser ? currentUser.role : "Admin",
      monthKey: monthKey
    };

    updates["kasTransactions/" + kasRef.key] = {
      jenis: "keluar",
      nominal: nominalExpense,
      keterangan: "Pengeluaran: " + keterangan,
      sumber: "pengeluaran",
      expenseId: expenseRef.key,
      createdAt: waktu,
      createdBy: currentUser ? currentUser.role : "Admin",
      monthKey: monthKey
    };

    db.ref().update(updates)
      .then(function() {
        closeExpenseModalForm();
        alert("Pengeluaran berhasil disimpan.");
      })
      .catch(function(error) {
        alert("Gagal menyimpan pengeluaran: " + error.message);
      })
           .finally(function() {
        if (saveExpenseBtn) {
          saveExpenseBtn.disabled = false;
          saveExpenseBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Pengeluaran';
        }
      });
  });
}

/* =========================
   MODAL & SIMPAN LOAN
========================= */

function openLoanModalForm() {
  if (!loanModal) return;

  if (loanForm) loanForm.reset();
  loanModal.classList.remove("hidden");
}

function closeLoanModalForm() {
  if (loanModal) loanModal.classList.add("hidden");
  if (loanForm) loanForm.reset();
}

if (openLoanModal) {
  openLoanModal.addEventListener("click", openLoanModalForm);
}

if (closeLoanModal) {
  closeLoanModal.addEventListener("click", closeLoanModalForm);
}

if (cancelLoan) {
  cancelLoan.addEventListener("click", closeLoanModalForm);
}

if (loanModalOverlay) {
  loanModalOverlay.addEventListener("click", closeLoanModalForm);
}

if (loanForm) {
  loanForm.addEventListener("submit", function(event) {
    event.preventDefault();

    if (!firebaseReady) initFirebase();

    if (!firebaseReady || !db) {
      alert("Firebase belum siap: " + firebaseErrorMsg);
      return;
    }

    const nominal = Number(loanNominal ? loanNominal.value : 0);
    const keterangan = loanKeterangan ? loanKeterangan.value.trim() : "";

    if (!nominal || nominal <= 0 || !keterangan) {
      alert("Lengkapi nominal dan keterangan loan.");
      return;
    }

    if (saveLoanBtn) {
      saveLoanBtn.disabled = true;
      saveLoanBtn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }

    const loanRef = db.ref("kasTransactions").push();
    const waktu = Date.now();

    const dataLoan = {
      jenis: "masuk",
      nominal: nominal,
      keterangan: "Loan: " + keterangan,
      sumber: "loan",
      createdAt: waktu,
      createdBy: currentUser ? currentUser.role : "Admin",
      monthKey: getMonthKey(waktu)
    };

    db.ref("kasTransactions/" + loanRef.key).set(dataLoan)
      .then(function() {
        closeLoanModalForm();
        alert("Loan berhasil ditambahkan ke kas.");
      })
      .catch(function(error) {
        console.error("Gagal simpan loan:", error);
        alert("Gagal menyimpan loan: " + error.message);
      })
      .finally(function() {
        if (saveLoanBtn) {
          saveLoanBtn.disabled = false;
          saveLoanBtn.innerHTML =
            '<i class="fas fa-save"></i> Simpan Loan';
        }
      });
  });
}

function renderExpenseHistory() {
  const history = $("expenseHistory");
  if (!history) return;
  

  history.innerHTML = allExpenses.slice(0, 10).map(function(expense) {
    const actions = isMaster()
      ? '<div class="item-actions">' +
          '<button class="btn-action btn-edit btn-edit-expense" data-id="' + expense.id + '" title="Edit pengeluaran">' +
          '<i class="fas fa-pen"></i>' +
          '</button>' +
          '<button class="btn-action btn-delete btn-delete-expense" data-id="' + expense.id + '" title="Hapus pengeluaran">' +
          '<i class="fas fa-trash"></i>' +
          '</button>' +
        '</div>'
      : "";

    return '<div class="history-item">' +
      '<div class="rank-badge bronze"><i class="fas fa-arrow-up"></i></div>' +
      '<div class="item-info">' +
        '<div class="nomor">Pengeluaran Usaha</div>' +
        '<div class="meta">' + escapeHtml(expense.keterangan) + ' · ' + formatDate(expense.createdAt) + '</div>' +
      '</div>' +
      '<div class="item-amount" style="color:#fb7185;">-' + formatRp(expense.nominal) + '</div>' +
      actions +
      '</div>';
  }).join("");

  if (isMaster()) {
    history.querySelectorAll(".btn-edit-expense").forEach(function(button) {
      button.addEventListener("click", function() {
        openEditExpenseModal(button.dataset.id);
      });
    });

    history.querySelectorAll(".btn-delete-expense").forEach(function(button) {
      button.addEventListener("click", function() {
        deleteExpense(button.dataset.id);
      });
    });
  }
}

function refreshExpenseSummary() {
  const currentMonth = getMonthKey(Date.now());

  const income = allRentals
    .filter(function(rental) {
      return getMonthKey(rental.createdAt) === currentMonth;
    })
    .reduce(function(total, rental) {
      return total + getPendapatanBersih(rental);
    }, 0);

  const expense = allExpenses
    .filter(function(item) {
      return getMonthKey(item.createdAt) === currentMonth;
    })
    .reduce(function(total, item) {
      return total + Number(item.nominal || 0);
    }, 0);

  setText("totalExpenses", formatRp(expense));
  setText("netIncome", formatRp(income - expense));
}

function getMonthlySummary(monthKey) {
  const rentals = allRentals.filter(function(rental) {
    return getMonthKey(rental.createdAt) === monthKey;
  });

  const expenses = allExpenses.filter(function(expense) {
    return getMonthKey(expense.createdAt) === monthKey;
  });

  const kas = allKasTransactions.filter(function(item) {
    return getMonthKey(item.createdAt) === monthKey;
  });

  const income = rentals.reduce(function(total, rental) {
    return total + getPendapatanBersih(rental);
  }, 0);

const kasMasuk = kas.reduce(function(total, item) {
  const adalahKasSewa =
    item.jenis === "masuk" &&
    item.sumber !== "loan";

  return total + (
    adalahKasSewa ? Number(item.nominal || 0) : 0
  );
}, 0);

  const expenseTotal = expenses.reduce(function(total, expense) {
    return total + Number(expense.nominal || 0);
  }, 0);

  return {
    transactionCount: rentals.length,
    income: income,
    kas: kasMasuk,
    expenses: expenseTotal,
    final: income - expenseTotal
  };
}

function getAvailableMonthKeys() {
  const keys = new Set([getMonthKey(Date.now())]);

  allRentals.concat(allExpenses, allKasTransactions).forEach(function(item) {
    if (item.createdAt) keys.add(getMonthKey(item.createdAt));
  });

  return Array.from(keys).sort().reverse();
}

function refreshMonthlyRecap() {
  if (!monthlySelect) return;

  const keys = getAvailableMonthKeys();
  const before = monthlySelect.value;

  monthlySelect.innerHTML = keys.map(function(key) {
    return '<option value="' + key + '">' + escapeHtml(formatMonthKey(key)) + '</option>';
  }).join("");

  monthlySelect.value = keys.includes(before) ? before : getMonthKey(Date.now());
  renderSelectedMonth(monthlySelect.value);
  renderMonthlyHistory(keys);
}

function renderSelectedMonth(monthKey) {
  const summary = getMonthlySummary(monthKey);

  setText("monthlyIncome", formatRp(summary.income));
  setText("monthlyKas", formatRp(summary.kas));
  setText("monthlyExpenses", formatRp(summary.expenses));
  setText("monthlyFinal", formatRp(summary.final));
}

function renderMonthlyHistory(keys) {
  const history = $("monthlyHistory");
  if (!history) return;

  history.innerHTML = keys.map(function(key) {
    const summary = getMonthlySummary(key);

    return '<div class="history-item">' +
      '<div class="rank-badge gold"><i class="fas fa-calendar"></i></div>' +
      '<div class="item-info">' +
        '<div class="nomor">' + escapeHtml(formatMonthKey(key)) + '</div>' +
        '<div class="meta">' +
          summary.transactionCount + ' transaksi · Kas ' + formatRp(summary.kas) +
          ' · Pengeluaran ' + formatRp(summary.expenses) +
        '</div>' +
      '</div>' +
      '<div class="item-amount">' + formatRp(summary.final) + '</div>' +
      '<button type="button" class="btn-monthly-detail" data-month-key="' + key + '">' +
        '<i class="fas fa-eye"></i> Detail' +
      '</button>' +
      '<button type="button" class="btn-monthly-detail btn-monthly-download" data-month-key="' + key + '" title="Download Excel">' +
        '<i class="fas fa-download"></i>' +
      '</button>' +
      '</div>';
  }).join("");

  history.querySelectorAll(".btn-monthly-detail").forEach(function(button) {
    button.addEventListener("click", function() {
      if (button.classList.contains("btn-monthly-download")) {
        downloadMonthlyReport(button.dataset.monthKey);
      } else {
        openMonthlyDetail(button.dataset.monthKey);
      }
    });
  });
}

/* Pembagian omset bersih Glena & Aldo (sama dengan logika popup detail) */
function getOwnerSplit(rentals) {
  let gross = 0;
  let glena = 0;
  let aldo = 0;
  let psDNet = 0;

  rentals.forEach(function(rental) {
    const unit = rental.psUnit;
    const rentalGross = getRentalGross(rental);
    gross += rentalGross;

    if (unit === "A" || unit === "C" || unit === "TV_A") {
      glena += getPendapatanBersih(rental);
    } else if (unit === "B" || unit === "TV_B") {
      aldo += getPendapatanBersih(rental);
    } else if (unit === "D") {
      psDNet += getPendapatanBersih(rental);
    } else if (isUnit303040(unit)) {
      const g = rental.glenaNet !== undefined
        ? Number(rental.glenaNet || 0)
        : Math.round(rentalGross * 0.30);
      const a = rental.aldoNet !== undefined
        ? Number(rental.aldoNet || 0)
        : rentalGross - Math.round(rentalGross * 0.30) - Math.round(rentalGross * 0.30);
      glena += g;
      aldo += a;
    }
  });

  const aldoD = Math.floor(psDNet / 2);
  aldo += aldoD;
  glena += psDNet - aldoD;

  return { gross: gross, glena: glena, aldo: aldo };
}

function closeMonthlyDetail() {
  if (monthlyDetailModal) {
    monthlyDetailModal.classList.add("hidden");
  }
}

function openMonthlyDetail(monthKey) {
  if (!monthlyDetailModal) {
    alert("Modal detail bulanan belum ada di index.html.");
    return;
  }

  const rentals = allRentals
    .filter(function(rental) {
      return getMonthKey(rental.createdAt) === monthKey;
    })
    .sort(function(a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

  const expenses = allExpenses
    .filter(function(expense) {
      return getMonthKey(expense.createdAt) === monthKey;
    })
    .sort(function(a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

  const kas = allKasTransactions
    .filter(function(item) {
      return getMonthKey(item.createdAt) === monthKey;
    })
    .sort(function(a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

  const summary = getMonthlySummary(monthKey);

  const split = getOwnerSplit(rentals);
  const gross = split.gross;
  currentDetailMonthKey = monthKey;

  if (monthlyDetailTitle) {
    monthlyDetailTitle.textContent = formatMonthKey(monthKey);
  }

  if (detailGross) {
    detailGross.textContent = formatRp(gross);
  }

    if (detailIncome) {
    detailIncome.textContent = formatRp(summary.income);
  }

if (detailGlenaNet) {
  detailGlenaNet.textContent = formatRp(split.glena);
}

if (detailAldoNet) {
  detailAldoNet.textContent = formatRp(split.aldo);
}

  if (detailKas) {
    detailKas.textContent = formatRp(summary.kas);
  }

  if (detailExpenses) {
    detailExpenses.textContent = formatRp(summary.expenses);
  }

  if (detailFinal) {
    detailFinal.textContent = formatRp(summary.final);
  }

  renderMonthlyRentalList(rentals);
  renderMonthlyExpenseList(expenses);
  renderMonthlyKasList(kas);

  monthlyDetailModal.classList.remove("hidden");
}

function renderMonthlyRentalList(rentals) {
  if (!monthlyRentalDetailList) return;

  if (!rentals.length) {
    monthlyRentalDetailList.innerHTML =
      '<p class="empty">Tidak ada transaksi sewa pada bulan ini.</p>';
    return;
  }

  monthlyRentalDetailList.innerHTML = rentals.map(function(rental) {
    const unit = String(rental.psUnit || "-").replace("_", " ");
    const gross = getRentalGross(rental);
    const kas = getRentalKas(rental);
    const bersih = getPendapatanBersih(rental);

    return '<div class="month-detail-item">' +
      '<div class="month-detail-left">' +
        '<span class="month-detail-title">' +
          '<i class="fas fa-user"></i> ' +
          escapeHtml(rental.nomorPenyewa || "Tanpa nomor") +
        '</span>' +
        '<span class="month-detail-meta">' +
          unit + ' · ' +
          Number(rental.durasi || 0) + ' ' +
          escapeHtml(rental.durasiUnit || "jam") +
          '<br>' + formatDate(rental.createdAt) +
        '</span>' +
      '</div>' +
      '<div class="month-detail-right">' +
        '<span class="month-detail-price">Bersih ' + formatRp(bersih) + '</span>' +
        '<span class="month-detail-subprice">' +
          'Kotor ' + formatRp(gross) + ' · Kas ' + formatRp(kas) +
        '</span>' +
      '</div>' +
      '</div>';
  }).join("");
}

function renderMonthlyExpenseList(expenses) {
  if (!monthlyExpenseDetailList) return;

  if (!expenses.length) {
    monthlyExpenseDetailList.innerHTML =
      '<p class="empty">Tidak ada pengeluaran pada bulan ini.</p>';
    return;
  }

  monthlyExpenseDetailList.innerHTML = expenses.map(function(expense) {
    return '<div class="month-detail-item">' +
      '<div class="month-detail-left">' +
        '<span class="month-detail-title">' +
          '<i class="fas fa-receipt"></i> Pengeluaran Usaha' +
        '</span>' +
        '<span class="month-detail-meta">' +
          escapeHtml(expense.keterangan || "-") +
          '<br>' + formatDate(expense.createdAt) +
        '</span>' +
      '</div>' +
      '<div class="month-detail-right">' +
        '<span class="month-detail-price month-detail-expense">' +
          '- ' + formatRp(expense.nominal) +
        '</span>' +
      '</div>' +
      '</div>';
  }).join("");
}

function renderMonthlyKasList(kas) {
  if (!monthlyKasDetailList) return;

  if (!kas.length) {
    monthlyKasDetailList.innerHTML =
      '<p class="empty">Tidak ada transaksi kas pada bulan ini.</p>';
    return;
  }

  monthlyKasDetailList.innerHTML = kas.map(function(item) {
    const masuk = item.jenis === "masuk";

    const labelKas = getKasLabel(item);

    return '<div class="month-detail-item">' +
      '<div class="month-detail-left">' +
        '<span class="month-detail-title">' +
          '<i class="fas ' +
          (masuk ? "fa-arrow-down" : "fa-arrow-up") +
          '"></i> ' +
          labelKas +
        '</span>' +
        '<span class="month-detail-meta">' +
          escapeHtml(item.keterangan || "-") +
          '<br>' + formatDate(item.createdAt) +
        '</span>' +
      '</div>' +
      '<div class="month-detail-right">' +
        '<span class="month-detail-price ' +
          (masuk ? "month-detail-kas-in" : "month-detail-kas-out") +
          '">' +
          (masuk ? "+" : "-") + formatRp(item.nominal) +
        '</span>' +
      '</div>' +
      '</div>';
  }).join("");
}
if (closeMonthlyDetailModal) {
  closeMonthlyDetailModal.addEventListener("click", closeMonthlyDetail);
}

if (monthlyDetailOverlay) {
  monthlyDetailOverlay.addEventListener("click", closeMonthlyDetail);
}

if (monthlySelect) {
  monthlySelect.addEventListener("change", function() {
    renderSelectedMonth(monthlySelect.value);
  });
}

/* =========================
   DOWNLOAD EXCEL
========================= */
function formatDateExport(timestamp) {
  if (!timestamp) return "";
  const d = new Date(Number(timestamp));
  if (Number.isNaN(d.getTime())) return "";
  const pad = function(n) { return String(n).padStart(2, "0"); };
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) +
    " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
}

function autoWidth(rows) {
  const widths = [];
  rows.forEach(function(row) {
    row.forEach(function(cell, i) {
      const len = String(cell === undefined || cell === null ? "" : cell).length;
      widths[i] = Math.min(60, Math.max(widths[i] || 8, len + 2));
    });
  });
  return widths.map(function(w) { return { wch: w }; });
}

/* ---------- Pembuat file .xlsx mandiri (tanpa library luar) ---------- */
const CRC_TABLE = (function() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/* files: [{ name, data: Uint8Array }] -> Uint8Array zip (tanpa kompresi) */
function buildZip(files) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  files.forEach(function(file) {
    const nameBytes = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, 0, true);
    local.setUint16(12, 0x21, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, nameBytes.length, true);
    local.setUint16(28, 0, true);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, 0, true);
    central.setUint16(14, 0x21, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint16(30, 0, true);
    central.setUint16(32, 0, true);
    central.setUint16(34, 0, true);
    central.setUint16(36, 0, true);
    central.setUint32(38, 0, true);
    central.setUint32(42, offset, true);

    localParts.push(new Uint8Array(local.buffer), nameBytes, data);
    centralParts.push(new Uint8Array(central.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  });

  const centralSize = centralParts.reduce(function(t, p) { return t + p.length; }, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = localParts.concat(centralParts, [new Uint8Array(end.buffer)]);
  const total = parts.reduce(function(t, p) { return t + p.length; }, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  parts.forEach(function(p) {
    out.set(p, pos);
    pos += p.length;
  });
  return out;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function columnName(index) {
  let name = "";
  let n = index + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    name = String.fromCharCode(65 + m) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

/* Baris pertama tiap sheet = header (tebal). Angka diformat #,##0 */
function buildSheetXml(rows, boldRows) {
  const cols = autoWidth(rows).map(function(c, i) {
    return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + c.wch + '" customWidth="1"/>';
  }).join("");

  const body = rows.map(function(row, r) {
    const bold = boldRows.indexOf(r) !== -1;
    const cells = row.map(function(cell, c) {
      if (cell === undefined || cell === null || cell === "") return "";
      const ref = columnName(c) + (r + 1);

      if (typeof cell === "number" && Number.isFinite(cell)) {
        return '<c r="' + ref + '" s="' + (bold ? 3 : 2) + '"><v>' + cell + '</v></c>';
      }

      return '<c r="' + ref + '" t="inlineStr"' + (bold ? ' s="1"' : "") +
        '><is><t xml:space="preserve">' + xmlEscape(cell) + '</t></is></c>';
    }).join("");

    return '<row r="' + (r + 1) + '">' + cells + '</row>';
  }).join("");

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    (cols ? '<cols>' + cols + '</cols>' : "") +
    '<sheetData>' + body + '</sheetData></worksheet>';
}

function buildXlsx(sheets) {
  const enc = new TextEncoder();
  const files = [];
  const add = function(name, text) { files.push({ name: name, data: enc.encode(text) }); };
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  add("[Content_Types].xml", head +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    sheets.map(function(_, i) {
      return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }).join("") +
    '</Types>');

  add("_rels/.rels", head +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>');

  add("xl/workbook.xml", head +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    sheets.map(function(sheet, i) {
      return '<sheet name="' + xmlEscape(sheet.name.replace(/[\\\/?*\[\]:]/g, " ").slice(0, 31)) +
        '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    }).join("") +
    '</sheets></workbook>');

  add("xl/_rels/workbook.xml.rels", head +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map(function(_, i) {
      return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    }).join("") +
    '<Relationship Id="rId' + (sheets.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
    '</Relationships>');

  add("xl/styles.xml", head +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
      '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
      '<xf numFmtId="3" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/>' +
    '</cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>');

  sheets.forEach(function(sheet, i) {
    add("xl/worksheets/sheet" + (i + 1) + ".xml", buildSheetXml(sheet.rows, sheet.boldRows || [0]));
  });

  return buildZip(files);
}

/* sheets: [{ name, rows: [[...], ...], boldRows?: [indexBaris] }] */
function downloadWorkbook(fileBaseName, sheets) {
  try {
    const bytes = buildXlsx(sheets);
    const blob = new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileBaseName + ".xlsx";
    document.body.appendChild(link);
    link.click();

    setTimeout(function() {
      URL.revokeObjectURL(link.href);
      link.remove();
    }, 1500);
  } catch (error) {
    console.error("Gagal membuat file Excel:", error);
    alert("Gagal membuat file download: " + error.message);
  }
}

function downloadMonthlyReport(monthKey) {
  if (!monthKey) return;

  const inMonth = function(item) {
    return getMonthKey(item.createdAt) === monthKey;
  };

  const rentals = allRentals.filter(inMonth).sort(sortByCreatedAsc);
  const expenses = allExpenses.filter(inMonth).sort(sortByCreatedAsc);
  const ledger = getKasLedger();
  const kasBulanIni = ledger.filter(inMonth);
  const summary = getMonthlySummary(monthKey);
  const split = getOwnerSplit(rentals);

  const saldoAwal = (function() {
    const sebelum = ledger.filter(function(k) { return getMonthKey(k.createdAt) < monthKey; });
    return sebelum.length ? sebelum[sebelum.length - 1].saldoSetelah : 0;
  })();
  const saldoAkhir = kasBulanIni.length
    ? kasBulanIni[kasBulanIni.length - 1].saldoSetelah
    : saldoAwal;

  const ringkasan = [
    ["Rekap Bulanan", formatMonthKey(monthKey)],
    [],
    ["Keterangan", "Nominal (Rp)"],
    ["Jumlah Transaksi Sewa", summary.transactionCount],
    ["Omset Kotor", split.gross],
    ["Pendapatan Bersih", summary.income],
    ["Omset Bersih Glena Adan", split.glena],
    ["Omset Bersih Aldo Laras", split.aldo],
    ["Kas dari Sewa", summary.kas],
    ["Pengeluaran", summary.expenses],
    ["Sisa Pendapatan", summary.final],
    [],
    ["Saldo Kas Awal Bulan", saldoAwal],
    ["Saldo Kas Akhir Bulan", saldoAkhir],
    [],
    ["Didownload", formatDateExport(Date.now())]
  ];

  const sewa = [["No", "Tanggal", "Nomor Penyewa", "Unit", "Durasi", "Satuan", "Omset Kotor", "Kas", "Pendapatan Bersih", "Input oleh"]]
    .concat(rentals.map(function(r, i) {
      return [
        i + 1,
        formatDateExport(r.createdAt),
        r.nomorPenyewa || "",
        String(r.psUnit || "").replace("_", " "),
        Number(r.durasi || 0),
        r.durasiUnit || "jam",
        getRentalGross(r),
        getRentalKas(r),
        getPendapatanBersih(r),
        r.createdBy || ""
      ];
    }));

  const pengeluaran = [["No", "Tanggal", "Keterangan", "Nominal", "Input oleh"]]
    .concat(expenses.map(function(e, i) {
      return [i + 1, formatDateExport(e.createdAt), e.keterangan || "", Number(e.nominal || 0), e.createdBy || ""];
    }));

  const kas = [["No", "Tanggal", "Jenis", "Keterangan", "Masuk", "Keluar", "Saldo Setelah"]]
    .concat(kasBulanIni.map(function(k, i) {
      const masuk = k.jenis === "masuk";
      return [
        i + 1,
        formatDateExport(k.createdAt),
        getKasLabel(k),
        k.keterangan || "",
        masuk ? Number(k.nominal || 0) : "",
        masuk ? "" : Number(k.nominal || 0),
        k.saldoSetelah
      ];
    }));

  downloadWorkbook("Rekap-Bulanan-" + monthKey, [
    { name: "Ringkasan", rows: ringkasan, boldRows: [0, 2] },
    { name: "Sewa", rows: sewa },
    { name: "Pengeluaran", rows: pengeluaran },
    { name: "Kas", rows: kas }
  ]);
}

function downloadAllKasHistory() {
  const ledger = getKasLedger();

  if (!ledger.length) {
    alert("Belum ada transaksi kas.");
    return;
  }

  const rows = [["No", "Tanggal", "Bulan", "Jenis", "Keterangan", "Masuk", "Keluar", "Saldo Setelah"]]
    .concat(ledger.map(function(k) {
      const masuk = k.jenis === "masuk";
      return [
        k.urutan,
        formatDateExport(k.createdAt),
        formatMonthKey(getMonthKey(k.createdAt)),
        getKasLabel(k),
        k.keterangan || "",
        masuk ? Number(k.nominal || 0) : "",
        masuk ? "" : Number(k.nominal || 0),
        k.saldoSetelah
      ];
    }));

  const loanRows = [["Tanggal", "Keterangan", "Total Loan", "Sudah Dibayar", "Sisa", "Status"]]
    .concat(getLoanStatuses().map(function(l) {
      return [formatDateExport(l.loan.createdAt), l.keterangan, l.total, l.dibayar, l.sisa, l.lunas ? "Lunas" : "Belum lunas"];
    }));

  downloadWorkbook("History-Kas-" + getMonthKey(Date.now()), [
    { name: "History Kas", rows: rows },
    { name: "Loan", rows: loanRows }
  ]);
}

if (downloadKasHistory) downloadKasHistory.addEventListener("click", downloadAllKasHistory);

if (downloadSelectedMonth) {
  downloadSelectedMonth.addEventListener("click", function() {
    downloadMonthlyReport(monthlySelect ? monthlySelect.value : getMonthKey(Date.now()));
  });
}

if (downloadMonthlyDetail) {
  downloadMonthlyDetail.addEventListener("click", function() {
    downloadMonthlyReport(currentDetailMonthKey);
  });
}

function openEditModal(id) {
  if (!isMaster() || !editModal) return;

  const rental = allRentals.find(function(item) {
    return item.id === id;
  });

  if (!rental) return;

  const fields = {
    editId: rental.id,
    editNomor: rental.nomorPenyewa || "",
    editPsUnit: rental.psUnit || "A",
    editDurasi: rental.durasi || 1,
    editDurasiUnit: rental.durasiUnit || "jam",
    editNominal: getRentalGross(rental)
  };

  Object.keys(fields).forEach(function(key) {
    const el = $(key);
    if (el) el.value = fields[key];
  });

  editModal.classList.remove("hidden");
}

function closeEditModal() {
  if (editModal) editModal.classList.add("hidden");
  if (editForm) editForm.reset();
}

if (closeModal) closeModal.addEventListener("click", closeEditModal);
if (cancelEdit) cancelEdit.addEventListener("click", closeEditModal);
if (modalOverlay) modalOverlay.addEventListener("click", closeEditModal);

if (editForm) {
  editForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!isMaster() || !db) return;

    const id = $("editId") ? $("editId").value : "";
    const rental = allRentals.find(function(item) {
      return item.id === id;
    });

    const nomor = $("editNomor") ? $("editNomor").value.trim() : "";
    const psUnit = $("editPsUnit") ? $("editPsUnit").value : "";
    const durasi = $("editDurasi") ? Number($("editDurasi").value) : 0;
    const durasiUnit = $("editDurasiUnit") ? $("editDurasiUnit").value : "jam";
    const nominalKotor = $("editNominal") ? Number($("editNominal").value) : 0;

    if (!rental || !nomor || !psUnit || !durasi || !nominalKotor) {
      alert("Lengkapi seluruh data transaksi.");
      return;
    }

   let kasNominal = Math.round(nominalKotor * KAS_PERCENT);
let pendapatanBersih = nominalKotor - kasNominal;
let kasPersen = 5;

if (isUnit303040(psUnit)) {
  kasNominal = Math.round(nominalKotor * 0.30);
  pendapatanBersih = nominalKotor - kasNominal;
  kasPersen = 30;
}

    if (saveEditBtn) saveEditBtn.disabled = true;

    try {
      const updates = {};

      updates["rentals/" + id + "/nomorPenyewa"] = nomor;
      updates["rentals/" + id + "/psUnit"] = psUnit;
      updates["rentals/" + id + "/durasi"] = durasi;
      updates["rentals/" + id + "/durasiUnit"] = durasiUnit;
     updates["rentals/" + id + "/nominalKotor"] = nominalKotor;
updates["rentals/" + id + "/kasPersen"] = kasPersen;
updates["rentals/" + id + "/kasNominal"] = kasNominal;
updates["rentals/" + id + "/nominal"] = pendapatanBersih;

// TAMBAHAN: sinkronkan pembagian PS D saat transaksi diedit
const bagianAldoPS_D = psUnit === "D"
  ? Math.floor(pendapatanBersih / 2)
  : 0;

const bagianGlenaPS_D = psUnit === "D"
  ? pendapatanBersih - bagianAldoPS_D
  : 0;
const bagianGlenaPS_E = isUnit303040(psUnit)
  ? Math.round(nominalKotor * 0.30)
  : 0;

const bagianAldoPS_E = isUnit303040(psUnit)
  ? nominalKotor - kasNominal - bagianGlenaPS_E
  : 0;
      
updates["rentals/" + id + "/owner"] =
  psUnit === "D" ? "Aldo Laras & Adan Glena" : "";

updates["rentals/" + id + "/sistemBagiHasil"] =
  psUnit === "D" ? "50:50" : "";

updates["rentals/" + id + "/aldoNet"] = bagianAldoPS_D;
updates["rentals/" + id + "/glenaNet"] = bagianGlenaPS_D

      if (isUnit303040(psUnit)) {
  updates["rentals/" + id + "/owner"] =
    "Aldo Laras & Adan Glena";

  updates["rentals/" + id + "/sistemBagiHasil"] =
    "30:30:40";

  updates["rentals/" + id + "/glenaNet"] =
    bagianGlenaPS_E;

  updates["rentals/" + id + "/aldoNet"] =
    bagianAldoPS_E;
}

updates["rentals/" + id + "/updatedAt"] = Date.now();
updates["rentals/" + id + "/updatedBy"] = currentUser.role;

      const relatedKas = allKasTransactions.find(function(kas) {
        return kas.rentalId === id;
      });

      if (relatedKas) {
        updates["kasTransactions/" + relatedKas.id + "/nominal"] = kasNominal;
        updates["kasTransactions/" + relatedKas.id + "/persentase"] = kasPersen;
        updates["kasTransactions/" + relatedKas.id + "/keterangan"] =
          "Kas " + kasPersen + "% dari sewa PS " + psUnit;
        updates["kasTransactions/" + relatedKas.id + "/updatedAt"] = Date.now();
        updates["kasTransactions/" + relatedKas.id + "/updatedBy"] = currentUser.role;
      }

      await db.ref().update(updates);
      closeEditModal();
      alert("Transaksi sewa dan kas terkait berhasil diperbarui.");
    } catch (error) {
      alert("Gagal edit transaksi: " + error.message);
    } finally {
      if (saveEditBtn) saveEditBtn.disabled = false;
    }
  });
}

async function deleteRental(id) {
  if (!isMaster() || !db) return;

  if (!confirm("Hapus transaksi sewa ini beserta kas otomatis 5% terkait?")) return;

  try {
    const updates = {};
    updates["rentals/" + id] = null;

    allKasTransactions.forEach(function(kas) {
      if (kas.rentalId === id) {
        updates["kasTransactions/" + kas.id] = null;
      }
    });

    await db.ref().update(updates);
    alert("Transaksi sewa dan kas terkait berhasil dihapus.");
  } catch (error) {
    alert("Gagal hapus transaksi: " + error.message);
  }
}

function openEditExpenseModal(id) {
  if (!isMaster() || !editExpenseModal || !editExpenseForm) {
    alert("Modal Edit Pengeluaran belum ada di index.html.");
    return;
  }

  const expense = allExpenses.find(function(item) {
    return item.id === id;
  });

  if (!expense) return;

  if (editExpenseId) editExpenseId.value = expense.id;
  if (editExpenseNominal) editExpenseNominal.value = Number(expense.nominal || 0);
  if (editExpenseKeterangan) editExpenseKeterangan.value = expense.keterangan || "";

  editExpenseModal.classList.remove("hidden");
}

function closeEditExpenseModalForm() {
  if (editExpenseModal) editExpenseModal.classList.add("hidden");
  if (editExpenseForm) editExpenseForm.reset();
}

if (closeEditExpenseModal) closeEditExpenseModal.addEventListener("click", closeEditExpenseModalForm);
if (cancelEditExpense) cancelEditExpense.addEventListener("click", closeEditExpenseModalForm);
if (editExpenseModalOverlay) editExpenseModalOverlay.addEventListener("click", closeEditExpenseModalForm);

if (editExpenseForm) {
  editExpenseForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!isMaster() || !db) return;

    const id = editExpenseId ? editExpenseId.value : "";
    const nominal = editExpenseNominal ? Number(editExpenseNominal.value) : 0;
    const keterangan = editExpenseKeterangan ? editExpenseKeterangan.value.trim() : "";

    if (!id || !nominal || nominal <= 0 || !keterangan) {
      alert("Lengkapi nominal dan keterangan pengeluaran.");
      return;
    }

    if (saveEditExpenseBtn) saveEditExpenseBtn.disabled = true;

    try {
      const updates = {};

      updates["expenses/" + id + "/nominal"] = nominal;
      updates["expenses/" + id + "/keterangan"] = keterangan;
      updates["expenses/" + id + "/updatedAt"] = Date.now();
      updates["expenses/" + id + "/updatedBy"] = currentUser.role;

      const relatedKas = allKasTransactions.find(function(kas) {
        return kas.expenseId === id;
      });

      if (relatedKas) {
        updates["kasTransactions/" + relatedKas.id + "/nominal"] = nominal;
        updates["kasTransactions/" + relatedKas.id + "/keterangan"] = "Pengeluaran: " + keterangan;
        updates["kasTransactions/" + relatedKas.id + "/updatedAt"] = Date.now();
        updates["kasTransactions/" + relatedKas.id + "/updatedBy"] = currentUser.role;
      }

      await db.ref().update(updates);
      closeEditExpenseModalForm();
closePayLoanModalForm();
closeEditKasModalForm();
closeMonthlyDetail();
      alert("Pengeluaran dan kas keluar terkait berhasil diperbarui.");
    } catch (error) {
      alert("Gagal edit pengeluaran: " + error.message);
    } finally {
      if (saveEditExpenseBtn) saveEditExpenseBtn.disabled = false;
    }
  });
}

async function deleteExpense(id) {
  if (!isMaster() || !db) return;

  if (!confirm("Hapus pengeluaran ini beserta kas keluar terkait?")) return;

  try {
    const updates = {};
    updates["expenses/" + id] = null;

    allKasTransactions.forEach(function(kas) {
      if (kas.expenseId === id) {
        updates["kasTransactions/" + kas.id] = null;
      }
    });

    await db.ref().update(updates);
    alert("Pengeluaran dan kas keluar terkait berhasil dihapus.");
  } catch (error) {
    alert("Gagal hapus pengeluaran: " + error.message);
  }
}

function openEditKasModal(id) {
  if (!isMaster() || !editKasModal || !editKasForm) {
    alert("Modal Edit Kas belum ada di index.html.");
    return;
  }

  const kas = allKasTransactions.find(function(item) {
    return item.id === id;
  });

  if (!kas) return;

  if (editKasId) editKasId.value = kas.id;
  if (editKasJenis) editKasJenis.value = kas.jenis || "masuk";
  if (editKasNominal) editKasNominal.value = Number(kas.nominal || 0);
  if (editKasKeterangan) editKasKeterangan.value = kas.keterangan || "";

  editKasModal.classList.remove("hidden");
}

function closeEditKasModalForm() {
  if (editKasModal) editKasModal.classList.add("hidden");
  if (editKasForm) editKasForm.reset();
}

if (closeEditKasModal) closeEditKasModal.addEventListener("click", closeEditKasModalForm);
if (cancelEditKas) cancelEditKas.addEventListener("click", closeEditKasModalForm);
if (editKasModalOverlay) editKasModalOverlay.addEventListener("click", closeEditKasModalForm);

if (editKasForm) {
  editKasForm.addEventListener("submit", async function(event) {
    event.preventDefault();

    if (!isMaster() || !db) return;

    const id = editKasId ? editKasId.value : "";
    const jenis = editKasJenis ? editKasJenis.value : "";
    const nominal = editKasNominal ? Number(editKasNominal.value) : 0;
    const keterangan = editKasKeterangan ? editKasKeterangan.value.trim() : "";

    if (!id || !jenis || !nominal || nominal <= 0 || !keterangan) {
      alert("Lengkapi semua data kas.");
      return;
    }

    if (saveEditKasBtn) saveEditKasBtn.disabled = true;

    try {
      await db.ref("kasTransactions/" + id).update({
        jenis: jenis,
        nominal: nominal,
        keterangan: keterangan,
        updatedAt: Date.now(),
        updatedBy: currentUser.role
      });

      closeEditKasModalForm();
      alert("Transaksi kas berhasil diperbarui.");
    } catch (error) {
      alert("Gagal edit kas: " + error.message);
    } finally {
      if (saveEditKasBtn) saveEditKasBtn.disabled = false;
    }
  });
}

async function deleteKasTransaction(id) {
  if (!isMaster() || !db) return;

  const kas = allKasTransactions.find(function(item) { return item.id === id; });
  const payments = kas && kas.sumber === "loan"
    ? allKasTransactions.filter(function(item) {
        return item.sumber === "bayar_loan" && item.loanId === id;
      })
    : [];

  const pesan = payments.length
    ? "Hapus loan ini beserta " + payments.length + " catatan pembayarannya?\n\nSaldo kas akan dihitung ulang."
    : "Hapus transaksi kas ini?\n\nMenghapus kas tidak menghapus transaksi sewa atau pengeluaran asal.";

  if (!confirm(pesan)) return;

  try {
    const updates = {};
    updates["kasTransactions/" + id] = null;
    payments.forEach(function(p) {
      updates["kasTransactions/" + p.id] = null;
    });

    await db.ref().update(updates);
    alert("Transaksi kas berhasil dihapus.");
  } catch (error) {
    alert("Gagal hapus kas: " + error.message);
  }
}

if (loginBtn) loginBtn.addEventListener("click", doLogin);

if (pinInput) {
  pinInput.addEventListener("keydown", function(event) {
    if (event.key === "Enter") {
      event.preventDefault();
      doLogin();
    }
  });
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", function() {
    currentUser = null;
    sessionStorage.removeItem("ps_user");

    if (dashboardScreen) dashboardScreen.classList.add("hidden");
    if (loginScreen) loginScreen.classList.remove("hidden");

closeEditModal();
closeExpenseModalForm();
closeLoanModalForm();
closeEditExpenseModalForm();

    
    if (pinInput) pinInput.focus();
  });
}

initFirebase();
checkSession();

if (pinInput) pinInput.focus();
