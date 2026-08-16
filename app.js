// =====================================================
//  PANEL OMSET SEWA PS - Realtime Database Version
//  Login: Admin 888999 | Master 171717
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

let db = null;
let firebaseReady = false;
let firebaseErrorMsg = "";

function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      firebaseErrorMsg = "Library Firebase belum termuat. Cek koneksi internet.";
      console.error(firebaseErrorMsg);
      return false;
    }

    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    db = firebase.database();
    firebaseReady = true;

    console.log("Firebase Realtime Database SIAP");
    return true;
  } catch (err) {
    firebaseErrorMsg = err.message || String(err);
    console.error("Firebase init error:", err);
    firebaseReady = false;
    return false;
  }
}

initFirebase();

const USERS = {
  "888999": { role: "Admin" },
  "171717": { role: "Master" }
};

let currentUser = null;
let allRentals = [];

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

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const closeModal = document.getElementById("closeModal");
const cancelEdit = document.getElementById("cancelEdit");
const modalOverlay = document.getElementById("modalOverlay");
const saveEditBtn = document.getElementById("saveEditBtn");

function formatRp(num) {
  return "Rp " + Number(num || 0).toLocaleString("id-ID");
}

function formatDate(ts) {
  if (!ts) return "-";

  const d = new Date(ts);

  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function isMaster() {
  return currentUser && currentUser.role === "Master";
}

function checkSession() {
  const saved = sessionStorage.getItem("ps_user");

  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      showDashboard();
    } catch (err) {
      sessionStorage.removeItem("ps_user");
    }
  }
}

// =====================================================
// LOGIN
// =====================================================

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

loginBtn.addEventListener("click", doLogin);

pinInput.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    doLogin();
  }
});

function showDashboard() {
  loginScreen.classList.add("hidden");
  dashboardScreen.classList.remove("hidden");

  userRole.textContent = currentUser.role;

  if (!firebaseReady) {
    initFirebase();
  }

  if (firebaseReady) {
    startRealtimeListener();
  } else {
    document.getElementById("totalAC").textContent = "-";
    document.getElementById("totalB").textContent = "-";
    document.getElementById("totalAll").textContent = "Firebase Error";

    document.getElementById("latestHistory").innerHTML =
      '<p class="empty">Firebase belum siap.<br><small>' +
      (firebaseErrorMsg || "Cek Console F12") +
      "</small></p>";

    document.getElementById("topPenyewa").innerHTML =
      '<p class="empty">-</p>';
  }
}

logoutBtn.addEventListener("click", function() {
  currentUser = null;
  allRentals = [];

  sessionStorage.removeItem("ps_user");

  dashboardScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");

  closeEditModal();
  pinInput.focus();
});

// =====================================================
// FOTO GALERI / KAMERA
// =====================================================

function resetFotoInput() {
  fotoInput.value = "";
  fotoPreview.src = "";
  fileName.textContent = "Pilih Foto dari Galeri / Kamera";
  previewContainer.classList.add("hidden");
}

fotoInput.addEventListener("change", function(e) {
  const file = e.target.files && e.target.files[0];

  if (!file) {
    return;
  }

  if (!file.type || !file.type.startsWith("image/")) {
    alert("File yang dipilih harus berupa foto/gambar.");
    resetFotoInput();
    return;
  }

  if (file.size > 1.5 * 1024 * 1024) {
    alert("Ukuran foto maksimal 1.5 MB. Silakan pilih foto lain.");
    resetFotoInput();
    return;
  }

  fileName.textContent = file.name;

  const reader = new FileReader();

  reader.onload = function(ev) {
    fotoPreview.src = ev.target.result;
    previewContainer.classList.remove("hidden");
  };

  reader.onerror = function() {
    alert("Foto gagal dibaca. Silakan pilih ulang.");
    resetFotoInput();
  };

  reader.readAsDataURL(file);
});

removeFoto.addEventListener("click", function() {
  resetFotoInput();
});

// =====================================================
// SIMPAN SEWA BARU
// =====================================================

rentalForm.addEventListener("submit", function(e) {
  e.preventDefault();

  if (!firebaseReady) {
    initFirebase();
  }

  if (!firebaseReady) {
    alert(
      "Firebase belum siap.\n\n" +
      (firebaseErrorMsg || "Buka Console browser (F12) untuk lihat error.")
    );
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML =
    '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

  const nomor = document.getElementById("nomorPenyewa").value.trim();
  const psUnit = document.getElementById("psUnit").value;
  const durasi = Number(document.getElementById("durasi").value);
  const durasiUnit = document.getElementById("durasiUnit").value;
  const nominal = Number(document.getElementById("nominal").value);
  const file = fotoInput.files[0];

  if (!nomor || !psUnit || !durasi || isNaN(nominal)) {
    alert("Lengkapi semua field.");

    submitBtn.disabled = false;
    submitBtn.innerHTML =
      '<i class="fas fa-save"></i> Simpan Sewa';

    return;
  }

  function saveData(fotoUrl) {
    const newRef = db.ref("rentals").push();

    newRef.set({
      nomorPenyewa: nomor,
      psUnit: psUnit,
      durasi: durasi,
      durasiUnit: durasiUnit,
      nominal: nominal,
      fotoUrl: fotoUrl || "",
      createdAt: Date.now(),
      createdBy: currentUser.role
    })
      .then(function() {
        rentalForm.reset();
        resetFotoInput();
        alert("Sewa berhasil disimpan!");
      })
      .catch(function(err) {
        console.error(e
