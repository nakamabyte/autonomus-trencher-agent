import { Connection } from '@solana/web3.js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function run() {
  const { executeBuybackAndBurn } = await import('../src/payments/autoBurn.js');
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com');
  executeBuybackAndBurn(connection).then(() => console.log('Burn test finished.')).catch(console.error);
}

run();
