const fs = require('fs');
const file = 'trencher-core/src/pipeline/orchestrator.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(
  'export async function processCandidateFromSignals(signals) {\n  // Skip',
  'export async function processCandidateFromSignals(signals) {\n  try {\n  // Skip'
);
content = content.replace(
  '    });\n  }\n}\n\nexport async function handleApprovedBuy',
  '    });\n  }\n  } catch (err) { console.log(`[orchestrator] processCandidateFromSignals failed: ${err.message}`); throw err; }\n}\n\nexport async function handleApprovedBuy'
);
fs.writeFileSync(file, content);
