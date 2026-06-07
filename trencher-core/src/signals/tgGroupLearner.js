/**
 * tgGroupLearner.js
 *
 * Memindai riwayat pesan dari grup Telegram alpha yang dimonitor,
 * mengekstrak token CA yang pernah disebut, dan menjalankan LLM
 * untuk menghasilkan lessons/pengetahuan dari pola historis tersebut.
 *
 * Dipanggil oleh perintah /scout learn melalui commands.js.
 *
 * Default: 3 hari terakhir, max 200 pesan (ringan + cepat).
 * User dapat override via --days flag.
 */

import { parseTokenCall } from './tokenParser.js';
import { db } from '../db/connection.js';

const DEFAULT_DAYS  = 3;
const DEFAULT_LIMIT = 200;

/**
 * Scan riwayat pesan satu grup dan simpan pengetahuan ke DB.
 *
 * @param {import('telegram').TelegramClient} client  — gramjs client aktif
 * @param {string} groupId     — Telegram group/channel ID
 * @param {string} groupName   — Nama grup (opsional, untuk display)
 * @param {object} opts
 * @param {number} opts.days   — Rentang hari yang di-scan (default: 3)
 * @param {number} opts.limit  — Maks pesan yang di-fetch (default: 200)
 *
 * @returns {Promise<{
 *   groupId: string,
 *   groupName: string,
 *   messagesScanned: number,
 *   caFound: number,
 *   uniqueCa: number,
 *   topCas: Array<{ca: string, count: number, sample: string}>,
 *   lessons: string[],
 *   error: string|null
 * }>}
 */
export async function learnGroupHistory(client, groupId, groupName = '', {
  days  = DEFAULT_DAYS,
  limit = DEFAULT_LIMIT,
} = {}) {
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  // ── Step 1: Fetch messages via gramjs ──────────────────────────────
  let rawMessages = [];
  try {
    const peer = await client.getEntity(groupId).catch(() => groupId);
    const result = await client.getMessages(peer, {
      limit,
      filter: undefined, // semua tipe pesan (teks)
    });
    rawMessages = Array.isArray(result) ? result : [];
  } catch (err) {
    console.error(`[TG-Learn] getMessages failed for ${groupId}:`, err.message);
    return {
      groupId, groupName,
      messagesScanned: 0, caFound: 0, uniqueCa: 0,
      topCas: [], lessons: [],
      error: `Gagal fetch pesan: ${err.message}`,
    };
  }

  // ── Step 2: Filter by date + extract CA ───────────────────────────
  const caMap     = new Map(); // ca → { count, samples[] }
  const narratives = [];       // potongan teks non-CA untuk LLM context

  let messagesScanned = 0;

  for (const msg of rawMessages) {
    const text = msg.message || '';
    if (!text) continue;

    // Filter rentang waktu
    const msgMs = (msg.date || 0) * 1000;
    if (msgMs < cutoffMs) continue;

    messagesScanned++;

    const { addresses } = parseTokenCall(text);

    if (addresses.length > 0) {
      for (const ca of addresses) {
        if (!caMap.has(ca)) {
          caMap.set(ca, { count: 0, firstSeen: msgMs, lastSeen: msgMs, samples: [] });
        }
        const entry = caMap.get(ca);
        entry.count++;
        entry.lastSeen = Math.max(entry.lastSeen, msgMs);
        if (entry.samples.length < 3) {
          entry.samples.push(text.slice(0, 120));
        }
      }
    } else {
      // Simpan pesan sebagai narasi konteks (max 50 unique samples)
      if (narratives.length < 50 && text.length > 20) {
        narratives.push(text.slice(0, 200));
      }
    }
  }

  const uniqueCa = caMap.size;
  const caFound  = [...caMap.values()].reduce((s, v) => s + v.count, 0);

  // ── Step 3: Upsert ke tg_group_ca_history ─────────────────────────
  const upsertCa = db.prepare(`
    INSERT INTO tg_group_ca_history (group_id, ca, first_seen_ms, mention_count, last_seen_ms, sample_text)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(group_id, ca) DO UPDATE SET
      mention_count = mention_count + excluded.mention_count,
      last_seen_ms  = MAX(last_seen_ms, excluded.last_seen_ms),
      sample_text   = CASE WHEN excluded.sample_text != '' THEN excluded.sample_text ELSE sample_text END
  `);

  for (const [ca, entry] of caMap) {
    try {
      upsertCa.run(
        groupId, ca,
        entry.firstSeen, entry.count, entry.lastSeen,
        entry.samples[0] || ''
      );
    } catch (e) {
      console.warn(`[TG-Learn] upsert CA failed:`, e.message);
    }
  }

  // ── Step 4: Run LLM analysis ───────────────────────────────────────
  const topCas = [...caMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([ca, v]) => ({
      ca,
      count: v.count,
      sample: v.samples[0] || '',
    }));

  let lessons = [];
  let lessonsJson = null;

  try {
    const { runGroupLearnAnalysis } = await import('../agents/llmScreener.js');
    const result = await runGroupLearnAnalysis({
      groupId,
      groupName,
      days,
      messagesScanned,
      caFound,
      uniqueCa,
      topCas,
      narrativeSamples: narratives.slice(0, 20),
    });

    if (Array.isArray(result?.lessons)) {
      lessons = result.lessons;
      lessonsJson = JSON.stringify(result);

      // Simpan ke learning_lessons dengan tag tg_group_learn
      const insertLesson = db.prepare(`
        INSERT INTO learning_lessons (run_id, created_at_ms, status, lesson, evidence_json)
        VALUES (0, ?, 'active', ?, ?)
      `);
      for (const l of lessons) {
        try {
          insertLesson.run(
            Date.now(),
            String(l.insight || l.lesson || l).slice(0, 500),
            JSON.stringify({ source: 'tg_group_learn', groupId, groupName, days })
          );
        } catch (e) {
          console.warn(`[TG-Learn] insert lesson failed:`, e.message);
        }
      }
    }
  } catch (err) {
    console.error(`[TG-Learn] LLM analysis failed:`, err.message);
    // Non-fatal — simpan tanpa lessons
  }

  // ── Step 5: Simpan summary ke tg_group_history ────────────────────
  try {
    db.prepare(`
      INSERT INTO tg_group_history
        (group_id, group_name, scanned_at_ms, messages_scanned, ca_found, unique_ca, lessons_json, window_days)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(groupId, groupName, Date.now(), messagesScanned, caFound, uniqueCa, lessonsJson, days);
  } catch (e) {
    console.warn(`[TG-Learn] insert history failed:`, e.message);
  }

  return {
    groupId,
    groupName,
    messagesScanned,
    caFound,
    uniqueCa,
    topCas,
    lessons,
    error: null,
  };
}

/**
 * Ambil top CA yang pernah disebut di suatu grup (dari DB).
 * Digunakan untuk /scout history command.
 *
 * @param {string} groupId
 * @param {number} limit
 */
export function getGroupCaHistory(groupId, limit = 15) {
  try {
    return db.prepare(`
      SELECT ca, mention_count, first_seen_ms, last_seen_ms, sample_text
      FROM tg_group_ca_history
      WHERE group_id = ?
      ORDER BY mention_count DESC
      LIMIT ?
    `).all(groupId, limit);
  } catch {
    return [];
  }
}

/**
 * Ambil riwayat scan terakhir dari suatu grup.
 *
 * @param {string} groupId
 */
export function getLastLearnSummary(groupId) {
  try {
    return db.prepare(`
      SELECT * FROM tg_group_history
      WHERE group_id = ?
      ORDER BY scanned_at_ms DESC
      LIMIT 1
    `).get(groupId);
  } catch {
    return null;
  }
}
