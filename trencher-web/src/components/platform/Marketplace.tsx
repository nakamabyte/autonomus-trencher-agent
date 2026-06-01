'use client';

import React, { useState } from 'react';
import { useAgentDna } from '@/hooks/useAgentDna';
import { BREEDS } from '@/constants/breeds';

export function Marketplace() {
  const { agents } = useAgentDna();
  const [activeTab, setActiveTab] = useState<'browse' | 'sell'>('browse');

  // Listing fields state
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [salePrice, setSalePrice] = useState<string>('0.1');
  const [royaltyPct, setRoyaltyPct] = useState<string>('5');
  const [processing, setProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const browseAgents = agents.filter(a => a.for_sale === 1);
  const myAgents = agents; // In Phase II we display all local agents

  const handleList = async (agentId: string, listOn: boolean) => {
    setProcessing(true);
    setError('');
    setSuccess('');
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
      const res = await fetch(`${apiUrl}/api/marketplace/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: agentId,
          forSale: listOn ? 1 : 0,
          salePriceSol: listOn ? parseFloat(salePrice) : null,
          royaltyPct: listOn ? parseFloat(royaltyPct) : 0,
        }),
      });

      if (!res.ok) throw new Error('Listing update failed');
      const data = await res.json();
      setSuccess(listOn ? `Listed ${data.agent.name} successfully!` : `Unlisted ${data.agent.name} successfully!`);
      setSelectedAgentId('');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Error modifying listing.');
    } finally {
      setProcessing(false);
    }
  };

  const handleClone = async (parentDnaId: string) => {
    setProcessing(true);
    setError('');
    setSuccess('');
    try {
      const cloneName = prompt('Enter a name for your cloned agent DNA copy:');
      if (cloneName === null) {
        setProcessing(false);
        return; // cancelled
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
      const res = await fetch(`${apiUrl}/api/marketplace/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentDnaId,
          cloneName: cloneName.trim() || undefined,
          ownerAddress: null,
        }),
      });

      if (!res.ok) throw new Error('Cloning failed');
      const data = await res.json();
      setSuccess(`Successfully cloned ${data.agent.name}! Check the Trenchyard.`);
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to purchase clone copy.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0a0a0f', overflow: 'hidden', fontFamily: "'JetBrains Mono', monospace"
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid #1a1a24',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
          <div style={{
            fontSize: '10px', fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
            color: '#FFB347', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            DNA Marketplace
          </div>
          <div style={{ fontSize: '9px', color: '#444', marginTop: '3px' }}>
            List your trading agents or buy clone licenses of top performers
          </div>
        </div>

        {/* Tab triggers */}
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => { setActiveTab('browse'); setError(''); setSuccess(''); }}
            style={{
              background: activeTab === 'browse' ? '#FFB3471a' : 'transparent',
              border: activeTab === 'browse' ? '1px solid #FFB34750' : '1px solid transparent',
              color: activeTab === 'browse' ? '#FFB347' : '#555',
              padding: '4px 12px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            BROWSE MARKET
          </button>
          <button
            onClick={() => { setActiveTab('sell'); setError(''); setSuccess(''); }}
            style={{
              background: activeTab === 'sell' ? '#FFB3471a' : 'transparent',
              border: activeTab === 'sell' ? '1px solid #FFB34750' : '1px solid transparent',
              color: activeTab === 'sell' ? '#FFB347' : '#555',
              padding: '4px 12px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer'
            }}
          >
            MANAGE LISTINGS
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        
        {error && (
          <div style={{ color: '#FF6B6B', fontSize: '11px', background: 'rgba(255,107,107,0.05)', padding: '10px', borderRadius: '4px', border: '1px solid rgba(255,107,107,0.15)' }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ color: '#00C896', fontSize: '11px', background: 'rgba(0,200,150,0.05)', padding: '10px', borderRadius: '4px', border: '1px solid rgba(0,200,150,0.15)' }}>
            {success}
          </div>
        )}

        {/* Tab 1: Browse */}
        {activeTab === 'browse' && (
          browseAgents.length === 0 ? (
            <div style={{ padding: '48px', border: '1px dashed #222', borderRadius: '6px', textAlign: 'center', color: '#444', fontSize: '11px' }}>
              No DNA records currently listed for sale.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {browseAgents.map(agent => {
                const breed = BREEDS[agent.breed as keyof typeof BREEDS];
                const winRatePct = Math.round(agent.win_rate * 100);
                return (
                  <div key={agent.id} style={{
                    background: '#0d0d12', border: '1px solid #1a1a28', borderRadius: '6px',
                    padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '16px', marginRight: '6px' }}>{breed?.icon}</span>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#fff' }}>{agent.name}</span>
                      </div>
                      <span style={{ fontSize: '8px', color: '#666' }}>Gen {agent.generation}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', fontSize: '10px', color: '#aaa', margin: '6px 0' }}>
                      <div>Win Rate: {winRatePct}%</div>
                      <div>Trades: {agent.total_trades}</div>
                      <div>Price: {agent.sale_price_sol} SOL</div>
                      <div>Royalties: {agent.royalty_pct}%</div>
                    </div>

                    <button
                      onClick={() => handleClone(agent.id)}
                      disabled={processing}
                      style={{
                        background: 'rgba(255,179,71,0.1)', border: '1px solid rgba(255,179,71,0.4)',
                        color: '#FFB347', padding: '8px', borderRadius: '4px', fontSize: '10px',
                        fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                      }}
                    >
                      LICENSE CLONE
                    </button>
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* Tab 2: Manage listings */}
        {activeTab === 'sell' && (
          <div style={{ display: 'flex', gap: '24px' }}>
            
            {/* Form to list an agent */}
            <div style={{
              flex: 1, background: '#0d0d12', border: '1px solid #1a1a28', borderRadius: '6px',
              padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px'
            }}>
              <div style={{ fontSize: '11px', color: '#FFB347', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>
                List Owned Agent DNA on Marketplace
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Select Agent
                </label>
                <select
                  value={selectedAgentId}
                  onChange={e => setSelectedAgentId(e.target.value)}
                  style={{
                    width: '100%', background: '#050508', border: '1px solid #222', color: '#fff',
                    padding: '10px', borderRadius: '4px', outline: 'none'
                  }}
                >
                  <option value="">-- Select Agent to list --</option>
                  {myAgents.filter(a => a.for_sale !== 1).map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.breed})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                    Clone Price (SOL)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={salePrice}
                    onChange={e => setSalePrice(e.target.value)}
                    style={{
                      width: '100%', background: '#050508', border: '1px solid #222', color: '#fff',
                      padding: '10px', borderRadius: '4px', outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                    Royalty Rate (%)
                  </label>
                  <input
                    type="number"
                    value={royaltyPct}
                    onChange={e => setRoyaltyPct(e.target.value)}
                    style={{
                      width: '100%', background: '#050508', border: '1px solid #222', color: '#fff',
                      padding: '10px', borderRadius: '4px', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <button
                onClick={() => handleList(selectedAgentId, true)}
                disabled={processing || !selectedAgentId}
                style={{
                  background: selectedAgentId ? 'rgba(255,179,71,0.1)' : '#111',
                  border: `1px solid ${selectedAgentId ? 'rgba(255,179,71,0.4)' : '#222'}`,
                  color: selectedAgentId ? '#FFB347' : '#555',
                  padding: '12px', borderRadius: '4px', fontSize: '11px',
                  fontWeight: 'bold', cursor: selectedAgentId ? 'pointer' : 'not-allowed', transition: 'all 0.2s'
                }}
              >
                {processing ? 'LISTING...' : 'LIST ON MARKETPLACE'}
              </button>
            </div>

            {/* List of currently listed agents with unlist option */}
            <div style={{
              width: '320px', background: '#0d0d12', border: '1px solid #1a1a28', borderRadius: '6px',
              padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px'
            }}>
              <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Currently Listed
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '260px' }}>
                {myAgents.filter(a => a.for_sale === 1).length === 0 ? (
                  <div style={{ fontSize: '10px', color: '#444', textAlign: 'center', padding: '24px 0' }}>
                    No listed agents
                  </div>
                ) : (
                  myAgents.filter(a => a.for_sale === 1).map(a => (
                    <div key={a.id} style={{
                      background: '#050508', border: '1px solid #222', padding: '10px',
                      borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}>{a.name}</div>
                        <div style={{ fontSize: '9px', color: '#666' }}>{a.sale_price_sol} SOL · {a.royalty_pct}% royal</div>
                      </div>
                      <button
                        onClick={() => handleList(a.id, false)}
                        disabled={processing}
                        style={{
                          background: 'transparent', border: 'none', color: '#FF6B6B',
                          fontSize: '9px', fontWeight: 'bold', cursor: 'pointer'
                        }}
                      >
                        UNLIST
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
