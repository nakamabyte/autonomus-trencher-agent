'use client';

import { useParams, useRouter } from 'next/navigation';
import { useAgentDna } from '@/hooks/useAgentDna';
import { AgentProfileCard } from '@/components/platform/AgentProfileCard';
import { ConsciousnessStream } from '@/components/platform/ConsciousnessStream';
import { BREEDS } from '@/constants/breeds';

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const { agents, connected, isLoaded } = useAgentDna();

  const agent = agents.find(a => a.id === id || a.id.startsWith(id));

  // Filter stream by the specific agent's ID so we only see its actual thoughts
  let strategyFilter: string | undefined = undefined;
  if (agent) {
    strategyFilter = agent.id;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#050508' }}>
      {/* Reusing Nav or Custom Header */}
      <div style={{
        padding: '16px 24px',
        borderBottom: '1px solid #1a1a24',
        display: 'flex',
        alignItems: 'center',
        gap: '24px'
      }}>
        <button 
          className="pv-back"
          style={{ marginRight: 0 }}
          onClick={() => router.push('/?platform=true')}
        >
          ← BACK
        </button>
        <div 
          onClick={() => router.push('/')} 
          style={{ 
            color: '#00C896', 
            fontFamily: "'Barlow Condensed', sans-serif", 
            fontSize: '18px', 
            fontWeight: 700, 
            letterSpacing: '0.1em',
            cursor: 'pointer'
          }}
        >
          TRENCHER AGENT
        </div>
        <div style={{ 
          fontSize: '12px', 
          fontFamily: "'JetBrains Mono', monospace", 
          color: '#888',
          marginLeft: 'auto'
        }}>
          PUBLIC PROFILE
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Column: DNA Profile */}
        <div style={{ 
          width: '380px', 
          borderRight: '1px solid #1a1a24', 
          padding: '24px', 
          overflowY: 'auto' 
        }}>
          {!isLoaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', textAlign: 'center' }}>
              <div 
                className="animate-spin"
                style={{
                  width: '30px', height: '30px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#00C896', borderRadius: '50%', marginBottom: '12px'
                }} 
              />
              <div style={{ color: '#888', fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', letterSpacing: '0.1em' }}>
                LOADING PROFILE...
              </div>
            </div>
          ) : !connected && agents.length === 0 ? (
            <div style={{ color: '#555', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
              Connecting to agent network...
            </div>
          ) : !agent ? (
            <div style={{ color: '#FF6B6B', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
              Agent DNA not found for ID: {id}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ fontSize: '11px', color: '#555', fontFamily: "'JetBrains Mono', monospace" }}>
                DNA Hash: {agent.id}
              </div>
              
              <AgentProfileCard agent={agent} compact={false} />
              
              <div style={{ background: '#0a0a0f', padding: '16px', borderRadius: '6px', border: '1px solid #1a1a24' }}>
                <div style={{ color: '#00C896', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '12px', fontWeight: 'bold' }}>
                  Lineage
                </div>
                <div style={{ fontSize: '12px', fontFamily: "'JetBrains Mono', monospace", color: '#ccc', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Generation</span>
                    <span>{agent.generation === 0 ? 'Genesis' : `Gen ${agent.generation}`}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Parent A</span>
                    <span>{agent.parent_a ? agent.parent_a.slice(0, 8) : 'None'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#666' }}>Parent B</span>
                    <span>{agent.parent_b ? agent.parent_b.slice(0, 8) : 'None'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Consciousness Stream */}
        <div style={{ flex: 1, position: 'relative' }}>
          <ConsciousnessStream strategyFilter={strategyFilter} />
        </div>
      </div>
    </div>
  );
}
