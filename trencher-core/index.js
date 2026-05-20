import { startTrencherAgent } from './src/app.js';

startTrencherAgent().catch((error) => {
  console.error(error);
  process.exit(1);
});
