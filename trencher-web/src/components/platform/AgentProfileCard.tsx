'use client';

import type { AgentDna } from '@/types';
import { BREEDS, DNA_TRAIT_LABELS, DNA_TRAIT_COLORS } from '@/constants/breeds';
import { AgentModeToggle } from './AgentModeToggle';

// ─── DNA Trait Keys to display on card ───────────────────────────
const CARD_TRAITS: (keyof AgentDna)[] = [
  'speed', 'aggression', 'rug_defense',
  'wallet_intelligence', 'momentum_sensitivity', 'exit_discipline',
];

// ─── Helpers ──────────────────────────────────────────────────────
function TraitBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ marginBottom: '5px' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        marginBottom: '2px',
        fontSize: '9px', fontFamily: "'JetBrains Mono', monospace",
      }}>
        <span style={{ color: '#666' }}>{label}</span>
        <span style={{ color: '#aaa' }}>{value}</span>
      </div>
      <div style={{
        height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${value}%`,
          background: color,
          borderRadius: '2px',
          transition: 'width .6s ease',
          boxShadow: `0 0 6px ${color}60`,
        }} />
      </div>
    </div>
  );
}

function StatChip({ label, value, color = '#aaa' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '6px 8px',
      background: '#0d0d12',
      borderRadius: '4px',
      border: '1px solid #1a1a28',
      flex: 1,
      minWidth: 0,
    }}>
      <span style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color, fontWeight: 700 }}>
        {value}
      </span>
      <span style={{ fontSize: '8px', color: '#444', marginTop: '2px', textAlign: 'center', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
interface AgentProfileCardProps {
  agent: AgentDna;
  compact?: boolean;
  onClick?: () => void;
  hideViewProfile?: boolean;
}

export function AgentProfileCard({ agent, compact = false, onClick, hideViewProfile = false }: AgentProfileCardProps) {
  const breed = BREEDS[agent.breed as keyof typeof BREEDS];
  if (!breed) return null;

  const pnlPositive = agent.total_pnl_sol >= 0;
  const winRatePct  = Math.round(agent.win_rate * 100);
  const pnlColor    = pnlPositive ? '#00C896' : '#FF6B6B';
  const genLabel    = agent.generation === 0 ? 'Genesis' : `Gen ${agent.generation}`;

  return (
    <div
      id={`agent-card-${agent.id.slice(0, 8)}`}
      onClick={onClick}
      style={{
        background: breed.bgColor,
        border: `1px solid ${breed.borderColor}`,
        borderRadius: '6px',
        padding: compact ? '10px 12px' : '14px 16px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'border-color .2s, box-shadow .2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        if (!onClick) return;
        (e.currentTarget as HTMLElement).style.borderColor = breed.color;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${breed.color}22`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = breed.borderColor;
        (e.currentTarget as HTMLElement).style.boxShadow = 'none';
      }}
    >
      {/* Glow accent */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 60, height: 60,
        background: `radial-gradient(circle, ${breed.color}15 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '10px', flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: compact ? '20px' : '24px',
            lineHeight: 1,
            flexShrink: 0,
          }}>
            {breed.icon}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: compact ? '11px' : '12px',
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {agent.name}
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
              {/* Breed badge */}
              <span style={{
                fontSize: '8px',
                fontFamily: "'Barlow Condensed', sans-serif",
                fontWeight: 700,
                letterSpacing: '.1em',
                textTransform: 'uppercase',
                color: breed.color,
                background: `${breed.color}18`,
                padding: '1px 6px',
                borderRadius: '2px',
                border: `1px solid ${breed.color}40`,
              }}>
                {breed.name}
              </span>
              {/* Generation badge */}
              <span style={{
                fontSize: '8px',
                fontFamily: "'JetBrains Mono', monospace",
                color: '#555',
                padding: '1px 4px',
                border: '1px solid #222',
                borderRadius: '2px',
              }}>
                {genLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Mode Toggle */}
        {!compact && (
          <div style={{ flexShrink: 0 }}>
            <AgentModeToggle agent={agent} />
          </div>
        )}
      </div>

      {/* Performance stats */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        <StatChip
          label="Trades"
          value={String(agent.total_trades)}
        />
        <StatChip
          label="Win Rate"
          value={agent.total_trades > 0 ? `${winRatePct}%` : '—'}
          color={winRatePct >= 50 ? '#00C896' : winRatePct > 0 ? '#FFB347' : '#555'}
        />
        <StatChip
          label="PnL (SOL)"
          value={agent.total_trades > 0 ? `${pnlPositive ? '+' : ''}${agent.total_pnl_sol.toFixed(3)}` : '—'}
          color={agent.total_trades > 0 ? pnlColor : '#555'}
        />
        <StatChip
          label="Survival"
          value={`${Math.round(agent.rug_survival_rate * 100)}%`}
          color="#81C784"
        />
      </div>

      {/* DNA trait bars */}
      {!compact && (
        <div>
          <div style={{
            fontSize: '8px',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700,
            letterSpacing: '.12em',
            textTransform: 'uppercase',
            color: '#444',
            marginBottom: '6px',
          }}>
            DNA Traits
          </div>
          {CARD_TRAITS.map(trait => (
            <TraitBar
              key={trait}
              label={DNA_TRAIT_LABELS[trait] || trait}
              value={agent[trait] as number}
              color={DNA_TRAIT_COLORS[trait] || '#555'}
            />
          ))}
        </div>
      )}

      {/* Public profile link */}
      {!compact && !hideViewProfile && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.location.href = `/agent/${agent.id}`;
          }}
          style={{
            display: 'block',
            width: '100%',
            padding: '6px',
            background: 'rgba(255,255,255,0.03)',
            color: breed.color,
            border: `1px solid ${breed.color}30`,
            borderRadius: '4px',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '9px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '1px',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'background 0.2s, border-color 0.2s',
            marginTop: '8px'
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = `${breed.color}15`;
            (e.currentTarget as HTMLElement).style.borderColor = `${breed.color}60`;
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
            (e.currentTarget as HTMLElement).style.borderColor = `${breed.color}30`;
          }}
        >
          View Profile
        </button>
      )}

      {/* Compact: horizontal mini bars */}
      {compact && (
        <div style={{ display: 'flex', gap: '3px' }}>
          {CARD_TRAITS.map(trait => (
            <div
              key={trait}
              title={`${DNA_TRAIT_LABELS[trait]}: ${agent[trait]}`}
              style={{
                flex: 1,
                height: '3px',
                background: '#111',
                borderRadius: '2px',
                overflow: 'hidden',
              }}
            >
              <div style={{
                height: '100%',
                width: `${agent[trait]}%`,
                background: DNA_TRAIT_COLORS[trait] || '#555',
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
