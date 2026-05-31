import { db } from './connection.js';
import { randomUUID } from 'crypto';

// ─── Breed → Strategy mapping ──────────────────────────────────────
// Maps existing strategy IDs to breed identities from the ecosystem spec
const STRATEGY_TO_BREED = {
  fresh_launch:  'scout',
  sniper:        'sniper',
  smart_money:   'bunker',
  degen:         'degen',
  copytrade:     'whale_tracker',
  base_sniper:   'sniper',
};

// Default DNA traits per breed (0-100)
const BREED_DNA_DEFAULTS = {
  scout: {
    speed: 90, aggression: 60, rug_defense: 50,
    wallet_intelligence: 55, momentum_sensitivity: 80,
    social_signal_weight: 70, liquidity_sensitivity: 60,
    exit_discipline: 50, stealth: 40, mutation_rate: 15, survival_score: 55,
  },
  sniper: {
    speed: 85, aggression: 75, rug_defense: 60,
    wallet_intelligence: 65, momentum_sensitivity: 90,
    social_signal_weight: 55, liquidity_sensitivity: 70,
    exit_discipline: 80, stealth: 50, mutation_rate: 10, survival_score: 65,
  },
  bunker: {
    speed: 40, aggression: 30, rug_defense: 95,
    wallet_intelligence: 90, momentum_sensitivity: 35,
    social_signal_weight: 45, liquidity_sensitivity: 85,
    exit_discipline: 90, stealth: 60, mutation_rate: 5, survival_score: 85,
  },
  degen: {
    speed: 95, aggression: 95, rug_defense: 20,
    wallet_intelligence: 40, momentum_sensitivity: 85,
    social_signal_weight: 80, liquidity_sensitivity: 30,
    exit_discipline: 25, stealth: 30, mutation_rate: 25, survival_score: 35,
  },
  whale_tracker: {
    speed: 60, aggression: 50, rug_defense: 70,
    wallet_intelligence: 95, momentum_sensitivity: 60,
    social_signal_weight: 50, liquidity_sensitivity: 75,
    exit_discipline: 70, stealth: 65, mutation_rate: 10, survival_score: 70,
  },
  // Future breeds — seeded with balanced defaults
  mole:        { speed: 45, aggression: 40, rug_defense: 75, wallet_intelligence: 85, momentum_sensitivity: 40, social_signal_weight: 35, liquidity_sensitivity: 70, exit_discipline: 75, stealth: 80, mutation_rate: 8, survival_score: 72 },
  drill:       { speed: 55, aggression: 45, rug_defense: 85, wallet_intelligence: 80, momentum_sensitivity: 50, social_signal_weight: 30, liquidity_sensitivity: 80, exit_discipline: 95, stealth: 55, mutation_rate: 5, survival_score: 80 },
  berserker:   { speed: 95, aggression: 90, rug_defense: 30, wallet_intelligence: 50, momentum_sensitivity: 95, social_signal_weight: 65, liquidity_sensitivity: 40, exit_discipline: 30, stealth: 20, mutation_rate: 20, survival_score: 40 },
  reaper:      { speed: 50, aggression: 60, rug_defense: 65, wallet_intelligence: 70, momentum_sensitivity: 55, social_signal_weight: 40, liquidity_sensitivity: 75, exit_discipline: 98, stealth: 70, mutation_rate: 8, survival_score: 68 },
  commander:   { speed: 65, aggression: 55, rug_defense: 70, wallet_intelligence: 85, momentum_sensitivity: 65, social_signal_weight: 60, liquidity_sensitivity: 70, exit_discipline: 80, stealth: 55, mutation_rate: 10, survival_score: 75 },
  ghost:       { speed: 70, aggression: 50, rug_defense: 60, wallet_intelligence: 75, momentum_sensitivity: 65, social_signal_weight: 30, liquidity_sensitivity: 65, exit_discipline: 75, stealth: 98, mutation_rate: 12, survival_score: 70 },
  canary:      { speed: 80, aggression: 25, rug_defense: 90, wallet_intelligence: 80, momentum_sensitivity: 75, social_signal_weight: 70, liquidity_sensitivity: 85, exit_discipline: 60, stealth: 45, mutation_rate: 5, survival_score: 78 },
};

// ─── Prepare statements ───────────────────────────────────────────
const stmtInsert = db.prepare(`
  INSERT OR IGNORE INTO agent_dna (
    id, name, breed, parent_a, parent_b, generation,
    speed, aggression, rug_defense, wallet_intelligence,
    momentum_sensitivity, social_signal_weight, liquidity_sensitivity,
    exit_discipline, stealth, mutation_rate, survival_score,
    owner_address, created_at_ms, updated_at_ms
  ) VALUES (
    @id, @name, @breed, @parent_a, @parent_b, @generation,
    @speed, @aggression, @rug_defense, @wallet_intelligence,
    @momentum_sensitivity, @social_signal_weight, @liquidity_sensitivity,
    @exit_discipline, @stealth, @mutation_rate, @survival_score,
    @owner_address, @created_at_ms, @updated_at_ms
  )
`);

const stmtGetById = db.prepare('SELECT * FROM agent_dna WHERE id = ?');

const stmtListBreeds = db.prepare(`
  SELECT
    id, name, breed, generation,
    speed, aggression, rug_defense, wallet_intelligence,
    momentum_sensitivity, social_signal_weight, liquidity_sensitivity,
    exit_discipline, stealth, mutation_rate, survival_score,
    total_trades, win_rate, total_pnl_sol, max_drawdown,
    avg_hold_min, rug_survival_rate,
    owner_address, for_sale, sale_price_sol, royalty_pct,
    copies_minted, copies_limit,
    created_at_ms, updated_at_ms
  FROM agent_dna
  ORDER BY created_at_ms ASC
`);

const stmtUpdatePerf = db.prepare(`
  UPDATE agent_dna SET
    total_trades    = @total_trades,
    win_rate        = @win_rate,
    total_pnl_sol   = @total_pnl_sol,
    max_drawdown    = @max_drawdown,
    avg_hold_min    = @avg_hold_min,
    rug_survival_rate = @rug_survival_rate,
    updated_at_ms   = @updated_at_ms
  WHERE id = @id
`);

// ─── Public API ───────────────────────────────────────────────────

/**
 * Create a new agent DNA record.
 * DNA traits are merged from breed defaults + any overrides passed in.
 */
export function createDna({ name, breed, parentA = null, parentB = null, generation = 0, traits = {}, ownerAddress = null } = {}) {
  const defaults = BREED_DNA_DEFAULTS[breed] || BREED_DNA_DEFAULTS.scout;
  const merged = { ...defaults, ...traits };
  const now = Date.now();
  const id = randomUUID();

  stmtInsert.run({
    id, name,
    breed, parent_a: parentA, parent_b: parentB, generation,
    ...merged,
    owner_address: ownerAddress,
    created_at_ms: now, updated_at_ms: now,
  });

  return stmtGetById.get(id);
}

/** Get a single DNA record by ID. */
export function getDna(id) {
  return stmtGetById.get(id) || null;
}

/** List all agent DNA records. */
export function listBreeds() {
  return stmtListBreeds.all();
}

/**
 * Update live performance metrics for an agent.
 * Call this after each trade closes.
 */
export function updatePerformance(id, { total_trades, win_rate, total_pnl_sol, max_drawdown, avg_hold_min, rug_survival_rate }) {
  stmtUpdatePerf.run({
    id,
    total_trades:     total_trades     ?? 0,
    win_rate:         win_rate         ?? 0,
    total_pnl_sol:    total_pnl_sol    ?? 0,
    max_drawdown:     max_drawdown     ?? 0,
    avg_hold_min:     avg_hold_min     ?? 0,
    rug_survival_rate: rug_survival_rate ?? 1,
    updated_at_ms:    Date.now(),
  });
}

/**
 * Map a strategy_id string to its corresponding breed name.
 */
export function getBreedForStrategy(strategyId) {
  return STRATEGY_TO_BREED[strategyId] || 'scout';
}

/**
 * Seed the Genesis agent on first startup if no agents exist yet.
 * This is the Phase I "Genesis Trencher" — foundation for everything.
 */
export function ensureGenesisAgent() {
  const existing = db.prepare('SELECT COUNT(*) as cnt FROM agent_dna').get();
  if (existing.cnt > 0) return;

  createDna({
    name: 'Genesis Trencher #001',
    breed: 'sniper',
    generation: 0,
    ownerAddress: null,
    traits: {
      speed: 80, aggression: 70, rug_defense: 65,
      wallet_intelligence: 70, momentum_sensitivity: 85,
      social_signal_weight: 60, liquidity_sensitivity: 65,
      exit_discipline: 75, stealth: 50, mutation_rate: 10, survival_score: 70,
    },
  });

  console.log('[agent-dna] Genesis Trencher #001 seeded');
}
