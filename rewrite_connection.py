import re

with open('trencher-core/src/db/connection.js', 'r') as f:
    code = f.read()

old_snippet = """    CREATE TABLE IF NOT EXISTS tg_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caller_handle TEXT NOT NULL,
      caller_id TEXT NOT NULL,
      token_ca TEXT NOT NULL,
      timestamp_ms INTEGER NOT NULL,
      linked_card TEXT,
      group_id TEXT
    );"""

new_snippet = """    CREATE TABLE IF NOT EXISTS tg_calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caller_handle TEXT NOT NULL,
      caller_id TEXT NOT NULL,
      token_ca TEXT NOT NULL,
      timestamp_ms INTEGER NOT NULL,
      linked_card TEXT,
      group_id TEXT,
      mcap_at_call REAL,
      resolved_at_ms INTEGER,
      outcome_status TEXT
    );
    
    -- Add columns if they don't exist (for existing databases)
    try {
      db.prepare("ALTER TABLE tg_calls ADD COLUMN mcap_at_call REAL").run();
      db.prepare("ALTER TABLE tg_calls ADD COLUMN resolved_at_ms INTEGER").run();
      db.prepare("ALTER TABLE tg_calls ADD COLUMN outcome_status TEXT").run();
    } catch(e) {
      // Columns already exist
    }"""

code = code.replace(old_snippet, new_snippet)

with open('/tmp/connection_fixed.js', 'w') as f:
    f.write(code)

