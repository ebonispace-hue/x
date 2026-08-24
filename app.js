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
const TV_PRICE = 20000;
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

const openExpenseModal = $("openExpenseModal");
const expenseModal = $("expenseModal");
const expenseModalOverlay = $("expenseModalOverlay");
const closeExpenseModal = $("closeExpenseModal");
const cancelExpense = $("cancelExpense");
const expenseForm = $("expenseForm");
const expenseNominal = $("expenseNominal");
const expenseKeterangan = $("expenseKeterangan");
const saveExpenseBtn = $("saveExpenseBtn");

const editModal = $("editModal");
const editForm = $("editForm");
const closeModal = $("closeModal");
const cancelEdit = $("cancelEdit");
const modalOverlay = $("modalOverlay");
const saveEditBtn = $("saveEditBtn");
const monthlySelect = $("monthlySelect");

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

  latestEl.innerHTML = allRentals.slice(0, 10).map(function(rental) {
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
          'Omset kotor · Kas 5%: ' + formatRp(getRentalKas(rental)) +
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

function renderKasSummary() {
  let kasMasukTersimpan = 0;
  let kasKeluar = 0;

  allKasTransactions.forEach(function(kas) {
    if (kas.jenis === "masuk") kasMasukTersimpan += Number(kas.nominal || 0);
    if (kas.jenis === "keluar") kasKeluar += Number(kas.nominal || 0);
  });

  const kasDariTransaksiLama = getKasFallbackFromRentals();
  const totalKasMasuk = kasMasukTersimpan + kasDariTransaksiLama;

  setText("kasMasuk", formatRp(totalKasMasuk));
  setText("kasKeluar", formatRp(kasKeluar));
  setText("kasSaldo", formatRp(totalKasMasuk - kasKeluar));

  renderKasHistory();
}

function renderKasHistory() {
  const history = $("kasHistory");
  if (!history) return;

  const allKasForDisplay = allKasTransactions
    .concat(getKasVirtualHistory())
    .sort(function(a, b) {
      return Number(b.createdAt || 0) - Number(a.createdAt || 0);
    });

  if (!allKasForDisplay.length) {
    history.innerHTML = '<p class="empty">Belum ada transaksi kas</p>';
    return;
  }

  history.innerHTML = allKasForDisplay.slice(0, 10).map(function(kas) {
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
      '<div class="rank-badge ' + (masuk ? "gold" : "bronze") + '">' +
        (masuk ? '<i class="fas fa-arrow-down"></i>' : '<i class="fas fa-arrow-up"></i>') +
      '</div>' +
      '<div class="item-info">' +
        '<div class="nomor">' + (masuk ? "Kas Masuk" : "Kas Keluar") + '</div>' +
        '<div class="meta">' + escapeHtml(kas.keterangan || "-") + ' · ' + formatDate(kas.createdAt) + '</div>' +
        status +
      '</div>' +
      '<div class="item-amount" style="color:' + (masuk ? "#5eead4" : "#fb7185") + ';">' +
        (masuk ? "+" : "-") + formatRp(kas.nominal) +
      '</div>' +
      actions +
      '</div>';
  }).join("");

  if (isMaster()) {
    history.querySelectorAll(".btn-edit-kas").forEach(function(button) {
      button.addEventListener("click", function() {
        openEditKasModal(button.dataset.id);
      });
    });

    history.querySelectorAll(".btn-delete-kas").forEach(function(button) {
      button.addEventListener("click", function() {
        deleteKasTransaction(button.dataset.id);
      });
    });
  }
}

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
      const kasNominal = Math.round(nominalKotor * KAS_PERCENT);
      const pendapatanBersih = nominalKotor - kasNominal;
      const monthKey = getMonthKey(waktu);
      const updates = {};

      updates["rentals/" + rentalRef.key] = {
        nomorPenyewa: nomor,
        psUnit: psUnit,
        durasi: durasi,
        durasiUnit: durasiUnit,
        nominalKotor: nominalKotor,
        kasPersen: 5,
        kasNominal: kasNominal,
        nominal: pendapatanBersih,
        fotoUrl: fotoUrl || "",
        createdAt: waktu,
        createdBy: currentUser ? currentUser.role : "Admin",
        monthKey: monthKey
      };

      updates["kasTransactions/" + kasRef.key] = {
        jenis: "masuk",
        nominal: kasNominal,
        persentase: 5,
        keterangan: "Kas 5% dari sewa PS " + psUnit,
        sumber: "sewa_otomatis",
        rentalId: rentalRef.key,
        createdAt: waktu,
        createdBy: currentUser ? currentUser.role : "Admin",
        monthKey: monthKey
      };

if (tvUnit === "TV_A" || tvUnit === "TV_B") {
  const tvRentalRef = db.ref("rentals").push();
  const tvKasRef = db.ref("kasTransactions").push();

  const tvKasNominal = Math.round(TV_PRICE * KAS_PERCENT);
  const tvPendapatanBersih = TV_PRICE - tvKasNominal;

  updates["rentals/" + tvRentalRef.key] = {
    nomorPenyewa: nomor,
    psUnit: tvUnit,
    durasi: durasi,
    durasiUnit: durasiUnit,
    nominalKotor: TV_PRICE,
    kasPersen: 5,
    kasNominal: tvKasNominal,
    nominal: tvPendapatanBersih,
    fotoUrl: fotoUrl || "",
    createdAt: waktu,
    createdBy: currentUser ? currentUser.role : "Admin",
    monthKey: monthKey,
    owner: tvUnit === "TV_A" ? "Adan Glena" : "Aldo Laras",
    sumberUnit: "tv_otomatis"
  };

  updates["kasTransactions/" + tvKasRef.key] = {
    jenis: "masuk",
    nominal: tvKasNominal,
    persentase: 5,
    keterangan: "Kas 5% dari sewa " + (tvUnit === "TV_A" ? "TV A — Adan Glena" : "TV B — Aldo Laras"),
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
          alert("Sewa berhasil disimpan!\n\nKas 5%: " + formatRp(kasNominal) + "\nPendapatan bersih: " + formatRp(pendapatanBersih));
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

function renderExpenseHistory() {
  const history = $("expenseHistory");
  if (!history) return;

  if (!allExpenses.length) {
    history.innerHTML = '<p class="empty">Belum ada pengeluaran</p>';
    return;
  }

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
    return total + (item.jenis === "masuk" ? Number(item.nominal || 0) : 0);
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
        '<div class="meta">' + summary.transactionCount + ' transaksi · Kas ' + formatRp(summary.kas) + ' · Pengeluaran ' + formatRp(summary.expenses) + '</div>' +
      '</div>' +
      '<div class="item-amount">' + formatRp(summary.final) + '</div>' +
      '</div>';
  }).join("");
}

if (monthlySelect) {
  monthlySelect.addEventListener("change", function() {
    renderSelectedMonth(monthlySelect.value);
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

    const kasNominal = Math.round(nominalKotor * KAS_PERCENT);
    const pendapatanBersih = nominalKotor - kasNominal;

    if (saveEditBtn) saveEditBtn.disabled = true;

    try {
      const updates = {};

      updates["rentals/" + id + "/nomorPenyewa"] = nomor;
      updates["rentals/" + id + "/psUnit"] = psUnit;
      updates["rentals/" + id + "/durasi"] = durasi;
      updates["rentals/" + id + "/durasiUnit"] = durasiUnit;
      updates["rentals/" + id + "/nominalKotor"] = nominalKotor;
      updates["rentals/" + id + "/kasPersen"] = 5;
      updates["rentals/" + id + "/kasNominal"] = kasNominal;
      updates["rentals/" + id + "/nominal"] = pendapatanBersih;
      updates["rentals/" + id + "/updatedAt"] = Date.now();
      updates["rentals/" + id + "/updatedBy"] = currentUser.role;

      const relatedKas = allKasTransactions.find(function(kas) {
        return kas.rentalId === id;
      });

      if (relatedKas) {
        updates["kasTransactions/" + relatedKas.id + "/nominal"] = kasNominal;
        updates["kasTransactions/" + relatedKas.id + "/keterangan"] = "Kas 5% dari sewa PS " + psUnit;
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

  if (!confirm("Hapus transaksi kas ini?\n\nMenghapus kas tidak menghapus transaksi sewa atau pengeluaran asal.")) return;

  try {
    await db.ref("kasTransactions/" + id).remove();
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
    closeEditExpenseModalForm();
    closeEditKasModalForm();

    if (pinInput) pinInput.focus();
  });
}

initFirebase();
checkSession();

if (pinInput) pinInput.focus();
