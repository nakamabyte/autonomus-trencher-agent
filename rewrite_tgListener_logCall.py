import re

with open('trencher-core/src/signals/tgListener.js', 'r') as f:
    code = f.read()

# Update logCallToDb function definition
old_snippet = """function logCallToDb(callerHandle, callerId, tokenCa, timestampMs, linkedCard = null, groupId = null) {
  try {
    db.prepare(`
      INSERT INTO tg_calls (caller_handle, caller_id, token_ca, timestamp_ms, linked_card, group_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(callerHandle, callerId, tokenCa, timestampMs, linkedCard, groupId);
  } catch (err) {
    console.error('[TG] failed to log call:', err.message);
  }
}"""

new_snippet = """function logCallToDb(callerHandle, callerId, tokenCa, timestampMs, linkedCard = null, groupId = null, mcapAtCall = null) {
  try {
    db.prepare(`
      INSERT INTO tg_calls (caller_handle, caller_id, token_ca, timestamp_ms, linked_card, group_id, mcap_at_call)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(callerHandle, callerId, tokenCa, timestampMs, linkedCard, groupId, mcapAtCall);
  } catch (err) {
    console.error('[TG] failed to log call:', err.message);
  }
}"""

code = code.replace(old_snippet, new_snippet)

# We need to get mcap when calling logCallToDb.
# We already fetch `jupData` or `gmgnData` in tgListener.js for the fast buy or LLM.
# Wait, let's see how `logCallToDb` is called currently.

with open('/tmp/tgListener_check.js', 'w') as f:
    f.write(code)
