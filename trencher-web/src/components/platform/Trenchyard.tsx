'use client';

import { useAgentDna } from '@/hooks/useAgentDna';
import { AgentProfileCard } from './AgentProfileCard';
import { DeployAgentModal } from './DeployAgentModal';
import { BREEDS, BREED_LIST } from '@/constants/breeds';
import { useState } from 'react';
import type { AgentDna } from '@/types';

// ─── Sub-components ───────────────────────────────────────────────

function TrenchyardHeader({ agentCount, breedCount, onDeployClick }: { agentCount: number; breedCount: number; onDeployClick: () => void }) {
  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid #1a1a24',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <div>
        <div style={{
          fontSize: '10px',
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 700,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: '#FFB347',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          The Trenchyard — Agent Registry
        </div>
        <div style={{
          fontSize: '9px',
          fontFamily: "'JetBrains Mono', monospace",
          color: '#444',
          marginTop: '3px',
        }}>
          Create, manage, and monitor your trenching agents
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '4px 10px',
          background: '#0d0d12',
          borderRadius: '4px',
          border: '1px solid #1a1a28',
        }}>
          <span style={{
            fontSize: '13px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            color: '#FFB347',
          }}>
            {agentCount}
          </span>
          <span style={{ fontSize: '8px', color: '#444' }}>Agents</span>
        </div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '4px 10px',
          background: '#0d0d12',
          borderRadius: '4px',
          border: '1px solid #1a1a28',
        }}>
          <span style={{
            fontSize: '13px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            color: '#00C896',
          }}>
            {breedCount}
          </span>
          <span style={{ fontSize: '8px', color: '#444' }}>Breeds</span>
        </div>

        <button
          onClick={onDeployClick}
          style={{
            background: 'rgba(255,179,71,0.1)',
            border: '1px solid rgba(255,179,71,0.4)',
            color: '#FFB347',
            padding: '0 16px',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,179,71,0.2)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,179,71,0.1)';
          }}
        >
          + DEPLOY AGENT
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '48px 24px',
      textAlign: 'center',
    }}>
      <div style={{ marginBottom: '12px', opacity: 0.5, color: '#FFB347' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
      </div>
      <div style={{
        fontSize: '11px',
        fontFamily: "'JetBrains Mono', monospace",
        color: '#555',
        marginBottom: '6px',
      }}>
        No agents deployed yet
      </div>
      <div style={{
        fontSize: '9px',
        fontFamily: "'JetBrains Mono', monospace",
        color: '#333',
      }}>
        Start the Trencher Core to deploy the Genesis agent
      </div>
    </div>
  );
}

function BreedRoster() {
  const availableBreeds = BREED_LIST.filter(b => b.strategyId !== null);
  const futureBreeds = BREED_LIST.filter(b => b.strategyId === null);

  return (
    <div style={{
      padding: '12px 16px',
      borderTop: '1px solid #1a1a24',
    }}>
      <div style={{
        fontSize: '9px',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 700,
        letterSpacing: '.12em',
        textTransform: 'uppercase',
        color: '#444',
        marginBottom: '8px',
      }}>
        Breed Roster — {BREED_LIST.length} Total
      </div>
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
        {availableBreeds.map(b => (
          <span
            key={b.key}
            title={b.description}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '8px',
              fontFamily: "'JetBrains Mono', monospace",
              padding: '2px 6px',
              borderRadius: '2px',
              background: `${b.color}15`,
              border: `1px solid ${b.color}40`,
              color: b.color,
              cursor: 'default',
            }}
          >
            {b.icon}<span>{b.name}</span>
          </span>
        ))}
        {futureBreeds.map(b => (
          <span
            key={b.key}
            title={`Phase ${b.phase} — ${b.description}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '8px',
              fontFamily: "'JetBrains Mono', monospace",
              padding: '2px 6px',
              borderRadius: '2px',
              background: '#0a0a0f',
              border: '1px solid #1a1a28',
              color: '#333',
              cursor: 'default',
            }}
          >
            {b.icon}<span>{b.name}</span>
            <span style={{ fontSize: '7px', color: '#222', marginLeft: '0px' }}>SOON</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────

interface TrenchyardProps {
  onSelectAgent?: (agent: AgentDna) => void;
}

export function Trenchyard({ onSelectAgent }: TrenchyardProps) {
  const { agents } = useAgentDna();
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);

  const uniqueBreeds = new Set(agents.map(a => a.breed));

  const handleDeployAgent = async (payload: any) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
      const res = await fetch(`${apiUrl}/api/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Deployment failed');
      const data = await res.json();
      console.log('Deployed agent:', data.agent);
    } catch (err) {
      console.error(err);
      alert('Failed to deploy agent. Check console.');
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0a0a0f',
      overflow: 'hidden',
    }}>
      <TrenchyardHeader 
        agentCount={agents.length} 
        breedCount={uniqueBreeds.size} 
        onDeployClick={() => setIsDeployModalOpen(true)}
      />

      {/* Agent cards grid */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
      }}>
        {agents.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '10px',
          }}>
            {agents.map(agent => (
              <AgentProfileCard
                key={agent.id}
                agent={agent}
                onClick={onSelectAgent ? () => onSelectAgent(agent) : undefined}
              />
            ))}
          </div>
        )}
      </div>

      {/* Breed roster */}
      <BreedRoster />

      <DeployAgentModal 
        isOpen={isDeployModalOpen}
        onClose={() => setIsDeployModalOpen(false)}
        onDeploy={handleDeployAgent}
      />
    </div>
  );
}
