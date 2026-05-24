import { bot } from '../telegram/bot.js';
import { now, formatWindow, parseWindowMs } from '../utils.js';
import { escapeHtml } from '../format.js';
import { db } from '../db/connection.js';
import { summarizeLearningWindow } from './summary.js';
import { generateLessons, storeLearningRun } from './lessons.js';
import { learningReportText } from './report.js';
import { runAnalysis } from '../agents/llmScreener.js';
import { ENABLE_LLM } from '../config.js';

export async function runLearning(chatId, windowArg = '12h') {
  const windowMs = parseWindowMs(windowArg);
  await bot.sendMessage(chatId, `Learning from the last ${formatWindow(windowMs)}...`);
  const summary = summarizeLearningWindow(windowMs);
  const { lessons, raw } = await generateLessons(summary);
  const runId = storeLearningRun(windowMs, summary, lessons, raw);
  return bot.sendMessage(chatId, learningReportText(runId, summary, lessons), {
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });
}

export async function sendLessons(chatId) {
  const rows = db.prepare(`
    SELECT id, created_at_ms, lesson
    FROM learning_lessons
    WHERE status = 'active'
    ORDER BY id DESC
    LIMIT 10
  `).all();
  
  if (!rows.length) {
    return bot.sendMessage(chatId, 'No active lessons yet. Run /learn 12h after some dry-run exits.', { parse_mode: 'HTML' });
  }

  if (!ENABLE_LLM) {
    const text = rows.map((row, index) => `${index + 1}. ${escapeHtml(row.lesson)}`).join('\n');
    return bot.sendMessage(chatId, `🧠 <b>Active Lessons</b>\n\n${text}`, { parse_mode: 'HTML' });
  }
  
  try {
    await bot.sendMessage(chatId, 'Synthesizing lessons...', { parse_mode: 'HTML' });
    const payload = {
      command: 'lessons',
      lessons: rows.map(r => r.lesson)
    };
    
    const result = await runAnalysis(payload);
    return bot.sendMessage(chatId, result, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('[learn] sendLessons failed:', err.message);
    const text = rows.map((row, index) => `${index + 1}. ${escapeHtml(row.lesson)}`).join('\n');
    return bot.sendMessage(chatId, `🧠 <b>Active Lessons (Fallback)</b>\n\n${text}`, { parse_mode: 'HTML' });
  }
}
