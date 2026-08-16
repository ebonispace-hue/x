// =====================================================
// PANEL OMSET SEWA PS - Realtime Database Version
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

const editFotoInput = document.getElementById("editFoto");
const editFileName = document.getElementById("editFileName");
const editPreviewContainer = document.getElementById("editPreviewContainer");
const editFotoPreview = document.getElementById("editFotoPreview");

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
    currentUser = JSON.parse(saved);
    showDashboard();
  }
}

loginBtn.addEventListener("click", doLogin);

pinInput.addEventListener("keypress", function(e) {
  if (e.key === "Enter") {
    doLogin();
  }
});

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
// FOTO INPUT BARU: GALERI / KAMERA / FILE MANAGER
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
// FOTO EDIT
// =====================================================

function resetEditFotoInput() {
  editFotoInput.value = "";
  editFotoPreview.src = "";
  editFileName.textContent = "Ganti Foto dari Galeri / Kamera";
  editPreviewContainer.classList.add("hidden");
}

editFotoInput.addEventListener("change", function(e) {
  const file = e.target.files && e.target.files[0];

  if (!file) {
    return;
  }

  if (!file.type || !file.type.startsWith("image/")) {
    alert("File yang dipilih harus berupa foto/gambar.");
    resetEditFotoInput();
    return;
  }

  if (file.size > 1.5 * 1024 * 1024) {
    alert("Ukuran foto maksimal 1.5 MB. Silakan pilih foto lain.");
    resetEditFotoInput();
    return;
  }

  editFileName.textContent = file.name;

  const reader = new FileReader();

  reader.onload = function(ev) {
    editFotoPreview.src = ev.target.result;
    editPreviewContainer.classList.remove("hidden");
  };

  reader.onerror = function() {
    alert("Foto gagal dibaca. Silakan pilih ulang.");
    resetEditFotoInput();
  };

  reader.readAsDataURL(file);
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
        console.error(err);

        alert(
          "Gagal simpan: " +
          err.message +
          "\n\nCek Rules Realtime Database sudah Publish?"
        );
      })
      .finally(function() {
        submitBtn.disabled = false;
        submitBtn.innerHTML =
          '<i class="fas fa-save"></i> Simpan Sewa';
      });
  }

  if (file) {
    const reader = new FileReader();

    reader.onload = function(ev) {
      saveData(ev.target.result);
    };

    reader.onerror = function() {
      alert("Foto gagal diproses.");

      submitBtn.disabled = false;
      submitBtn.innerHTML =
        '<i class="fas fa-save"></i> Simpan Sewa';
    };

    reader.readAsDataURL(file);
  } else {
    saveData("");
  }
});

// =====================================================
// REALTIME LISTENER
// =====================================================

function startRealtimeListener() {
  if (!db) {
    return;
  }

  db.ref("rentals")
    .orderByChild("createdAt")
    .on(
      "value",
      function(snapshot) {
        const rentals = [];

        snapshot.forEach(function(child) {
          const data = child.val();
          data.id = child.key;
          rentals.push(data);
        });

        rentals.reverse();

        allRentals = rentals;

        updateDashboard(rentals);
      },
      function(error) {
        console.error("Listener error:", error);

        document.getElementById("totalAll").textContent =
          "Error Rules";

        document.getElementById("latestHistory").innerHTML =
          '<p class="empty">Error: ' +
          error.message +
          "<br>Cek Rules sudah Publish?</p>";
      }
    );
}

function updateDashboard(rentals) {
  let totalAC = 0;
  let totalB = 0;

  rentals.forEach(function(r) {
    const n = Number(r.nominal) || 0;

    if (r.psUnit === "A" || r.psUnit === "C") {
      totalAC += n;
    } else if (r.psUnit === "B") {
      totalB += n;
    }
  });

  document.getElementById("totalAC").textContent = formatRp(totalAC);
  document.getElementById("totalB").textContent = formatRp(totalB);
  document.getElementById("totalAll").textContent =
    formatRp(totalAC + totalB);

  const latestEl = document.getElementById("latestHistory");

  if (rentals.length === 0) {
    latestEl.innerHTML =
      '<p class="empty">Belum ada data</p>';
  } else {
    const latest = rentals.slice(0, 10);
    const master = isMaster();

    latestEl.innerHTML = latest
      .map(function(r) {
        const actions = master
          ? '<div class="item-actions">' +
            '<button class="btn-action btn-edit" data-id="' +
            r.id +
            '"><i class="fas fa-pen"></i></button>' +
            '<button class="btn-action btn-delete" data-id="' +
            r.id +
            '"><i class="fas fa-trash"></i></button>' +
            "</div>"
          : "";

        return (
          '<div class="history-item">' +
          (r.fotoUrl
            ? '<img src="' + r.fotoUrl + '" alt="Foto">'
            : '<div class="no-photo"><i class="fas fa-user"></i></div>') +
          '<div class="item-info">' +
          '<div class="nomor">' +
          escapeHtml(r.nomorPenyewa) +
          "</div>" +
          '<div class="meta">PS ' +
          r.psUnit +
          " · " +
          r.durasi +
          " " +
          r.durasiUnit +
          " · " +
          formatDate(r.createdAt) +
          "</div>" +
          "</div>" +
          '<div class="item-amount">' +
          formatRp(r.nominal) +
          "</div>" +
          actions +
          "</div>"
        );
      })
      .join("");

    if (master) {
      latestEl.querySelectorAll(".btn-edit").forEach(function(btn) {
        btn.addEventListener("click", function() {
          openEditModal(btn.dataset.id);
        });
      });

      latestEl.querySelectorAll(".btn-delete").forEach(function(btn) {
        btn.addEventListener("click", function() {
          deleteRental(btn.dataset.id);
        });
      });
    }
  }

  const countMap = {};

  rentals.forEach(function(r) {
    const key = r.nomorPenyewa;

    if (!countMap[key]) {
      countMap[key] = {
        nomor: key,
        count: 0,
        totalNominal: 0,
        lastFoto: r.fotoUrl
      };
    }

    countMap[key].count += 1;
    countMap[key].totalNominal += Number(r.nominal) || 0;

    if (r.fotoUrl) {
      countMap[key].lastFoto = r.fotoUrl;
    }
  });

  const sorted = Object.values(countMap).sort(function(a, b) {
    return b.count - a.count;
  });

  const topEl = document.getElementById("topPenyewa");

  if (sorted.length === 0) {
    topEl.innerHTML =
      '<p class="empty">Belum ada data</p>';
  } else {
    topEl.innerHTML = sorted
      .slice(0, 10)
      .map(function(p, i) {
        const rankClass =
          i === 0 ? "gold" :
          i === 1 ? "silver" :
          i === 2 ? "bronze" : "";

        return (
          '<div class="history-item">' +
          '<div class="rank-badge ' +
          rankClass +
          '">' +
          (i + 1) +
          "</div>" +
          (p.lastFoto
            ? '<img src="' + p.lastFoto + '" alt="Foto">'
            : '<div class="no-photo"><i class="fas fa-user"></i></div>') +
          '<div class="item-info">' +
          '<div class="nomor">' +
          escapeHtml(p.nomor) +
          "</div>" +
          '<div class="meta">' +
          p.count +
          "x sewa · Total " +
          formatRp(p.totalNominal) +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
  }
}

// =====================================================
// HAPUS TRANSAKSI
// =====================================================

function deleteRental(id) {
  if (!isMaster()) {
    return;
  }

  const rental = allRentals.find(function(r) {
    return r.id === id;
  });

  const label = rental
    ? rental.nomorPenyewa +
      " - PS " +
      rental.psUnit +
      " - " +
      formatRp(rental.nominal)
    : id;

  if (!confirm("Hapus transaksi ini?\n\n" + label)) {
    return;
  }

  db.ref("rentals/" + id)
    .remove()
    .catch(function(err) {
      alert("Gagal hapus: " + err.message);
    });
}

// =====================================================
// EDIT TRANSAKSI
// =====================================================

function openEditModal(id) {
  if (!isMaster()) {
    return;
  }

  const rental = allRentals.find(function(r) {
    return r.id === id;
  });

  if (!rental) {
    return;
  }

  document.getElementById("editId").value = rental.id;
  document.getElementById("editNomor").value =
    rental.nomorPenyewa
