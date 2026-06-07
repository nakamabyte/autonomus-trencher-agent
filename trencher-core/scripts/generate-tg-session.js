import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';

dotenv.config();

const apiId = parseInt(process.env.TG_API_ID || '0');
const apiHash = process.env.TG_API_HASH || '';

if (!apiId || !apiHash) {
  console.error("❌ Error: Pastikan Anda telah mengisi TG_API_ID dan TG_API_HASH di file .env");
  process.exit(1);
}

const stringSession = new StringSession('');

(async () => {
  console.log("Memulai proses pembuatan session...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Masukkan nomor telepon (contoh: +62812...): '),
    password: async () => await input.text('Masukkan password 2FA (jika tidak ada tekan enter): '),
    phoneCode: async () => await input.text('Masukkan kode verifikasi dari Telegram: '),
    onError: (err) => console.log(err),
  });

  console.log("✅ Anda berhasil terhubung!");
  console.log("\n=============================================");
  console.log("SALIN TEKS DI BAWAH INI SEBAGAI TG_SESSION_STRING ANDA:");
  console.log("=============================================\n");
  console.log(client.session.save());
  console.log("\n=============================================");
  
  await client.disconnect();
})();
