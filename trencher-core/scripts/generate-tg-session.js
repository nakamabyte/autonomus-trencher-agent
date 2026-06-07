import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import input from 'input';
import dotenv from 'dotenv';

dotenv.config();

const apiId = parseInt(process.env.TG_API_ID || '0');
const apiHash = process.env.TG_API_HASH || '';

if (!apiId || !apiHash) {
  console.error("❌ Error: Please ensure you have set TG_API_ID and TG_API_HASH in your .env file");
  process.exit(1);
}

const stringSession = new StringSession('');

(async () => {
  console.log("Starting session generation process...");
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => await input.text('Enter phone number (example: +62812...): '),
    password: async () => await input.text('Enter 2FA password (press enter if none): '),
    phoneCode: async () => await input.text('Enter verification code from Telegram: '),
    onError: (err) => console.log(err),
  });

  console.log("✅ Successfully connected!");
  console.log("\n=============================================");
  console.log("COPY THE TEXT BELOW AS YOUR TG_SESSION_STRING:");
  console.log("=============================================\n");
  console.log(client.session.save());
  console.log("\n=============================================");
  
  await client.disconnect();
})();
