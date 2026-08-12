# Panel Omset Sewa PS

Dashboard realtime untuk mengelola omset sewa PlayStation.

## Fitur

- **Login 2 level**
  - Admin → PIN: `888999` (hanya input + lihat)
  - Master → PIN: `171717` (bisa **Edit** & **Hapus** transaksi)
- **Dashboard Omset**
  - Total Omset PS A + C (digabung)
  - Total Omset PS B (terpisah)
  - Total Omset Keseluruhan
- **Form Input Sewa**
  - Nomor Penyewa
  - Pilih Unit PS (A / B / C)
  - Durasi (Jam / Hari)
  - Nominal (Rp)
  - Upload / Ambil Foto Penyewa
- **History**
  - 10 history terakhir (realtime)
  - Ranking nomor penyewa yang paling sering sewa
  - Tombol Edit & Hapus (hanya muncul untuk akun Master)
- **Realtime** → data langsung update di semua device & jaringan

---

## Cara Setup (Firebase)

### 1. Buat Project Firebase

1. Buka [https://console.firebase.google.com](https://console.firebase.google.com)
2. Klik **Add project** → beri nama (contoh: `ps-rental-omset`)
3. Matikan Google Analytics (opsional) → Create project

### 2. Aktifkan Firestore

1. Di menu kiri → **Build** → **Firestore Database**
2. Klik **Create database**
3. Pilih **Start in test mode** (untuk development)
4. Pilih lokasi terdekat (asia-southeast2 / Singapore)
5. Enable

### 3. Aktifkan Storage

1. Menu kiri → **Build** → **Storage**
2. Klik **Get started**
3. Pilih **Start in test mode**
4. Lanjutkan

### 4. Ambil Config

1. Project Overview → klik ikon **</>** (Web)
2. Register app → beri nama (contoh: `ps-dashboard`)
3. Copy object `firebaseConfig`

### 5. Masukkan Config ke Kode

Buka file `app.js`, ganti bagian ini:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

dengan config yang Anda copy dari Firebase.

### 6. Aturan Keamanan (Production)

Setelah testing, ubah rules Firestore & Storage agar lebih aman.

**Firestore Rules** (contoh sederhana):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rentals/{doc} {
      allow read, write: if true;   // ganti dengan auth jika perlu
    }
  }
}
```

**Storage Rules**:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /penyewa/{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```

> Untuk production sebaiknya pakai Firebase Authentication.

---

## Cara Deploy ke GitHub Pages

1. Buat repository baru di GitHub
2. Upload semua file di folder ini (`index.html`, `style.css`, `app.js`, `README.md`)
3. Settings → Pages → Source: Deploy from branch `main` / `root`
4. Tunggu beberapa menit → akses URL `https://username.github.io/repo-name`

Atau deploy ke **Netlify** / **Vercel** (drag & drop folder).

---

## Struktur File

```
ps-rental-dashboard/
├── index.html      # Halaman utama (login + dashboard)
├── style.css       # Styling
├── app.js          # Logic + Firebase
└── README.md       # Dokumentasi
```

---

## Catatan

- Foto disimpan di Firebase Storage (folder `penyewa/`)
- Data sewa disimpan di collection Firestore `rentals`
- Session login disimpan di `sessionStorage` (hilang saat tab ditutup)
- Ukuran foto maksimal 5 MB
- Semua update bersifat **realtime** (onSnapshot)

---

Dibuat untuk keperluan panel omset sewa PS.
