# Bot WhatsApp Eboni Space

Bot ini mengirim pesan **Program Bonus Jam** ke pelanggan secara otomatis.

```
Panel (GitHub Pages)  ──tulis──▶  Firebase: waOutbox/{id}  ◀──baca── Bot (Hostinger)  ──▶  WhatsApp pelanggan
```

- Panel **tidak** memanggil server secara langsung. Panel cukup menaruh pesan di antrian Firebase (`waOutbox`).
- Bot membaca antrian itu, mengirim pesannya, lalu menandai statusnya `sent` atau `failed`.
- Bot menulis status online ke `waBot/status`. Panel menampilkannya sebagai **Bot WA online/offline**.
- Kalau bot offline, panel otomatis kembali ke tombol **Buka WhatsApp** (cara manual).

> ⚠️ Ini bot **tidak resmi** (memakai WhatsApp Web). Nomornya bisa diblokir WhatsApp.
> **Selalu pakai nomor khusus bot, jangan nomor booking utama.**

## Follow-up promo dari panel (menu **Promo**)

- Tulis pesan sendiri, tambah gambar (opsional), pilih penerima dari semua yang pernah sewa, lalu **Kirim**.
- Follow-up dikirim lebih pelan (jeda acak 30–75 detik) dan maksimal **50 pesan per hari**.
  Sisanya otomatis dilanjut hari berikutnya. Ubah batasnya dengan environment `FOLLOWUP_PER_HARI`.
- Pelanggan yang membalas **STOP** dicatat di `waOptOut` dan tidak dikirimi follow-up lagi. Balas **MULAI** untuk aktif lagi.
- Sisa pesan yang belum terkirim bisa dibatalkan dari **Riwayat Follow-up**.

## Perlindungan anti-spam yang sudah ada

- Hanya mengirim ke nomor yang pernah ada di data sewa.
- Maksimal 4 pesan per nomor per 24 jam.
- Jeda acak 4–9 detik antarpesan, plus status "sedang mengetik".
- Pesan yang lebih tua dari 24 jam tidak dikirim.

## Cara termudah & gratis: HP Android cadangan + Termux (disarankan)

Pakai HP Android bekas yang diam di rumah, colok charger, dan sambungkan ke WiFi. Isi WhatsApp di HP itu dengan **nomor khusus bot**.

1. Install **Termux** dari F-Droid (versi Play Store sudah lama tidak diperbarui).
2. Buka Termux, lalu ketik:
   ```
   pkg install -y git
   git clone https://github.com/ebonispace-hue/x.git
   cd x/wa-bot
   bash termux-setup.sh 628xxxxxxxxxx
   ./start.sh
   ```
   Ganti `628xxxxxxxxxx` dengan nomor bot (diawali 62).
3. Di layar akan muncul **KODE PAIRING** 8 huruf. Buka WhatsApp nomor bot → **Perangkat tertaut** → **Tautkan perangkat** → **Tautkan dengan nomor telepon saja**, lalu masukkan kodenya.
4. Kalau muncul "WhatsApp tersambung", di panel akan tampil **Bot WA online**. Selesai.

Tips supaya bot tidak mati:
- Di pengaturan Android: **Baterai → Termux → Tanpa batasan / Jangan optimalkan**.
- Biarkan notifikasi Termux tetap ada (wake-lock aktif).
- Kalau HP restart, buka Termux lagi lalu jalankan `cd x/wa-bot && ./start.sh`.
- Update kode bot: `cd x && git pull`, lalu jalankan ulang `./start.sh`.

## Pasang di Hostinger (Business / Cloud hosting) — kalau paketnya mendukung

Fitur **Node.js web app** hanya ada di paket **Business Web Hosting** dan **Cloud**. Paket Single dan Premium tidak bisa.

1. Masuk hPanel → **Websites** → **Add website** → **Node.js Apps**.
2. Pilih sumber kodenya:
   - **Import Git repository**: hubungkan GitHub, pilih repo `ebonispace-hue/x`, lalu isi folder aplikasi `wa-bot`, **atau**
   - **Upload** isi folder `wa-bot` dalam bentuk zip.
3. Pengaturan aplikasi:
   - Node.js version: **20** atau lebih baru
   - Entry file: `server.js`
   - Start command: `npm start`
4. Tambahkan **Environment variable** berikut:
   - `ADMIN_KEY` = kata sandi buatan Anda sendiri (contoh: `eboni-rahasia-2026`)
5. Deploy. Setelah selesai, Anda dapat alamat aplikasi, misalnya `https://bot.domainanda.com`.

### Scan QR (sekali saja)

1. Buka `https://ALAMAT-BOT/qr?key=ADMIN_KEY-ANDA` di browser.
2. Di HP yang memakai **nomor bot**, buka WhatsApp → **Perangkat tertaut** → **Tautkan perangkat**, lalu scan QR-nya.
3. Kalau berhasil, halaman menampilkan "✅ Bot sudah tersambung", dan di panel muncul **Bot WA online**.

Sesi login tersimpan di folder `auth/` di server. Jangan dihapus, supaya tidak perlu scan ulang.

### Supaya bot tidak "tidur"

Hosting bersama bisa mematikan aplikasi yang lama tidak dibuka. Buat **Cron Job** di hPanel → **Advanced** → **Cron Jobs**, jadwal setiap 5 menit:

```
curl -s https://ALAMAT-BOT/health > /dev/null
```

Cek juga `https://ALAMAT-BOT/health`. Kalau tertulis `"whatsapp":"online"`, bot siap dipakai.

## Kalau tidak jalan

| Gejala | Penyebab / solusi |
|---|---|
| Panel selalu "Bot WA offline" | Buka `/health`. Kalau tidak bisa dibuka, aplikasinya mati: cek log di hPanel lalu restart. |
| `/qr` terus "Menunggu QR" | Lihat log aplikasi. Mungkin koneksi ke WhatsApp diblokir hosting. Solusinya pindah ke VPS. |
| Bot sering putus atau mati sendiri | Hosting bersama memang membatasi proses yang jalan terus. Pindah ke **VPS** (paling stabil). |
| Status pesan `failed` | Lihat kolom `error` di Firebase `waOutbox/{id}` (nomor bukan pelanggan, batas harian, nomor tidak terdaftar di WA). |

## Disarankan: rules Firebase

Tambahkan index supaya antrian lebih ringan (Firebase Console → Realtime Database → Rules):

```json
"waOutbox": { ".indexOn": ["createdAt"] }
```
