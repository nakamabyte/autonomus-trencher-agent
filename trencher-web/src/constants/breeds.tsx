import React from 'react';

// ─── 12 Breed Definitions ─────────────────────────────────────────
// Each breed maps to existing or future strategy IDs.
// Visual identity: accent color, icon (SVG), and description.

export type BreedKey =
  | 'scout' | 'sniper' | 'bunker' | 'degen' | 'whale_tracker' | 'social_scout'
  | 'mole' | 'drill' | 'berserker' | 'reaper' | 'commander'
  | 'ghost' | 'canary';

export interface BreedConfig {
  key: BreedKey;
  name: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;       // primary accent
  bgColor: string;     // card background tint
  borderColor: string; // card border
  strategyId: string | null;  // maps to existing strategy, null = NEW
  phase: number;       // roadmap phase when available
  style: 'conservative' | 'balanced' | 'aggressive' | 'degen';
  description: string;
  traits: {
    speed: number;
    aggression: number;
    rug_defense: number;
    wallet_intelligence: number;
    momentum_sensitivity: number;
    social_signal_weight?: number;
    liquidity_sensitivity?: number;
    exit_discipline?: number;
  };
}

export const BREEDS: Record<BreedKey, BreedConfig> = {
  scout: {
    key: 'scout',
    name: 'Scout Trencher',
    subtitle: 'Early Discovery',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
    color: '#4FC3F7',
    bgColor: 'rgba(79,195,247,0.05)',
    borderColor: 'rgba(79,195,247,0.25)',
    strategyId: 'fresh_launch',
    phase: 1,
    style: 'balanced',
    description: 'Hunts tokens before graduation. First in, first out.',
    traits: { speed: 90, aggression: 60, rug_defense: 50, wallet_intelligence: 55, momentum_sensitivity: 80 },
  },
  sniper: {
    key: 'sniper',
    name: 'Sniper Trencher',
    subtitle: 'Precision Momentum',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>,
    color: '#00C896',
    bgColor: 'rgba(0,200,150,0.05)',
    borderColor: 'rgba(0,200,150,0.25)',
    strategyId: 'sniper',
    phase: 1,
    style: 'aggressive',
    description: 'Locks on momentum signals. High confidence entries only.',
    traits: { speed: 85, aggression: 75, rug_defense: 60, wallet_intelligence: 65, momentum_sensitivity: 90 },
  },
  bunker: {
    key: 'bunker',
    name: 'Bunker Trencher',
    subtitle: 'Defensive Smart Money',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>,
    color: '#81C784',
    bgColor: 'rgba(129,199,132,0.05)',
    borderColor: 'rgba(129,199,132,0.25)',
    strategyId: 'smart_money',
    phase: 1,
    style: 'conservative',
    description: 'Maximum rug defense. Follows wallets with proven track records.',
    traits: { speed: 40, aggression: 30, rug_defense: 95, wallet_intelligence: 90, momentum_sensitivity: 35 },
  },
  degen: {
    key: 'degen',
    name: 'Degen Trencher',
    subtitle: 'Max Risk Early Entry',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
    color: '#FF6B6B',
    bgColor: 'rgba(255,107,107,0.05)',
    borderColor: 'rgba(255,107,107,0.25)',
    strategyId: 'degen',
    phase: 1,
    style: 'degen',
    description: 'No safety net. Pure momentum and chaos. High risk, high reward.',
    traits: { speed: 95, aggression: 95, rug_defense: 20, wallet_intelligence: 40, momentum_sensitivity: 85 },
  },
  whale_tracker: {
    key: 'whale_tracker',
    name: 'Whale Tracker',
    subtitle: 'Smart Wallet Following',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="3"></circle><line x1="12" y1="22" x2="12" y2="8"></line><path d="M5 12H2a10 10 0 0 0 20 0h-3"></path></svg>,
    color: '#7986CB',
    bgColor: 'rgba(121,134,203,0.05)',
    borderColor: 'rgba(121,134,203,0.25)',
    strategyId: 'copytrade',
    phase: 1,
    style: 'balanced',
    description: 'Mirrors elite wallets in real-time. Copy the best.',
    traits: { speed: 60, aggression: 50, rug_defense: 70, wallet_intelligence: 95, momentum_sensitivity: 60, social_signal_weight: 35, liquidity_sensitivity: 70, exit_discipline: 60 },
  },
  social_scout: {
    key: 'social_scout',
    name: 'Social Scout',
    subtitle: 'TG Alpha Group Intel',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>,
    color: '#00BBF9',
    bgColor: 'rgba(0,187,249,0.05)',
    borderColor: 'rgba(0,187,249,0.25)',
    strategyId: 'social_scout',
    phase: 1,
    style: 'aggressive',
    description: 'Monitors curated Telegram alpha groups. Human curation + machine discipline.',
    traits: { speed: 85, aggression: 70, rug_defense: 80, wallet_intelligence: 60, momentum_sensitivity: 75, social_signal_weight: 95, liquidity_sensitivity: 70, exit_discipline: 90 },
  },
  mole: {
    key: 'mole',
    name: 'Mole Trencher',
    subtitle: 'Deep Deployer Research',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>,
    color: '#A1887F',
    bgColor: 'rgba(161,136,127,0.05)',
    borderColor: 'rgba(161,136,127,0.25)',
    strategyId: null,
    phase: 3,
    style: 'conservative',
    description: 'Digs deep into deployer history before entry. Zero surprises.',
    traits: { speed: 45, aggression: 40, rug_defense: 75, wallet_intelligence: 85, momentum_sensitivity: 40 },
  },
  drill: {
    key: 'drill',
    name: 'Drill Sergeant',
    subtitle: 'Strict & Systematic',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
    color: '#90A4AE',
    bgColor: 'rgba(144,164,174,0.05)',
    borderColor: 'rgba(144,164,174,0.25)',
    strategyId: null,
    phase: 3,
    style: 'conservative',
    description: 'Rules-based only. No vibes. No exceptions.',
    traits: { speed: 55, aggression: 45, rug_defense: 85, wallet_intelligence: 80, momentum_sensitivity: 50 },
  },
  berserker: {
    key: 'berserker',
    name: 'Berserker Trencher',
    subtitle: 'Momentum Continuation',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5"></path><path d="M13 19l6-6"></path><path d="M16 16l4 4"></path><path d="M19 21l2-2"></path><path d="M14.5 6.5L18 3h3v3l-3.5 3.5"></path></svg>,
    color: '#EF5350',
    bgColor: 'rgba(239,83,80,0.05)',
    borderColor: 'rgba(239,83,80,0.25)',
    strategyId: null,
    phase: 3,
    style: 'degen',
    description: 'Rides momentum waves until they crash. No mercy.',
    traits: { speed: 95, aggression: 90, rug_defense: 30, wallet_intelligence: 50, momentum_sensitivity: 95 },
  },
  reaper: {
    key: 'reaper',
    name: 'Reaper Trencher',
    subtitle: 'Exit Optimization',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12h.01M15 12h.01"></path><path d="M12 2a8 8 0 0 0-8 8c0 1.8.8 3.5 2 4.6V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3.4c1.2-1.1 2-2.8 2-4.6 0-4.4-3.6-8-8-8z"></path></svg>,
    color: '#CE93D8',
    bgColor: 'rgba(206,147,216,0.05)',
    borderColor: 'rgba(206,147,216,0.25)',
    strategyId: null,
    phase: 3,
    style: 'balanced',
    description: 'Obsessed with exits. Maximizes gains, minimizes regret.',
    traits: { speed: 50, aggression: 60, rug_defense: 65, wallet_intelligence: 70, momentum_sensitivity: 55 },
  },
  commander: {
    key: 'commander',
    name: 'Commander Trencher',
    subtitle: 'Multi-Agent Orchestration',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>,
    color: '#FFB347',
    bgColor: 'rgba(255,179,71,0.05)',
    borderColor: 'rgba(255,179,71,0.25)',
    strategyId: null,
    phase: 3,
    style: 'balanced',
    description: 'Coordinates multiple sub-agents. Battlefield oversight.',
    traits: { speed: 65, aggression: 55, rug_defense: 70, wallet_intelligence: 85, momentum_sensitivity: 65 },
  },
  ghost: {
    key: 'ghost',
    name: 'Ghost Trencher',
    subtitle: 'Stealth Anti-Copy',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 10h.01"></path><path d="M15 10h.01"></path><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"></path></svg>,
    color: '#80CBC4',
    bgColor: 'rgba(128,203,196,0.05)',
    borderColor: 'rgba(128,203,196,0.25)',
    strategyId: null,
    phase: 3,
    style: 'balanced',
    description: 'Executes invisibly. Front-runners cannot see it coming.',
    traits: { speed: 70, aggression: 50, rug_defense: 60, wallet_intelligence: 75, momentum_sensitivity: 65 },
  },
  canary: {
    key: 'canary',
    name: 'Canary Trencher',
    subtitle: 'Risk Warning System',
    icon: <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>,
    color: '#FFF176',
    bgColor: 'rgba(255,241,118,0.05)',
    borderColor: 'rgba(255,241,118,0.25)',
    strategyId: null,
    phase: 3,
    style: 'conservative',
    description: 'Detects danger before it materializes. The flock\'s alarm system.',
    traits: { speed: 80, aggression: 25, rug_defense: 90, wallet_intelligence: 80, momentum_sensitivity: 75 },
  },
};

export const BREED_LIST = Object.values(BREEDS);

// DNA trait labels for display
export const DNA_TRAIT_LABELS: Record<string, string> = {
  speed:                'Speed',
  aggression:           'Aggression',
  rug_defense:          'Rug Defense',
  wallet_intelligence:  'Wallet Intel',
  momentum_sensitivity: 'Momentum',
  social_signal_weight: 'Social Signal',
  liquidity_sensitivity:'Liquidity',
  exit_discipline:      'Exit Discipline',
  stealth:              'Stealth',
  mutation_rate:        'Mutation',
  survival_score:       'Survival',
};

export const DNA_TRAIT_COLORS: Record<string, string> = {
  speed:                '#4FC3F7',
  aggression:           '#FF6B6B',
  rug_defense:          '#81C784',
  wallet_intelligence:  '#CE93D8',
  momentum_sensitivity: '#FFB347',
  social_signal_weight: '#00BBF9',
  liquidity_sensitivity:'#80CBC4',
  exit_discipline:      '#A1887F',
  stealth:              '#90A4AE',
  mutation_rate:        '#FFF176',
  survival_score:       '#00C896',
};
