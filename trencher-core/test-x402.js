import { initDb } from './src/db/connection.js';
import { getX402App } from './src/server/x402Server.js';

console.log('Initializing DB...');
initDb();
console.log('Starting x402 Server locally on port 4002...');
const app = getX402App();
app.listen(4002, () => console.log('Listening on port 4002'));
