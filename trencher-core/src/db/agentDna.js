import { db } from './connection.js';
import { randomUUID, createHash } from 'crypto';
import { Keypair } from '@solana/web3.js';
import { encrypt } from '../security/encryption.js';

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

export function computeDnaHash(breed, traits, generation) {
  const data = JSON.stringify({
    breed,
    traits: Object.keys(traits).sort().reduce((acc, k) => {
      acc[k] = traits[k];
      return acc;
    }, {}),
    generation
  });
  return createHash('sha256').update(data).digest('hex');
}

// ─── Prepare statements ───────────────────────────────────────────
const stmtInsert = db.prepare(`
  INSERT OR IGNORE INTO agent_dna (
    id, name, breed, parent_a, parent_b, generation,
    speed, aggression, rug_defense, wallet_intelligence,
    momentum_sensitivity, social_signal_weight, liquidity_sensitivity,
    exit_discipline, stealth, mutation_rate, survival_score,
    entry_preference, exit_preference, rug_filter, dna_hash, mutation_history,
    owner_address, execution_mode, created_at_ms, updated_at_ms
  ) VALUES (
    @id, @name, @breed, @parent_a, @parent_b, @generation,
    @speed, @aggression, @rug_defense, @wallet_intelligence,
    @momentum_sensitivity, @social_signal_weight, @liquidity_sensitivity,
    @exit_discipline, @stealth, @mutation_rate, @survival_score,
    @entry_preference, @exit_preference, @rug_filter, @dna_hash, @mutation_history,
    @owner_address, @execution_mode, @created_at_ms, @updated_at_ms
  )
`);

const stmtGetById = db.prepare('SELECT * FROM agent_dna WHERE id = ?');

const stmtListBreeds = db.prepare(`
  SELECT
    id, name, breed, generation,
    speed, aggression, rug_defense, wallet_intelligence,
    momentum_sensitivity, social_signal_weight, liquidity_sensitivity,
    exit_discipline, stealth, mutation_rate, survival_score,
    entry_preference, exit_preference, rug_filter, dna_hash, mutation_history,
    total_trades, win_rate, total_pnl_sol, max_drawdown,
    avg_hold_min, rug_survival_rate,
    owner_address, for_sale, sale_price_sol, royalty_pct,
    copies_minted, copies_limit,
    execution_mode,
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
export function createDna({
  name, breed, parentA = null, parentB = null, generation = 0, traits = {},
  ownerAddress = null, entryPreference = 'wait_for_dip', exitPreference = 'trailing_tp', rugFilter = 0.20,
  executionMode = 'dry_run'
} = {}) {
  const defaults = BREED_DNA_DEFAULTS[breed] || BREED_DNA_DEFAULTS.scout;
  const merged = { ...defaults, ...traits };
  const now = Date.now();
  const id = randomUUID();
  const dnaHash = computeDnaHash(breed, merged, generation);

  stmtInsert.run({
    id, name,
    breed, parent_a: parentA, parent_b: parentB, generation,
    ...merged,
    entry_preference: entryPreference,
    exit_preference: exitPreference,
    rug_filter: rugFilter,
    dna_hash: dnaHash,
    mutation_history: JSON.stringify([]),
    owner_address: ownerAddress,
    execution_mode: executionMode,
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
 * Breed two parent agents to produce a child hybrid agent.
 * Sifts parent traits with deviation based on mutation rate.
 */
export function breedAgents(parentAId, parentBId, childName) {
  const parentA = getDna(parentAId);
  const parentB = getDna(parentBId);
  if (!parentA || !parentB) {
    throw new Error('One or both parent agents not found');
  }

  const childGeneration = Math.max(parentA.generation, parentB.generation) + 1;
  const childBreed = Math.random() > 0.5 ? parentA.breed : parentB.breed;

  const traits = {};
  const TRAIT_KEYS = [
    'speed', 'aggression', 'rug_defense', 'wallet_intelligence',
    'momentum_sensitivity', 'social_signal_weight', 'liquidity_sensitivity',
    'exit_discipline', 'stealth', 'mutation_rate', 'survival_score'
  ];

  const avgMutationRate = ((parentA.mutation_rate || 10) + (parentB.mutation_rate || 10)) / 2;
  const mutationRange = avgMutationRate / 100; // e.g. 0.15 for 15%

  for (const key of TRAIT_KEYS) {
    const parentAVal = parentA[key] ?? 50;
    const parentBVal = parentB[key] ?? 50;
    const avgVal = (parentAVal + parentBVal) / 2;
    // Apply random mutation deviation
    const deviation = avgVal * mutationRange * (Math.random() - 0.5);
    traits[key] = Math.max(0, Math.min(100, Math.round(avgVal + deviation)));
  }

  // Combine preferences
  const entryPreference = Math.random() > 0.5 ? parentA.entry_preference : parentB.entry_preference;
  const exitPreference = Math.random() > 0.5 ? parentA.exit_preference : parentB.exit_preference;
  const rugFilter = Math.round(((parentA.rug_filter || 0.20) + (parentB.rug_filter || 0.20)) / 2 * 100) / 100;

  return createDna({
    name: childName || `${childBreed.toUpperCase()} Hybrid #${Math.floor(100 + Math.random() * 900)}`,
    breed: childBreed,
    parentA: parentA.id,
    parentB: parentB.id,
    generation: childGeneration,
    traits,
    entryPreference,
    exitPreference,
    rugFilter
  });
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

/**
 * List an agent for sale/licensing on the marketplace.
 */
export function listAgentOnMarket(id, forSale, salePriceSol, royaltyPct) {
  db.prepare(`
    UPDATE agent_dna SET
      for_sale = @for_sale,
      sale_price_sol = @sale_price_sol,
      royalty_pct = @royalty_pct,
      updated_at_ms = @updated_at_ms
    WHERE id = @id
  `).run({
    id,
    for_sale: forSale ? 1 : 0,
    sale_price_sol: salePriceSol ?? null,
    royalty_pct: royaltyPct ?? 0,
    updated_at_ms: Date.now()
  });
  return getDna(id);
}

/**
 * Clone an agent DNA, incrementing copy count on parent.
 */
export function cloneAgent(parentDnaId, cloneName, ownerAddress) {
  const parent = getDna(parentDnaId);
  if (!parent) throw new Error('Parent agent not found');

  if (parent.copies_minted >= parent.copies_limit) {
    throw new Error('Clone copy limit reached for this agent DNA');
  }

  // Increment copies_minted on parent
  db.prepare('UPDATE agent_dna SET copies_minted = copies_minted + 1 WHERE id = ?').run(parentDnaId);

  // Extract traits
  const traits = {
    speed: parent.speed, aggression: parent.aggression, rug_defense: parent.rug_defense,
    wallet_intelligence: parent.wallet_intelligence, momentum_sensitivity: parent.momentum_sensitivity,
    social_signal_weight: parent.social_signal_weight, liquidity_sensitivity: parent.liquidity_sensitivity,
    exit_discipline: parent.exit_discipline, stealth: parent.stealth,
    mutation_rate: parent.mutation_rate, survival_score: parent.survival_score
  };

  return createDna({
    name: cloneName || `${parent.name} (Clone)`,
    breed: parent.breed,
    parentA: parent.id,
    parentB: null,
    generation: parent.generation,
    traits,
    entryPreference: parent.entry_preference,
    exitPreference: parent.exit_preference,
    rugFilter: parent.rug_filter,
    ownerAddress
  });
}

/**
 * Generate a new wallet for a spawned agent and encrypt its private key.
 */
export function createAgentWallet(agentId) {
  const keypair = Keypair.generate();
  const encryptedKey = encrypt(JSON.stringify(Array.from(keypair.secretKey)));

  db.prepare(`
    UPDATE agent_dna SET agent_wallet = ?, encrypted_key = ? WHERE id = ?
  `).run(keypair.publicKey.toBase58(), encryptedKey, agentId);

  return keypair.publicKey.toBase58();
}

/**
 * Update auto-activate preference for an agent.
 */
export function updateAutoActivate(agentId, autoActivateBool) {
  db.prepare(`
    UPDATE agent_dna SET auto_activate = ? WHERE id = ?
  `).run(autoActivateBool ? 1 : 0, agentId);
}
