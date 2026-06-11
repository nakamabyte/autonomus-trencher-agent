import { initDb } from './src/db/connection.js';
import { getX402App } from './src/server/x402Server.js';
import { startWsServer } from './src/server/wsServer.js';

console.log('Initializing DB...');
initDb();
console.log('Starting merged server locally on port 5001...');
const app = getX402App();
startWsServer(5001, app);
console.log('Listening on port 5001');
