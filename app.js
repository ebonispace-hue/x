// =====================================================
// PANEL OMSET SEWA PS
// Login Admin: 888999 | Master: 171717
// Omset reset otomatis per bulan
// Kas berjalan: +5% dari sewa, -pengeluaran
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
const MAX_FOTO_SIZE = 1.5 * 1024 * 1024;

let db = null;
let firebaseReady = false;
let firebaseErrorMsg = "";
let currentUser = null;

let allRentals = [];
let allExpenses = [];
let allKasTransactions = [];
let databaseListenersStarted = false;

// =====================================================
// ELEMENT HTML
// =====================================================

const loginScreen = document.getElementById("loginScreen");
const dashboardScreen = document.getElementById("dashboardScreen");
const pinInput = document.getElementById("pinInput");
const loginBtn = document.getElementById("loginBtn");
const loginError = document.getElementById("loginError");
const logoutBtn = document.getElementById("logoutBtn");
const userRole = document.getElementById("userRole");

const rentalForm = document.getElementById("rentalForm");
const fotoInput = document.getElementById("foto");
const fileName = document.getElementById("fileName");
const previewContainer = document.getElementById("previewContainer");
const fotoPreview = document.getElementById("fotoPreview");
const removeFoto = document.getElementById("removeFoto");
const submitBtn = document.getElementById("submitBtn");

const openExpenseModal = document.getElementById("openExpenseModal");
const expenseModal = document.getElementById("expenseModal");
const expenseModalOverlay = document.getElementById("expenseModalOverlay");
const closeExpenseModal = document.getElementById("closeExpenseModal");
const cancelExpense = document.getElementById("cancelExpense");
const expenseForm = document.getElementById("expenseForm");
const expenseNominal = document.getElementById("expenseNominal");
const expenseKeterangan = document.getElementById("expenseKeterangan");
const saveExpenseBtn = document.getElementById("saveExpenseBtn");

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const closeModal = document.getElementById("closeModal");
const cancelEdit = document.getElementById("cancelEdit");
const modalOverlay = document.getElementById("modalOverlay");
const saveEditBtn = document.getElementById("saveEditBtn");

const monthlySelect = document.getElementById("monthlySelect");

// =====================================================
// FIREBASE
// =====================================================

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

// =====================================================
// HELPER
// =====================================================

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
  const date = new Date(Number(timestamp));

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return year + "-" + month;
}

function formatMonthKey(monthKey) {
  const parts = String(monthKey || "").split("-");

  if (parts.length !== 2) return monthKey || "-";

  return new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric"
  }).format(
    new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
  );
}

function isMaster() {
  return currentUser && currentUser.role === "Master";
}

function getRentalGross(rental) {
  if (rental && rental.nominalKotor !== undefined) {
    return Number(rental.nominalKotor || 0);
  }

  return Number(rental?.nominal || 0);
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

function updateActiveMonthLabel() {
  document.getElementById("activeMonthLabel").textContent =
    formatMonthKey(getMonthKey(Date.now()));
}

// =====================================================
// LOGIN
// =====================================================

function checkSession() {
  const saved = sessionStorage.getItem("ps_user");

  if (!saved) return;

  try {
    currentUser = JSON.parse(saved);

    if (!currentUser || !currentUser.role) {
      throw new Error("Session tidak valid");
    }

    showDashboard();
  } catch {
    sessionStorage.removeItem("ps_user");
  }
}

function doLogin() {
  const pin = pinInput.value.trim();

  loginError.textContent = "";

  if (!USERS[pin]) {
    loginError.textContent = "PIN salah. Coba lagi.";
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
  loginScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");

  userRole.textContent = currentUser.role;

  updateActiveMonthLabel();

  if (!firebaseReady) {
    initFirebase();
  }

  if (!firebaseReady) {
    document.getElementById("totalAll").textContent = "Firebase Error";
    return;
  }

  startDatabaseListeners();
}

// =====================================================
// REALTIME DATABASE LISTENER
// =====================================================

function startDatabaseListeners() {
  if (!db || databaseListenersStarted) return;

  databaseListenersStarted = true;

  db.ref("rentals")
    .orderByChild("createdAt")
    .on("value", function(snapshot) {
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
      refreshMonthlyRecap();
      refreshExpenseSummary();
    });

  db.ref("expenses")
    .orderByChild("createdAt")
    .on("value", function(snapshot) {
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
    });

  db.ref("kasTransactions")
    .orderByChild("createdAt")
    .on("value", function(snapshot) {
      const kasTransactions = [];

      snapshot.forEach(function(child) {
        const data = child.val() || {};
        data.id = child.key;
        kasTransactions.push(data);
      });

      kasTransactions.sort(function(a, b) {
        return Number(b.createdAt || 0) - Number(a.createdAt || 0);
      });

      allKasTransactions = kasTransactions;

      renderKasSummary();
      refreshMonthlyRecap();
    });
}

// =====================================================
// DASHBOARD OMSET BULAN BERJALAN
// =====================================================

function updateDashboard() {
  updateActiveMonthLabel();

  const currentMonth = getMonthKey(Date.now());

  const rentalsThisMonth = allRentals.filter(function(rental) {
    return getMonthKey(rental.createdAt) === currentMonth;
  });

  let totalAC = 0;
  let totalB = 0;

  rentalsThisMonth.forEach(function(rental) {
    const net = getPendapatanBersih(rental);

    if (rental.psUnit === "A" || rental.psUnit === "C") {
      totalAC += net;
    } else if (rental.psUnit === "B") {
      totalB += net;
    }
  });

  document.getElementById("totalAC").textContent = formatRp(totalAC);
  document.getElementById("totalB").textContent = formatRp(totalB);
  document.getElementById("totalAll").textContent =
    formatRp(totalAC + totalB);

  renderLatestHistory();
  renderTopPenyewa(rentalsThisMonth);
}

function renderLatestHistory() {
  const latestEl = document.getElementById("latestHistory");

  if (!allRentals.length) {
    latestEl.innerHTML = '<p class="empty">Belum ada data</p>';
    return;
  }

  latestEl.innerHTML = allRentals.slice(0, 10).map(function(rental) {
    const actions = isMaster()
      ? '<div class="item-actions">' +
          '<button class="btn-action btn-edit" data-id="' +
          rental.id +
          '"><i class="fas fa-pen"></i></button>' +
          '<button class="btn-action btn-delete" data-id="' +
          rental.id +
          '"><i class="fas fa-trash"></i></button>' +
        "</div>"
      : "";

    return (
      '<div class="history-item">' +
      (rental.fotoUrl
        ? '<img src="' + rental.fotoUrl + '" alt="Foto">'
        : '<div class="no-photo"><i class="fas fa-user"></i></div>') +
      '<div class="item-info">' +
        '<div class="nomor">' +
        escapeHtml(rental.nomorPenyewa) +
        "</div>" +
        '<div class="meta">PS ' +
        escapeHtml(rental.psUnit) +
        " · " +
        Number(rental.durasi || 0) +
        " " +
        escapeHtml(rental.durasiUnit || "jam") +
        " · " +
        formatDate(rental.createdAt) +
        "</div>" +
      "</div>" +
      '<div class="item-amount">' +
      formatRp(getPendapatanBersih(rental)) +
      "</div>" +
      actions +
      "</div>"
    );
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
  const topEl = document.getElementById("topPenyewa");
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

    if (rental.fotoUrl) {
      countMap[key].lastFoto = rental.fotoUrl;
    }
  });

  const sorted = Object.values(countMap).sort(function(a, b) {
    if (b.count !== a.count) {
      return b.count - a.count;
    }

    return b.total - a.total;
  });

  if (!sorted.length) {
    topEl.innerHTML =
      '<p class="empty">Belum ada transaksi pada bulan ini</p>';
    return;
  }

  topEl.innerHTML = sorted.slice(0, 10).map(function(item, index) {
    const rankClass =
      index === 0 ? "gold" :
      index === 1 ? "silver" :
      index === 2 ? "bronze" : "";

    return (
      '<div class="history-item">' +
      '<div class="rank-badge ' +
      rankClass +
      '">' +
      (index + 1) +
      "</div>" +
      (item.lastFoto
        ? '<img src="' + item.lastFoto + '" alt="Foto">'
        : '<div class="no-photo"><i class="fas fa-user"></i></div>') +
      '<div class="item-info">' +
        '<div class="nomor">' +
        escapeHtml(item.nomor) +
        "</div>" +
        '<div class="meta">' +
        item.count +
        "x sewa · Total " +
        formatRp(item.total) +
        "</div>" +
      "</div>" +
      "</div>"
    );
  }).join("");
}

// =====================================================
// KAS BERJALAN
// =====================================================

function renderKasSummary() {
  let masuk = 0;
  let keluar = 0;

  allKasTransactions.forEach(function(kas) {
    const nominalKas = Number(kas.nominal || 0);

    if (kas.jenis === "masuk") {
      masuk += nominalKas;
    } else if (kas.jenis === "keluar") {
      keluar += nominalKas;
    }
  });

  document.getElementById("kasMasuk").textContent = formatRp(masuk);
  document.getElementById("kasKeluar").textContent = formatRp(keluar);
  document.getElementById("kasSaldo").textContent =
    formatRp(masuk - keluar);
}

// =====================================================
// FOTO GALERI / KAMERA
// =====================================================

function resetFotoInput() {
  fotoInput.value = "";
  fotoPreview.src = "";
  fileName.textContent = "Pilih Foto dari Galeri / Kamera";
  previewContainer.classList.add("hidden");
}

fotoInput.addEventListener("change", function(event) {
  const file = event.target.files && event.target.files[0];

  if (!file) return;

  if (!file.type || !file.type.startsWith("image/")) {
    alert("File yang dipilih harus berupa gambar.");
    resetFotoInput();
    return;
  }

  if (file.size > MAX_FOTO_SIZE) {
    alert("Ukuran foto maksimal 1.5 MB.");
    resetFotoInput();
    return;
  }

  fileName.textContent = file.name;

  const reader = new FileReader();

  reader.onload = function(loadEvent) {
    fotoPreview.src = loadEvent.target.result;
    previewContainer.classList.remove("hidden");
  };

  reader.readAsDataURL(file);
});

removeFoto.addEventListener("click", resetFotoInput);

// =====================================================
// SIMPAN SEWA + KAS 5%
// =====================================================

rentalForm.addEventListener("submit", function(event) {
  event.preventDefault();

  if (!firebaseReady) {
    initFirebase();
  }

  if (!firebaseReady || !db) {
    alert("Firebase belum siap.");
    return;
  }

  const nomor = document.getElementById("nomorPenyewa").value.trim();
  const psUnit = document.getElementById("psUnit").value;
  const durasi = Number(document.getElementById("durasi").value);
  const durasiUnit = document.getElementById("durasiUnit").value;
  const nominalKotor = Number(document.getElementById("nominal").value);
  const file = fotoInput.files && fotoInput.files[0];

  if (!nomor || !psUnit || !durasi || !nominalKotor) {
    alert("Lengkapi semua form sewa.");
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

  function saveData(fotoUrl) {
    const rentalRef = db.ref("rentals").push();
    const kasRef = db.ref("kasTransactions").push();

    const waktu = Date.now();

    const kasNominal = Math.round(nominalKotor * KAS_PERCENT);
    const pendapatanBersih = nominalKotor - kasNominal;
    const monthKey = getMonthKey(waktu);

    const rentalData = {
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
      createdBy: currentUser.role,
      monthKey: monthKey
    };

    const kasData = {
      jenis: "masuk",
      nominal: kasNominal,
      persentase: 5,
      keterangan: "Kas 5% dari sewa PS " + psUnit,
      sumber: "sewa_otomatis",
      rentalId: rentalRef.key,
      createdAt: waktu,
      createdBy: currentUser.role,
      monthKey: monthKey
    };

    const updates = {};

    updates["rentals/" + rentalRef.key] = rentalData;
    updates["kasTransactions/" + kasRef.key] = kasData;

    db.ref().update(updates)
      .then(function() {
        rentalForm.reset();
        resetFotoInput();

        alert(
          "Sewa berhasil disimpan!\n\n" +
          "Sewa kotor: " + formatRp(nominalKotor) + "\n" +
          "Kas otomatis 5%: " + formatRp(kasNominal) + "\n" +
          "Pendapatan bersih: " + formatRp(pendapatanBersih)
        );
      })
      .catch(function(error) {
        alert("Gagal menyimpan sewa: " + error.message);
      })
      .finally(function() {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<i class="fas fa-save"></i> Simpan Sewa';
      });
  }

  if (file) {
    const reader = new FileReader();

    reader.onload = function(loadEvent) {
      saveData(loadEvent.target.result);
    };

    reader.readAsDataURL(file);
  } else {
    saveData("");
  }
});

// =====================================================
// PENGELUARAN
// =====================================================

function openExpenseModalForm() {
  expenseForm.reset();
  expenseModal.classList.remove("hidden");
}

function closeExpenseModalForm() {
  expenseModal.classList.add("hidden");
  expenseForm.reset();
}

openExpenseModal.addEventListener("click", openExpenseModalForm);
closeExpenseModal.addEventListener("click", closeExpenseModalForm);
cancelExpense.addEventListener("click", closeExpenseModalForm);
expenseModalOverlay.addEventListener("click", closeExpenseModalForm);

expenseForm.addEventListener("submit", function(event) {
  event.preventDefault();

  const nominalExpense = Number(expenseNominal.value);
  const keterangan = expenseKeterangan.value.trim();

  if (!nominalExpense || nominalExpense <= 0 || !keterangan) {
    alert("Lengkapi nominal dan keterangan pengeluaran.");
    return;
  }

  saveExpenseBtn.disabled = true;
  saveExpenseBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

  const expenseRef = db.ref("expenses").push();
  const kasKeluarRef = db.ref("kasTransactions").push();

  const waktu = Date.now();
  const monthKey = getMonthKey(waktu);

  const expenseData = {
    kategori: "Pengeluaran Usaha",
    nominal: nominalExpense,
    keterangan: keterangan,
    createdAt: waktu,
    createdBy: currentUser.role,
    monthKey: monthKey
  };

  const kasKeluarData = {
    jenis: "keluar",
    nominal: nominalExpense,
    keterangan: "Pengeluaran: " + keterangan,
    sumber: "pengeluaran",
    expenseId: expenseRef.key,
    createdAt: waktu,
    createdBy: currentUser.role,
    monthKey: monthKey
  };

  const updates = {};

  updates["expenses/" + expenseRef.key] = expenseData;
  updates["kasTransactions/" + kasKeluarRef.key] = kasKeluarData;

  db.ref().update(updates)
    .then(function() {
      closeExpenseModalForm();

      alert(
        "Pengeluaran berhasil disimpan.\n\n" +
        "Kas berkurang: " + formatRp(nominalExpense)
      );
    })
    .catch(function(error) {
      alert("Gagal menyimpan pengeluaran: " + error.message);
    })
    .finally(function() {
      saveExpenseBtn.disabled = false;
      saveExpenseBtn.innerHTML =
        '<i class="fas fa-save"></i> Simpan Pengeluaran';
    });
});

function renderExpenseHistory() {
  const historyEl = document.getElementById("expenseHistory");

  if (!allExpenses.length) {
    historyEl.innerHTML =
      '<p class="empty">Belum ada pengeluaran</p>';
    return;
  }

  historyEl.innerHTML = allExpenses.slice(0, 10).map(function(expense) {
    return (
      '<div class="history-item">' +
      '<div class="rank-badge bronze">' +
      '<i class="fas fa-arrow-up"></i>' +
      "</div>" +
      '<div class="item-info">' +
        '<div class="nomor">Pengeluaran Usaha</div>' +
        '<div class="meta">' +
        escapeHtml(expense.keterangan) +
        " · " +
        formatDate(expense.createdAt) +
        "</div>" +
      "</div>" +
      '<div class="item-amount" style="color:#fb7185;">-' +
      formatRp(expense.nominal) +
      "</div>" +
      "</div>"
    );
  }).join("");
}

function refreshExpenseSummary() {
  const currentMonth = getMonthKey(Date.now());

  const pendapatanBulanIni = allRentals
    .filter(function(rental) {
      return getMonthKey(rental.createdAt) === currentMonth;
    })
    .reduce(function(total, rental) {
      return total + getPendapatanBersih(rental);
    }, 0);

  const pengeluaranBulanIni = allExpenses
    .filter(function(expense) {
      return getMonthKey(expense.createdAt) === currentMonth;
    })
    .reduce(function(total, expense) {
      return total + Number(expense.nominal || 0);
    }, 0);

  document.getElementById("totalExpenses").textContent =
    formatRp(pengeluaranBulanIni);

  document.getElementById("netIncome").textContent =
    formatRp(pendapatanBulanIni - pengeluaranBulanIni);
}

// =====================================================
// REKAP BULANAN
// =====================================================

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
    if (item.jenis === "masuk") {
      return total + Number(item.nominal || 0);
    }

    return total;
  }, 0);

  const expensesTotal = expenses.reduce(function(total, expense) {
    return total + Number(expense.nominal || 0);
  }, 0);

  return {
    transactionCount: rentals.length,
    income: income,
    kas: kasMasuk,
    expenses: expensesTotal,
    final: income - expensesTotal
  };
}

function getAvailableMonthKeys() {
  const keys = new Set();

  allRentals.forEach(function(item) {
    if (item.createdAt) {
      keys.add(getMonthKey(item.createdAt));
    }
  });

  allExpenses.forEach(function(item) {
    if (item.createdAt) {
      keys.add(getMonthKey(item.createdAt));
    }
  });

  allKasTransactions.forEach(function(item) {
    if (item.createdAt) {
      keys.add(getMonthKey(item.createdAt));
    }
  });

  keys.add(getMonthKey(Date.now()));

  return Array.from(keys).sort().reverse();
}

function refreshMonthlyRecap() {
  const monthKeys = getAvailableMonthKeys();
  const selectedBefore = monthlySelect.value;

  monthlySelect.innerHTML = monthKeys.map(function(key) {
    return (
      '<option value="' +
      key +
      '">' +
      escapeHtml(formatMonthKey(key)) +
      "</option>"
    );
  }).join("");

  if (monthKeys.includes(selectedBefore)) {
    monthlySelect.value = selectedBefore;
  } else {
    monthlySelect.value = getMonthKey(Date.now());
  }

  renderSelectedMonth(monthlySelect.value);
  renderMonthlyHistory(monthKeys);
}

function renderSelectedMonth(monthKey) {
  const summary = getMonthlySummary(monthKey);

  document.getElementById("monthlyIncome").textContent =
    formatRp(summary.income);

  document.getElementById("monthlyKas").textContent =
    formatRp(summary.kas);

  document.getElementById("monthlyExpenses").textContent =
    formatRp(summary.expenses);

  document.getElementById("monthlyFinal").textContent =
    formatRp(summary.final);
}

function renderMonthlyHistory(monthKeys) {
  const historyEl = document.getElementById("monthlyHistory");

  historyEl.innerHTML = monthKeys.map(function(monthKey) {
    const summary = getMonthlySummary(monthKey);

    return (
      '<div class="history-item">' +
      '<div class="rank-badge gold">' +
      '<i class="fas fa-calendar"></i>' +
      "</div>" +
      '<div class="item-info">' +
        '<div class="nomor">' +
        escapeHtml(formatMonthKey(monthKey)) +
        "</div>" +
        '<div class="meta">' +
        summary.transactionCount +
        " transaksi · Kas " +
        formatRp(summary.kas) +
        " · Pengeluaran " +
        formatRp(summary.expenses) +
        "</div>" +
      "</div>" +
      '<div class="item-amount">' +
      formatRp(summary.final) +
      "</div>" +
      "</div>"
    );
  }).join("");
}

monthlySelect.addEventListener("change", function() {
  renderSelectedMonth(monthlySelect.value);
});

// =====================================================
// EDIT DAN HAPUS MASTER
// =====================================================

function openEditModal(id) {
  if (!isMaster()) return;

  const rental = allRentals.find(function(item) {
    return item.id === id;
  });

  if (!rental) return;

  document.getElementById("editId").value = rental.id;
  document.getElementById("editNomor").value =
    rental.nomorPenyewa || "";

  document.getElementById("editPsUnit").value =
    rental.psUnit || "A";

  document.getElementById("editDurasi").value =
    rental.durasi || 1;

  document.getElementById("editDurasiUnit").value =
    rental.durasiUnit || "jam";

  document.getElementById("editNominal").value =
    getRentalGross(rental);

  editModal.classList.remove("hidden");
}

function closeEditModal() {
  editModal.classList.add("hidden");
  editForm.reset();
}

closeModal.addEventListener("click", closeEditModal);
cancelEdit.addEventListener("click", closeEditModal);
modalOverlay.addEventListener("click", closeEditModal);

editForm.addEventListener("submit", function(event) {
  event.preventDefault();

  if (!isMaster()) return;

  const id = document.getElementById("editId").value;

  const nomor = document.getElementById("editNomor").value.trim();
  const psUnit = document.getElementById("editPsUnit").value;
  const durasi = Number(document.getElementById("editDurasi").value);
  const durasiUnit = document.getElementById("editDurasiUnit").value;
  const nominalKotor = Number(document.getElementById("editNominal").value);

  const kasNominal = Math.round(nominalKotor * KAS_PERCENT);
  const pendapatanBersih = nominalKotor - kasNominal;

  saveEditBtn.disabled = true;

  db.ref("rentals/" + id)
    .update({
      nomorPenyewa: nomor,
      psUnit: psUnit,
      durasi: durasi,
      durasiUnit: durasiUnit,
      nominalKotor: nominalKotor,
      kasPersen: 5,
      kasNominal: kasNominal,
      nominal: pendapatanBersih,
      updatedAt: Date.now(),
      updatedBy: currentUser.role
    })
    .then(function() {
      closeEditModal();

      alert(
        "Transaksi berhasil diperbarui.\n\n" +
        "Catatan kas lama tidak otomatis berubah."
      );
    })
    .catch(function(error) {
      alert("Gagal edit transaksi: " + error.message);
    })
    .finally(function() {
      saveEditBtn.disabled = false;
    });
});

function deleteRental(id) {
  if (!isMaster()) return;

  const rental = allRentals.find(function(item) {
    return item.id === id;
  });

  if (!rental) return;

  if (!confirm("Hapus transaksi sewa ini?")) {
    return;
  }

  db.ref("rentals/" + id)
    .remove()
    .catch(function(error) {
      alert("Gagal hapus transaksi: " + error.message);
    });
}

// =====================================================
// EVENT UTAMA
// =====================================================

loginBtn.addEventListener("click", doLogin);

pinInput.addEventListener("keydown", function(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    doLogin();
  }
});

logoutBtn.addEventListener("click", function() {
  currentUser = null;

  sessionStorage.removeItem("ps_user");

  dashboardScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");

  closeEditModal();
  closeExpenseModalForm();

  pinInput.focus();
});

initFirebase();
checkSession();
pinInput.focus();
