import re

with open('trencher-core/src/signals/tgListener.js', 'r') as f:
    code = f.read()

# Find:
"""      const result = await processCandidateFromSignals({
        mint: ca,
        route: 'tg_alpha',"""

# Insert before it:
"""      if (sentiment.bullish > 0 || sentiment.bearish > 0) {
        console.log(`[LEARNING] Sentiment at Call Time — Bullish: ${sentiment.bullish}, Bearish: ${sentiment.bearish} (window: 50 msgs)`);
      }"""

old_snippet = """      const result = await processCandidateFromSignals({
        mint: ca,
        route: 'tg_alpha',"""

new_snippet = """      if (sentiment.bullish > 0 || sentiment.bearish > 0) {
        console.log(`[LEARNING] Sentiment at Call Time — Bullish: ${sentiment.bullish}, Bearish: ${sentiment.bearish} (window: 50 msgs)`);
      }
      const result = await processCandidateFromSignals({
        mint: ca,
        route: 'tg_alpha',"""

code = code.replace(old_snippet, new_snippet)

with open('/tmp/tgListener3.js', 'w') as f:
    f.write(code)

