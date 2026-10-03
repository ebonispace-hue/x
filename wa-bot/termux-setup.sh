#!/data/data/com.termux/files/usr/bin/bash
# Pasang & jalankan Bot WA Eboni Space di HP Android (Termux)
# Pakai:  bash termux-setup.sh 628xxxxxxxxxx
set -e

BOT_NUMBER="$1"
if [ -z "$BOT_NUMBER" ]; then
  echo "Cara pakai: bash termux-setup.sh 628xxxxxxxxxx   (nomor WA khusus bot)"
  exit 1
fi

pkg update -y
pkg install -y nodejs-lts git

cd "$(dirname "$0")"
npm install --no-audit --no-fund

cat > start.sh <<EOS
#!/data/data/com.termux/files/usr/bin/bash
cd "$(pwd)"
termux-wake-lock 2>/dev/null || true
while true; do
  BOT_NUMBER=$BOT_NUMBER PORT=3000 ADMIN_KEY=lokal node server.js
  echo "Bot berhenti, mulai ulang 10 detik lagi..."
  sleep 10
done
EOS
chmod +x start.sh

echo ""
echo "Selesai. Jalankan bot dengan:  ./start.sh"
echo "Kode pairing akan muncul di layar (hanya saat pertama kali)."
