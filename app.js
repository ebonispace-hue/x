// =====================================================
// PANEL OMSET SEWA PS — app.js
// Login Admin: 888999 | Master: 171717
// Rotasi PS: A/Adan Glena → B/Aldo Laras → C/Adan Glena
// Rotasi TV: TV B → TV A
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
const PS_ROTATION = [
  { unit: "A", owner: "Adan Glena" },
  { unit: "B", owner: "Aldo Laras" },
  { unit: "C", owner: "Adan Glena" }
];
const TV_ROTATION = ["TV B", "TV A"];

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

const resetRotationBtn = $("resetRotationBtn");
const resetRotationModal = $("resetRotationModal");
const resetRotationOverlay = $("resetRotationOverlay");
const closeResetRotationModal = $("closeResetRotationModal");
const cancelResetRotation = $("cancelResetRotation");
const confirmResetRotation = $("confirmResetRotation");

function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      firebaseErrorMsg = "Library Firebase belum termuat.";
      return false;
    }
    if (!firebase.apps || !firebase.apps.length) firebase.initializeApp(firebaseConfig);
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
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
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
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" })
    .format(new Date(Number(parts[0]), Number(parts[1]) - 1, 1));
}

function isMaster() {
  return currentUser && currentUser.role === "Master";
}

function getRentalGross(rental) {
  if (rental && rental.nominalKotor !== undefined) return Number(rental.nominalKotor || 0);
  return Number((rental && rental.nominal) || 0);
}

function getRentalKas(rental) {
  if (rental && rental.kasNominal !== undefined) return Number(rental.kasNominal || 0);
  return Math.round(getRentalGross(rental) * KAS_PERCENT);
}

function getPendapatanBersih(rental) {
  if (rental && rental.nominalKotor !== undefined) return Number(rental.nominal || 0);
  return getRentalGross(rental) - getRentalKas(rental);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value;
}

function updateActiveMonthLabel() {
  setText("activeMonthLabel", formatMonthKey(getMonthKey(Date.now())));
}

function getRotationStateFromRentals() {
  const rentals = allRentals.slice().sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0));
  let psIndex = 0;
  let tvIndex = 0;

  rentals.forEach((rental) => {
    const psFound = PS_ROTATION.findIndex((item) => item.unit === rental.psUnit);
    if (psFound >= 0) psIndex = (psFound + 1) % PS_ROTATION.length;
    else psIndex = (psIndex + 1) % PS_ROTATION.length;

    const tvFound = TV_ROTATION.indexOf(rental.tvUnit);
    if (tvFound >= 0) tvIndex = (tvFound + 1) % TV_ROTATION.length;
    else tvIndex = (tvIndex + 1) % TV_ROTATION.length;
  });

  return { psIndex, tvIndex };
}

async function getRotationState() {
  if (!db) throw new Error("Firebase belum siap");
  const snapshot = await db.ref("system/rentalRotation").once("value");
  const saved = snapshot.val();

  if (saved && Number.isInteger(saved.psIndex) && Number.isInteger(saved.tvIndex)) {
    return {
      psIndex: saved.psIndex % PS_ROTATION.length,
      tvIndex: saved.tvIndex % TV_ROTATION.length
    };
  }

  const inferred = getRotationStateFromRentals();
  await db.ref("system/rentalRotation").set({
    ...inferred,
    initializedAt: Date.now(),
    initializedBy: currentUser ? currentUser.role : "System"
  });
  return inferred;
}

async function refreshRotationPreview() {
  if (!db) return;
  try {
    const state = await getRotationState();
    const ps = PS_ROTATION[state.psIndex];
    const tv = TV_ROTATION[state.tvIndex];

    setText("nextPsRotation", `PS ${ps.unit} — ${ps.owner}`);
    setText("nextTvRotation", tv);
    setText("psUnitDisplay", `PS ${ps.unit}`);
    setText("psOwnerDisplay", ps.owner);
    setText("tvUnitDisplay", tv);

    const psUnit = $("psUnit");
    const psOwner = $("psOwner");
    const tvUnit = $("tvUnit");
    if (psUnit) psUnit.value = ps.unit;
    if (psOwner) psOwner.value = ps.owner;
    if (tvUnit) tvUnit.value = tv;
  } catch (error) {
    console.error("Gagal memuat rotasi:", error);
    setText("nextPsRotation", "Gagal memuat giliran");
    setText("nextTvRotation", "Gagal memuat giliran");
  }
}

function updateRoleUi() {
  if (resetRotationBtn) resetRotationBtn.classList.toggle("hidden", !isMaster());
}

function checkSession() {
  const saved = sessionStorage.getItem("ps_user");
  if (!saved) return;
  try {
    currentUser = JSON.parse(saved);
    if (!currentUser || !currentUser.role) throw new Error("Session tidak valid");
    showDashboard();
  } catch {
    sessionStorage.removeItem("ps_user");
  }
}

function doLogin() {
  const pin = pinInput ? pinInput.value.trim() : "";
  if (loginError) loginError.textContent = "";
  if (!USERS[pin]) {
    if (loginError) loginError.textContent = "PIN salah. Coba lagi.";
    if (pinInput) {
      pinInput.value = "";
      pinInput.focus();
    }
    return;
  }
  currentUser = USERS[pin];
  sessionStorage.setItem("ps_user", JSON.stringify(currentUser));
  if (pinInput) pinInput.value = "";
  showDashboard();
}

function showDashboard() {
  if (loginScreen) loginScreen.classList.add("hidden");
  if (dashboardScreen) dashboardScreen.classList.remove("hidden");
  if (userRole && currentUser) userRole.textContent = currentUser.role;
  updateActiveMonthLabel();
  updateRoleUi();

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

  db.ref("rentals").orderByChild("createdAt").on("value", (snapshot) => {
    const rentals = [];
    snapshot.forEach((child) => rentals.push({ ...(child.val() || {}), id: child.key }));
    rentals.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    allRentals = rentals;
    updateDashboard();
    refreshExpenseSummary();
    refreshMonthlyRecap();
    refreshRotationPreview();
  }, databaseError);

  db.ref("expenses").orderByChild("createdAt").on("value", (snapshot) => {
    const expenses = [];
    snapshot.forEach((child) => expenses.push({ ...(child.val() || {}), id: child.key }));
    expenses.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
    allExpenses = expenses;
    renderExpenseHistory();
    refreshExpenseSummary();
    refreshMonthlyRecap();
  }, databaseError);

  db.ref("kasTransactions").orderByChild("createdAt").on("value", (snapshot) => {
    const kas = [];
    snapshot.forEach((child) => kas.push({ ...(child.val() || {}), id: child.key }));
    kas.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
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
  const rentalsThisMonth = allRentals.filter((rental) => getMonthKey(rental.createdAt) === currentMonth);
  let totalAC = 0;
  let totalB = 0;
  let totalGross = 0;

  rentalsThisMonth.forEach((rental) => {
    const gross = getRentalGross(rental);
    const net = getPendapatanBersih(rental);
    totalGross += gross;
    if (rental.psUnit === "A" || rental.psUnit === "C") totalAC += net;
    if (rental.psUnit === "B") totalB += net;
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

  latestEl.innerHTML = allRentals.slice(0, 10).map((rental) => {
    const actions = isMaster()
      ? '<div class="item-actions"><button class="btn-action btn-edit" data-id="' + rental.id + '" title="Edit transaksi"><i class="fas fa-pen"></i></button><button class="btn-action btn-delete" data-id="' + rental.id + '" title="Hapus transaksi"><i class="fas fa-trash"></i></button></div>'
      : "";
    return '<div class="history-item">' +
      (rental.fotoUrl ? '<img src="' + rental.fotoUrl + '" alt="Foto penyewa">' : '<div class="no-photo"><i class="fas fa-user"></i></div>') +
      '<div class="item-info"><div class="nomor">' + escapeHtml(rental.nomorPenyewa) + '</div>' +
      '<div class="meta">PS ' + escapeHtml(rental.psUnit) + ' · ' + escapeHtml(rental.psOwner || "-") + ' · ' + escapeHtml(rental.tvUnit || "-") + '</div>' +
      '<div class="meta">' + Number(rental.durasi || 0) + ' ' + escapeHtml(rental.durasiUnit || "jam") + ' · ' + formatDate(rental.createdAt) + '</div>' +
      '<div class="meta" style="color:#facc15; margin-top:4px;">Omset kotor · Kas 5%: ' + formatRp(getRentalKas(rental)) + '</div></div>' +
      '<div class="item-amount">' + formatRp(getRentalGross(rental)) + '</div>' + actions + '</div>';
  }).join("");

  if (isMaster()) {
    latestEl.querySelectorAll(".btn-edit").forEach((button) => button.addEventListener("click", () => openEditModal(button.dataset.id)));
    latestEl.querySelectorAll(".btn-delete").forEach((button) => button.addEventListener("click", () => deleteRental(button.dataset.id)));
  }
}

function renderTopPenyewa(rentals) {
  const topEl = $("topPenyewa");
  if (!topEl) return;
  const countMap = {};
  rentals.forEach((rental) => {
    const key = rental.nomorPenyewa || "-";
    if (!countMap[key]) countMap[key] = { nomor: key, count: 0, total: 0, lastFoto: rental.fotoUrl || "" };
    countMap[key].count += 1;
    countMap[key].total += getPendapatanBersih(rental);
    if (rental.fotoUrl) countMap[key].lastFoto = rental.fotoUrl;
  });
  const sorted = Object.values(countMap).sort((a, b) => b.count - a.count || b.total - a.total);
  if (!sorted.length) {
    topEl.innerHTML = '<p class="empty">Belum ada transaksi pada bulan ini</p>';
    return;
  }
  topEl.innerHTML = sorted.slice(0, 10).map((item, index) => {
    const rankClass = index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "bronze" : "";
    return '<div class="history-item"><div class="rank-badge ' + rankClass + '">' + (index + 1) + '</div>' +
      (item.lastFoto ? '<img src="' + item.lastFoto + '" alt="Foto penyewa">' : '<div class="no-photo"><i class="fas fa-user"></i></div>') +
      '<div class="item-info"><div class="nomor">' + escapeHtml(item.nomor) + '</div><div class="meta">' + item.count + 'x sewa · Total ' + formatRp(item.total) + '</div></div></div>';
  }).join("");
}

function getKasFallbackFromRentals() {
  const rentalIdWithKas = new Set(allKasTransactions.filter((kas) => kas && kas.rentalId).map((kas) => kas.rentalId));
  return allRentals.filter((rental) => !rentalIdWithKas.has(rental.id)).reduce((total, rental) => total + getRentalKas(rental), 0);
}

function getKasVirtualHistory() {
  const rentalIdWithKas = new Set(allKasTransactions.filter((kas) => kas && kas.rentalId).map((kas) => kas.rentalId));
  return allRentals.filter((rental) => !rentalIdWithKas.has(rental.id)).map((rental) => ({
    id: "virtual_" + rental.id,
    virtual: true,
    jenis: "masuk",
    nominal: getRentalKas(rental),
    keterangan: "Kas 5% dari transaksi lama PS " + (rental.psUnit || "-"),
    createdAt: rental.createdAt,
    rentalId: rental.id
  }));
}

function renderKasSummary() {
  let kasMasukTersimpan = 0;
  let kasKeluar = 0;
  allKasTransactions.forEach((kas) => {
    if (kas.jenis === "masuk") kasMasukTersimpan += Number(kas.nominal || 0);
    if (kas.jenis === "keluar") kasKeluar += Number(kas.nominal || 0);
  });
  const totalKasMasuk = kasMasukTersimpan + getKasFallbackFromRentals();
  setText("kasMasuk", formatRp(totalKasMasuk));
  setText("kasKeluar", formatRp(kasKeluar));
  setText("kasSaldo", formatRp(totalKasMasuk - kasKeluar));
  renderKasHistory();
}

function renderKasHistory() {
  const history = $("kasHistory");
  if (!history) return;
  const items = allKasTransactions.concat(getKasVirtualHistory()).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
  if (!items.length) {
    history.innerHTML = '<p class="empty">Belum ada transaksi kas</p>';
    return;
  }
  history.innerHTML = items.slice(0, 10).map((kas) => {
    const masuk = kas.jenis === "masuk";
    return '<div class="history-item"><div class="rank-badge ' + (masuk ? "gold" : "bronze") + '">' + (masuk ? '<i class="fas fa-arrow-down"></i>' : '<i class="fas fa-arrow-up"></i>') + '</div>' +
      '<div class="item-info"><div class="nomor">' + (masuk ? "Kas Masuk" : "Kas Keluar") + '</div><div class="meta">' + escapeHtml(kas.keterangan || "-") + ' · ' + formatDate(kas.createdAt) + '</div></div>' +
      '<div class="item-amount" style="color:' + (masuk ? "#5eead4" : "#fb7185") + ';">' + (masuk ? "+" : "-") + formatRp(kas.nominal) + '</div></div>';
  }).join("");
}

function resetFotoInput() {
  if (fotoInput) fotoInput.value = "";
  if (fotoPreview) fotoPreview.src = "";
  if (fileName) fileName.textContent = "Pilih Foto dari Galeri / Kamera";
  if (previewContainer) previewContainer.classList.add("hidden");
}

if (fotoInput) {
  fotoInput.addEventListener("change", (event) => {
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
    reader.onload = (loadEvent) => {
      if (fotoPreview) fotoPreview.src = loadEvent.target.result;
      if (previewContainer) previewContainer.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  });
}

if (removeFoto) removeFoto.addEventListener("click", resetFotoInput);

async function allocateAndSaveRental(data) {
  const rotationRef = db.ref("system/rentalRotation");
  const allocations = [];

  const transaction = await rotationRef.transaction((state) => {
    const current = state && Number.isInteger(state.psIndex) && Number.isInteger(state.tvIndex)
      ? state
      : getRotationStateFromRentals();

    const psIndex = ((Number(current.psIndex) % PS_ROTATION.length) + PS_ROTATION.length) % PS_ROTATION.length;
    const tvIndex = ((Number(current.tvIndex) % TV_ROTATION.length) + TV_ROTATION.length) % TV_ROTATION.length;
    allocations.push({ ps: PS_ROTATION[psIndex], tv: TV_ROTATION[tvIndex] });

    return {
      psIndex: (psIndex + 1) % PS_ROTATION.length,
      tvIndex: (tvIndex + 1) % TV_ROTATION.length,
      updatedAt: Date.now(),
      updatedBy: currentUser ? currentUser.role : "Admin"
    };
  });

  if (!transaction.committed || !allocations.length) throw new Error("Gagal mengambil giliran otomatis");

  const allocation = allocations[allocations.length - 1];
  const rentalRef = db.ref("rentals").push();
  const kasRef = db.ref("kasTransactions").push();
  const waktu = Date.now();
  const kasNominal = Math.round(data.nominalKotor * KAS_PERCENT);
  const pendapatanBersih = data.nominalKotor - kasNominal;
  const monthKey = getMonthKey(waktu);

  const updates = {};
  updates["rentals/" + rentalRef.key] = {
    nomorPenyewa: data.nomor,
    psUnit: allocation.ps.unit,
    psOwner: allocation.ps.owner,
    tvUnit: allocation.tv,
    durasi: data.durasi,
    durasiUnit: data.durasiUnit,
    nominalKotor: data.nominalKotor,
    kasPersen: 5,
    kasNominal,
    nominal: pendapatanBersih,
    fotoUrl: data.fotoUrl || "",
    createdAt: waktu,
    createdBy: currentUser ? currentUser.role : "Admin",
    monthKey
  };
  updates["kasTransactions/" + kasRef.key] = {
    jenis: "masuk",
    nominal: kasNominal,
    persentase: 5,
    keterangan: "Kas 5% dari sewa PS " + allocation.ps.unit + " — " + allocation.ps.owner,
    sumber: "sewa_otomatis",
    rentalId: rentalRef.key,
    createdAt: waktu,
    createdBy: currentUser ? currentUser.role : "Admin",
    monthKey
  };

  try {
    await db.ref().update(updates);
    return { allocation, kasNominal, pendapatanBersih };
  } catch (error) {
    await rotationRef.transaction((state) => {
      if (!state) return state;
      return {
        ...state,
        psIndex: (Number(state.psIndex || 0) + PS_ROTATION.length - 1) % PS_ROTATION.length,
        tvIndex: (Number(state.tvIndex || 0) + TV_ROTATION.length - 1) % TV_ROTATION.length,
        rollbackAt: Date.now()
      };
    });
    throw error;
  }
}

if (rentalForm) {
  rentalForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!firebaseReady) initFirebase();
    if (!firebaseReady || !db) {
      alert("Firebase belum siap: " + firebaseErrorMsg);
      return;
    }

    const nomor = $("nomorPenyewa") ? $("nomorPenyewa").value.trim() : "";
    const durasi = $("durasi") ? Number($("durasi").value) : 0;
    const durasiUnit = $("durasiUnit") ? $("durasiUnit").value : "jam";
    const nominalKotor = $("nominal") ? Number($("nominal").value) : 0;
    const file = fotoInput && fotoInput.files ? fotoInput.files[0] : null;

    if (!nomor || !durasi || !nominalKotor) {
      alert("Lengkapi nomor penyewa, durasi, dan nominal sewa.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';
    }

    const finish = () => {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Sewa';
      }
    };

    try {
      let fotoUrl = "";
      if (file) {
        fotoUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error("Foto gagal dibaca."));
          reader.readAsDataURL(file);
        });
      }

      const result = await allocateAndSaveRental({ nomor, durasi, durasiUnit, nominalKotor, fotoUrl });
      rentalForm.reset();
      resetFotoInput();
      await refreshRotationPreview();
      alert(
        "Sewa berhasil disimpan!\n\n" +
        "PS: " + result.allocation.ps.unit + " — " + result.allocation.ps.owner + "\n" +
        "TV: " + result.allocation.tv + "\n" +
        "Kas 5%: " + formatRp(result.kasNominal) + "\n" +
        "Pendapatan bersih: " + formatRp(result.pendapatanBersih)
      );
    } catch (error) {
      alert("Gagal menyimpan sewa: " + error.message);
    } finally {
      finish();
    }
  });
}

function openExpenseModalForm() {
  if (expenseForm) expenseForm.reset();
  if (expenseModal) expenseModal.classList.remove("hidden");
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
  expenseForm.addEventListener("submit", async (event) => {
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
    try {
      const expenseRef = db.ref("expenses").push();
      const kasRef = db.ref("kasTransactions").push();
      const waktu = Date.now();
      const monthKey = getMonthKey(waktu);
      await db.ref().update({
        ["expenses/" + expenseRef.key]: { kategori: "Pengeluaran Usaha", nominal: nominalExpense, keterangan, createdAt: waktu, createdBy: currentUser ? currentUser.role : "Admin", monthKey },
        ["kasTransactions/" + kasRef.key]: { jenis: "keluar", nominal: nominalExpense, keterangan: "Pengeluaran: " + keterangan, sumber: "pengeluaran", expenseId: expenseRef.key, createdAt: waktu, createdBy: currentUser ? currentUser.role : "Admin", monthKey }
      });
      closeExpenseModalForm();
      alert("Pengeluaran berhasil disimpan.");
    } catch (error) {
      alert("Gagal menyimpan pengeluaran: " + error.message);
    } finally {
      if (saveExpenseBtn) {
        saveExpenseBtn.disabled = false;
        saveExpenseBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Pengeluaran';
      }
    }
  });
}

function renderExpenseHistory() {
  const history = $("expenseHistory");
  if (!history) return;
  if (!allExpenses.length) {
    history.innerHTML = '<p class="empty">Belum ada pengeluaran</p>';
    return;
  }
  history.innerHTML = allExpenses.slice(0, 10).map((expense) =>
    '<div class="history-item"><div class="rank-badge bronze"><i class="fas fa-arrow-up"></i></div><div class="item-info"><div class="nomor">Pengeluaran Usaha</div><div class="meta">' + escapeHtml(expense.keterangan) + ' · ' + formatDate(expense.createdAt) + '</div></div><div class="item-amount" style="color:#fb7185;">-' + formatRp(expense.nominal) + '</div></div>'
  ).join("");
}

function refreshExpenseSummary() {
  const currentMonth = getMonthKey(Date.now());
  const income = allRentals.filter((rental) => getMonthKey(rental.createdAt) === currentMonth).reduce((total, rental) => total + getPendapatanBersih(rental), 0);
  const expense = allExpenses.filter((item) => getMonthKey(item.createdAt) === currentMonth).reduce((total, item) => total + Number(item.nominal || 0), 0);
  setText("totalExpenses", formatRp(expense));
  setText("netIncome", formatRp(income - expense));
}

function getMonthlySummary(monthKey) {
  const rentals = allRentals.filter((rental) => getMonthKey(rental.createdAt) === monthKey);
  const expenses = allExpenses.filter((expense) => getMonthKey(expense.createdAt) === monthKey);
  const kas = allKasTransactions.filter((item) => getMonthKey(item.createdAt) === monthKey);
  const income = rentals.reduce((total, rental) => total + getPendapatanBersih(rental), 0);
  const kasMasuk = kas.reduce((total, item) => total + (item.jenis === "masuk" ? Number(item.nominal || 0) : 0), 0);
  const expenseTotal = expenses.reduce((total, expense) => total + Number(expense.nominal || 0), 0);
  return { transactionCount: rentals.length, income, kas: kasMasuk, expenses: expenseTotal, final: income - expenseTotal };
}

function getAvailableMonthKeys() {
  const keys = new Set([getMonthKey(Date.now())]);
  allRentals.concat(allExpenses, allKasTransactions).forEach((item) => { if (item.createdAt) keys.add(getMonthKey(item.createdAt)); });
  return Array.from(keys).sort().reverse();
}

function refreshMonthlyRecap() {
  if (!monthlySelect) return;
  const keys = getAvailableMonthKeys();
  const before = monthlySelect.value;
  monthlySelect.innerHTML = keys.map((key) => '<option value="' + key + '">' + escapeHtml(formatMonthKey(key)) + '</option>').join("");
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
  history.innerHTML = keys.map((key) => {
    const summary = getMonthlySummary(key);
    return '<div class="history-item"><div class="rank-badge gold"><i class="fas fa-calendar"></i></div><div class="item-info"><div class="nomor">' + escapeHtml(formatMonthKey(key)) + '</div><div class="meta">' + summary.transactionCount + ' transaksi · Kas ' + formatRp(summary.kas) + ' · Pengeluaran ' + formatRp(summary.expenses) + '</div></div><div class="item-amount">' + formatRp(summary.final) + '</div></div>';
  }).join("");
}

if (monthlySelect) monthlySelect.addEventListener("change", () => renderSelectedMonth(monthlySelect.value));

function openEditModal(id) {
  if (!isMaster() || !editModal) return;
  const rental = allRentals.find((item) => item.id === id);
  if (!rental) return;
  const fields = {
    editId: rental.id,
    editNomor: rental.nomorPenyewa || "",
    editPsUnit: rental.psUnit || "",
    editPsUnitDisplay: rental.psUnit ? "PS " + rental.psUnit : "-",
    editPsOwner: rental.psOwner || "",
    editPsOwnerDisplay: rental.psOwner || "-",
    editTvUnit: rental.tvUnit || "",
    editTvUnitDisplay: rental.tvUnit || "-",
    editDurasi: rental.durasi || 1,
    editDurasiUnit: rental.durasiUnit || "jam",
    editNominal: getRentalGross(rental)
  };
  Object.keys(fields).forEach((key) => { const el = $(key); if (el) el.value = fields[key]; });
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
  editForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isMaster() || !db) return;
    const id = $("editId") ? $("editId").value : "";
    const rental = allRentals.find((item) => item.id === id);
    const nomor = $("editNomor") ? $("editNomor").value.trim() : "";
    const durasi = $("editDurasi") ? Number($("editDurasi").value) : 0;
    const durasiUnit = $("editDurasiUnit") ? $("editDurasiUnit").value : "jam";
    const nominalKotor = $("editNominal") ? Number($("editNominal").value) : 0;
    if (!rental || !nomor || !durasi || !nominalKotor) {
      alert("Lengkapi seluruh data transaksi.");
      return;
    }
    const kasNominal = Math.round(nominalKotor * KAS_PERCENT);
    const pendapatanBersih = nominalKotor - kasNominal;
    if (saveEditBtn) saveEditBtn.disabled = true;
    try {
      const updates = {
        ["rentals/" + id + "/nomorPenyewa"]: nomor,
        ["rentals/" + id + "/durasi"]: durasi,
        ["rentals/" + id + "/durasiUnit"]: durasiUnit,
        ["rentals/" + id + "/nominalKotor"]: nominalKotor,
        ["rentals/" + id + "/kasPersen"]: 5,
        ["rentals/" + id + "/kasNominal"]: kasNominal,
        ["rentals/" + id + "/nominal"]: pendapatanBersih,
        ["rentals/" + id + "/updatedAt"]: Date.now(),
        ["rentals/" + id + "/updatedBy"]: currentUser.role
      };
      const relatedKas = allKasTransactions.find((kas) => kas.rentalId === id);
      if (relatedKas) {
        updates["kasTransactions/" + relatedKas.id + "/nominal"] = kasNominal;
        updates["kasTransactions/" + relatedKas.id + "/keterangan"] = "Kas 5% dari sewa PS " + (rental.psUnit || "-") + " — " + (rental.psOwner || "-");
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
  if (!confirm("Hapus transaksi sewa ini beserta kas otomatis 5% terkait?\n\nGiliran otomatis tidak diubah agar riwayat rotasi tetap konsisten.")) return;
  try {
    const updates = { ["rentals/" + id]: null };
    allKasTransactions.forEach((kas) => { if (kas.rentalId === id) updates["kasTransactions/" + kas.id] = null; });
    await db.ref().update(updates);
    alert("Transaksi sewa dan kas terkait berhasil dihapus.");
  } catch (error) {
    alert("Gagal hapus transaksi: " + error.message);
  }
}

function openResetRotationModal() {
  if (!isMaster()) return;
  if (resetRotationModal) resetRotationModal.classList.remove("hidden");
}

function closeResetRotationModalForm() {
  if (resetRotationModal) resetRotationModal.classList.add("hidden");
}

if (resetRotationBtn) resetRotationBtn.addEventListener("click", openResetRotationModal);
if (closeResetRotationModal) closeResetRotationModal.addEventListener("click", closeResetRotationModalForm);
if (cancelResetRotation) cancelResetRotation.addEventListener("click", closeResetRotationModalForm);
if (resetRotationOverlay) resetRotationOverlay.addEventListener("click", closeResetRotationModalForm);

if (confirmResetRotation) {
  confirmResetRotation.addEventListener("click", async () => {
    if (!isMaster() || !db) return;
    confirmResetRotation.disabled = true;
    try {
      await db.ref("system/rentalRotation").set({
        psIndex: 0,
        tvIndex: 0,
        updatedAt: Date.now(),
        updatedBy: currentUser.role,
        reset: true
      });
      closeResetRotationModalForm();
      await refreshRotationPreview();
      alert("Giliran berhasil direset. Sewa berikutnya: PS A — Adan Glena, TV B.");
    } catch (error) {
      alert("Gagal reset giliran: " + error.message);
    } finally {
      confirmResetRotation.disabled = false;
    }
  });
}

if (loginBtn) loginBtn.addEventListener("click", doLogin);
if (pinInput) pinInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    doLogin();
  }
});

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    currentUser = null;
    sessionStorage.removeItem("ps_user");
    if (dashboardScreen) dashboardScreen.classList.add("hidden");
    if (loginScreen) loginScreen.classList.remove("hidden");
    closeEditModal();
    closeExpenseModalForm();
    closeResetRotationModalForm();
    if (pinInput) pinInput.focus();
  });
}

initFirebase();
checkSession();
if (pinInput) pinInput.focus();
