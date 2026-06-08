import re

with open('trencher-core/src/execution/positions.js', 'r') as f:
    code = f.read()

old_snippet = """export async function monitorPositions() {
  const positions = openPositions();"""

new_snippet = """export async function monitorPositions() {
  // Run Outcome Tracker for TG calls in background
  import('../signals/outcomeTracker.js').then(({ monitorCallOutcomes }) => {
    monitorCallOutcomes().catch(e => console.error('[OutcomeTracker] error:', e.message));
  }).catch(() => {});

  const positions = openPositions();"""

code = code.replace(old_snippet, new_snippet)

with open('trencher-core/src/execution/positions.js', 'w') as f:
    f.write(code)

