// =====================================================
//  PANEL OMSET SEWA PS - Realtime Dashboard
//  Login: Admin PIN 888999 | Master PIN 171717
// =====================================================

// ========== FIREBASE CONFIG ==========
// Ganti dengan config Firebase project Anda sendiri
// Lihat README.md untuk cara setup
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();

// ========== AUTH ==========
const USERS = {
  "888999": { role: "Admin", name: "Admin" },
  "171717": { role: "Master", name: "Master" }
};

let currentUser = null;
let unsubscribe = null;

// Elements
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

// ========== FORMAT RUPIAH ==========
function formatRp(num) {
  return "Rp " + Number(num || 0).toLocaleString("id-ID");
}

function formatDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// ========== LOGIN ==========
function checkSession() {
  const saved = sessionStorage.getItem("ps_user");
  if (saved) {
    currentUser = JSON.parse(saved);
    showDashboard();
  }
}

loginBtn.addEventListener("click", doLogin);
pinInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") doLogin();
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
  startRealtimeListener();
}

logoutBtn.addEventListener("click", () => {
  if (unsubscribe) unsubscribe();
  currentUser = null;
  sessionStorage.removeItem("ps_user");
  dashboardScreen.classList.add("hidden");
  loginScreen.classList.remove("hidden");
  pinInput.focus();
});

// ========== FOTO PREVIEW ==========
fotoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("Ukuran foto maksimal 5MB");
    fotoInput.value = "";
    return;
  }

  fileName.textContent = file.name;
  const reader = new FileReader();
  reader.onload = (ev) => {
    fotoPreview.src = ev.target.result;
    previewContainer.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
});

removeFoto.addEventListener("click", () => {
  fotoInput.value = "";
  fileName.textContent = "Pilih / Ambil Foto";
  previewContainer.classList.add("hidden");
  fotoPreview.src = "";
});

// ========== SUBMIT FORM ==========
rentalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyimpan...';

  try {
    const nomor = document.getElementById("nomorPenyewa").value.trim();
    const psUnit = document.getElementById("psUnit").value;
    const durasi = Number(document.getElementById("durasi").value);
    const durasiUnit = document.getElementById("durasiUnit").value;
    const nominal = Number(document.getElementById("nominal").value);
    const file = fotoInput.files[0];

    if (!nomor || !psUnit || !durasi || !nominal) {
      throw new Error("Lengkapi semua field");
    }

    let fotoUrl = "";
    if (file) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `penyewa/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const ref = storage.ref(path);
      const snap = await ref.put(file);
      fotoUrl = await snap.ref.getDownloadURL();
    }

    await db.collection("rentals").add({
      nomorPenyewa: nomor,
      psUnit: psUnit,
      durasi: durasi,
      durasiUnit: durasiUnit,
      nominal: nominal,
      fotoUrl: fotoUrl,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      createdBy: currentUser.role
    });

    // Reset form
    rentalForm.reset();
    fileName.textContent = "Pilih / Ambil Foto";
    previewContainer.classList.add("hidden");
    fotoPreview.src = "";
    alert("Sewa berhasil disimpan!");
  } catch (err) {
    console.error(err);
    alert("Gagal menyimpan: " + (err.message || err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-save"></i> Simpan Sewa';
  }
});

// ========== REALTIME LISTENER ==========
function startRealtimeListener() {
  if (unsubscribe) unsubscribe();

  unsubscribe = db.collection("rentals")
    .orderBy("createdAt", "desc")
    .onSnapshot(
      (snapshot) => {
        const rentals = [];
        snapshot.forEach((doc) => {
          rentals.push({ id: doc.id, ...doc.data() });
        });
        updateDashboard(rentals);
      },
      (error) => {
        console.error("Listener error:", error);
        // Fallback jika belum ada index / config
        document.getElementById("totalAC").textContent = "Error config";
        document.getElementById("totalB").textContent = "Error config";
        document.getElementById("totalAll").textContent = "Cek Firebase";
      }
    );
}

function updateDashboard(rentals) {
  // === HITUNG TOTAL ===
  let totalAC = 0;
  let totalB = 0;

  rentals.forEach((r) => {
    const n = Number(r.nominal) || 0;
    if (r.psUnit === "A" || r.psUnit === "C") {
      totalAC += n;
    } else if (r.psUnit === "B") {
      totalB += n;
    }
  });

  const totalAll = totalAC + totalB;

  document.getElementById("totalAC").textContent = formatRp(totalAC);
  document.getElementById("totalB").textContent = formatRp(totalB);
  document.getElementById("totalAll").textContent = formatRp(totalAll);

  // === HISTORY TERAKHIR (10) ===
  const latestEl = document.getElementById("latestHistory");
  if (rentals.length === 0) {
    latestEl.innerHTML = '<p class="empty">Belum ada data</p>';
  } else {
    const latest = rentals.slice(0, 10);
    latestEl.innerHTML = latest
      .map(
        (r) => `
      <div class="history-item">
        ${
          r.fotoUrl
            ? `<img src="${r.fotoUrl}" alt="Foto" loading="lazy">`
            : `<div class="no-photo"><i class="fas fa-user"></i></div>`
        }
        <div class="item-info">
          <div class="nomor">${escapeHtml(r.nomorPenyewa)}</div>
          <div class="meta">PS ${r.psUnit} · ${r.durasi} ${r.durasiUnit} · ${formatDate(r.createdAt)}</div>
        </div>
        <div class="item-amount">${formatRp(r.nominal)}</div>
      </div>
    `
      )
      .join("");
  }

  // === PENYEWA PALING BANYAK ===
  const countMap = {};
  rentals.forEach((r) => {
    const key = r.nomorPenyewa;
    if (!countMap[key]) {
      countMap[key] = { nomor: key, count: 0, totalNominal: 0, lastFoto: r.fotoUrl };
    }
    countMap[key].count += 1;
    countMap[key].totalNominal += Number(r.nominal) || 0;
    if (r.fotoUrl) countMap[key].lastFoto = r.fotoUrl;
  });

  const sorted = Object.values(countMap).sort((a, b) => b.count - a.count);
  const topEl = document.getElementById("topPenyewa");

  if (sorted.length === 0) {
    topEl.innerHTML = '<p class="empty">Belum ada data</p>';
  } else {
    topEl.innerHTML = sorted
      .slice(0, 10)
      .map((p, i) => {
        const rankClass = i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : "";
        return `
        <div class="history-item">
          <div class="rank-badge ${rankClass}">${i + 1}</div>
          ${
            p.lastFoto
              ? `<img src="${p.lastFoto}" alt="Foto" loading="lazy">`
              : `<div class="no-photo"><i class="fas fa-user"></i></div>`
          }
          <div class="item-info">
            <div class="nomor">${escapeHtml(p.nomor)}</div>
            <div class="meta">${p.count}x sewa · Total ${formatRp(p.totalNominal)}</div>
          </div>
        </div>
      `;
      })
      .join("");
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ========== START ==========
checkSession();
pinInput.focus();
