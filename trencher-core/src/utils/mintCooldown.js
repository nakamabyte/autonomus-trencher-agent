import Database from 'better-sqlite3'
import path from 'path'

const COOLDOWN_MS = 2 * 60 * 60 * 1000 // 2 hours

let db

function getDb() {
  if (!db) {
    db = new Database(path.resolve(process.env.DB_PATH || './trencher-agent.sqlite'))
    db.exec(`
      CREATE TABLE IF NOT EXISTS mint_cooldowns (
        mint TEXT PRIMARY KEY,
        symbol TEXT,
        last_entry_ms INTEGER NOT NULL,
        strategy TEXT
      )
    `)
  }
  return db
}

export function isOnCooldown(mint) {
  const row = getDb()
    .prepare('SELECT last_entry_ms FROM mint_cooldowns WHERE mint = ?')
    .get(mint)
  if (!row) return false
  return (Date.now() - row.last_entry_ms) < COOLDOWN_MS
}

export function setCooldown(mint, symbol = '', strategy = '') {
  getDb()
    .prepare(`
      INSERT INTO mint_cooldowns (mint, symbol, last_entry_ms, strategy)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(mint) DO UPDATE SET last_entry_ms = excluded.last_entry_ms
    `)
    .run(mint, symbol, Date.now(), strategy)
  console.log(`[COOLDOWN] Set 2h cooldown for ${symbol} (${mint})`)
}

export function getCooldownRemaining(mint) {
  const row = getDb()
    .prepare('SELECT last_entry_ms FROM mint_cooldowns WHERE mint = ?')
    .get(mint)
  if (!row) return 0
  const remaining = COOLDOWN_MS - (Date.now() - row.last_entry_ms)
  return Math.max(0, Math.floor(remaining / 60000)) // return in minutes
}
