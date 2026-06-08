import re

with open('/tmp/tgListener_check.js', 'r') as f:
    code = f.read()

# Replace logCallToDb definition
old_snippet = """function logCallToDb(callerHandle, callerId, ca, timestamp, linkedCard, groupId) {
  try {
    db.prepare(`
      INSERT INTO tg_calls (caller_handle, caller_id, token_ca, timestamp_ms, linked_card, group_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(callerHandle, callerId, ca, timestamp, linkedCard, groupId);
  } catch (err) {
    console.error('[TG] failed to log call:', err.message);
  }
}"""

new_snippet = """function logCallToDb(callerHandle, callerId, ca, timestamp, linkedCard, groupId) {
  try {
    const res = db.prepare(`
      INSERT INTO tg_calls (caller_handle, caller_id, token_ca, timestamp_ms, linked_card, group_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(callerHandle, callerId, ca, timestamp, linkedCard, groupId);
    const callId = res.lastInsertRowid;
    
    // Fetch mcap async
    import('../enrichment/gmgn.js').then(({ fetchGmgnTokenInfo }) => {
      return fetchGmgnTokenInfo(ca, true, 'solana');
    }).then(gmgnData => {
      const mcap = gmgnData?.market_cap || null;
      if (mcap) {
        db.prepare('UPDATE tg_calls SET mcap_at_call = ? WHERE id = ?').run(mcap, callId);
      }
    }).catch(e => {
       // Ignore errors, we can try to fall back or it just remains null
    });
    
  } catch (err) {
    console.error('[TG] failed to log call:', err.message);
  }
}"""

code = code.replace(old_snippet, new_snippet)

with open('trencher-core/src/signals/tgListener.js', 'w') as f:
    f.write(code)

