# PS Rental siap pakai

## Login user
- Username `master`, PIN `171717`
- Username `adan`, PIN `888999`

## Setup sekali saja
1. Firebase Authentication: aktifkan Email/Password lalu buat akun `master@psrental.app` dengan password `171717`, serta `adan@psrental.app` dengan password `888999`.
2. Salin UID kedua akun dan tambahkan data database: `{ "meta":{"lastUnitIndex":-1}, "users":{"UID_MASTER":{"name":"Master Admin","role":"master"},"UID_ADAN":{"name":"Kasir (Adan)","role":"cashier"}}}`.
3. Tempel `database.rules.json` ke Realtime Database Rules dan `storage.rules.txt` ke Storage Rules.
4. Di index.html, isi `cfg` menggunakan konfigurasi Firebase Web App Anda.
5. Upload index.html ke GitHub lalu aktifkan Pages dari branch main/root.

Pengguna hanya mengetik username dan PIN; email Firebase dipakai diam-diam di belakang aplikasi.
