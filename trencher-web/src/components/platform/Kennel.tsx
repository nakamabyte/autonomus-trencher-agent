'use client';

import React, { useState } from 'react';
import { useAgentDna } from '@/hooks/useAgentDna';
import { BREEDS } from '@/constants/breeds';
import type { AgentDna } from '@/types';

export function Kennel() {
  const { agents } = useAgentDna();
  const [parentAId, setParentAId] = useState<string>('');
  const [parentBId, setParentBId] = useState<string>('');
  const [childName, setChildName] = useState<string>('');
  const [breeding, setBreeding] = useState<boolean>(false);
  const [result, setResult] = useState<AgentDna | null>(null);
  const [error, setError] = useState<string>('');

  const parentA = agents.find(a => a.id === parentAId);
  const parentB = agents.find(a => a.id === parentBId);

  // Exclude selected parents from the list of candidates for the other slot
  const parentACandidates = agents.filter(a => a.id !== parentBId);
  const parentBCandidates = agents.filter(a => a.id !== parentAId);

  // Compute preview traits
  const previewTraits: Record<string, number> = {};
  const TRAIT_KEYS = [
    'speed', 'aggression', 'rug_defense', 'wallet_intelligence',
    'momentum_sensitivity', 'social_signal_weight', 'liquidity_sensitivity',
    'exit_discipline', 'stealth', 'mutation_rate', 'survival_score'
  ];

  if (parentA && parentB) {
    for (const key of TRAIT_KEYS) {
      const valA = (parentA as unknown as Record<string, number>)[key] ?? 50;
      const valB = (parentB as unknown as Record<string, number>)[key] ?? 50;
      previewTraits[key] = Math.round((valA + valB) / 2);
    }
  }

  const handleBreed = async () => {
    if (!parentAId || !parentBId) return;
    setBreeding(true);
    setError('');
    setResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
      const res = await fetch(`${apiUrl}/api/breed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentAId,
          parentBId,
          childName: childName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error('Breeding failed');
      }

      const data = await res.json();
      setResult(data.agent);
      setParentAId('');
      setParentBId('');
      setChildName('');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to breed agents.');
    } finally {
      setBreeding(false);
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
            color: '#CE93D8', display: 'flex', alignItems: 'center', gap: '6px'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h12" />
              <path d="M10 3v6l-4 8a2 2 0 0 0 1.7 3h8.6a2 2 0 0 0 1.7-3l-4-8V3z" />
            </svg>
            The Kennel — Breeding Laboratory
          </div>
          <div style={{ fontSize: '9px', color: '#444', marginTop: '3px' }}>
            Combine two agents to breed hybrid generations and inherit traits
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Parent Slots Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          
          {/* Parent A Selection */}
          <div style={{
            background: '#0d0d12', border: '1px solid #1a1a28', borderRadius: '6px',
            padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Parent A (First Lineage)
            </div>
            <select
              value={parentAId}
              onChange={e => setParentAId(e.target.value)}
              style={{
                width: '100%', background: '#050508', border: '1px solid #222', color: '#fff',
                padding: '10px', borderRadius: '4px', outline: 'none'
              }}
            >
              <option value="">-- Select Parent A --</option>
              {parentACandidates.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({BREEDS[a.breed as keyof typeof BREEDS]?.name || a.breed})</option>
              ))}
            </select>

            {parentA && (
              <div style={{ fontSize: '10px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                <div>Gen: {parentA.generation}</div>
                <div>Breed: {BREEDS[parentA.breed as keyof typeof BREEDS]?.name || parentA.breed}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px' }}>
                  <div>Speed: {parentA.speed}</div>
                  <div>Defense: {parentA.rug_defense}</div>
                  <div>Aggression: {parentA.aggression}</div>
                  <div>Intel: {parentA.wallet_intelligence}</div>
                </div>
              </div>
            )}
          </div>

          {/* Parent B Selection */}
          <div style={{
            background: '#0d0d12', border: '1px solid #1a1a28', borderRadius: '6px',
            padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px'
          }}>
            <div style={{ fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Parent B (Second Lineage)
            </div>
            <select
              value={parentBId}
              onChange={e => setParentBId(e.target.value)}
              style={{
                width: '100%', background: '#050508', border: '1px solid #222', color: '#fff',
                padding: '10px', borderRadius: '4px', outline: 'none'
              }}
            >
              <option value="">-- Select Parent B --</option>
              {parentBCandidates.map(a => (
                <option key={a.id} value={a.id}>{a.name} ({BREEDS[a.breed as keyof typeof BREEDS]?.name || a.breed})</option>
              ))}
            </select>

            {parentB && (
              <div style={{ fontSize: '10px', color: '#aaa', display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                <div>Gen: {parentB.generation}</div>
                <div>Breed: {BREEDS[parentB.breed as keyof typeof BREEDS]?.name || parentB.breed}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '6px' }}>
                  <div>Speed: {parentB.speed}</div>
                  <div>Defense: {parentB.rug_defense}</div>
                  <div>Aggression: {parentB.aggression}</div>
                  <div>Intel: {parentB.wallet_intelligence}</div>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Breeding Configuration & Results */}
        {parentA && parentB ? (
          <div style={{
            background: '#0d0d12', border: '1px solid #1a1a28', borderRadius: '6px',
            padding: '20px', display: 'flex', gap: '24px'
          }}>
            {/* Traits Blending Preview */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '10px', color: '#CE93D8', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold', marginBottom: '8px' }}>
                Offspring Hybrid Traits Preview
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px', fontSize: '10px', color: '#aaa' }}>
                {Object.entries(previewTraits).map(([trait, val]) => (
                  <div key={trait} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #15151f', paddingBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize' }}>{trait.replace(/_/g, ' ')}</span>
                    <span style={{ color: '#fff', fontWeight: 'bold' }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Panel */}
            <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
                  Offspring Name
                </label>
                <input
                  type="text"
                  value={childName}
                  onChange={e => setChildName(e.target.value)}
                  placeholder="e.g. Gravehound Hybrid #1"
                  style={{
                    width: '100%', background: '#050508', border: '1px solid #222', color: '#fff',
                    padding: '10px', borderRadius: '4px', fontSize: '12px', outline: 'none'
                  }}
                />
              </div>

              <button
                onClick={handleBreed}
                disabled={breeding}
                style={{
                  background: 'rgba(206,147,216,0.1)', border: '1px solid rgba(206,147,216,0.4)',
                  color: '#CE93D8', padding: '12px', borderRadius: '4px', fontSize: '11px',
                  fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.2s'
                }}
              >
                {breeding ? 'MUTATING DNA...' : 'BREED AGENTS (BURNS $AUTR)'}
              </button>

              {error && (
                <div style={{ color: '#FF6B6B', fontSize: '10px', textAlign: 'center' }}>
                  {error}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div style={{
            padding: '48px', border: '1px dashed #222', borderRadius: '6px',
            textAlign: 'center', color: '#444', fontSize: '11px'
          }}>
            Select two parent agents to initialize hybridization
          </div>
        )}

        {/* Breeding Result Notification */}
        {result && (
          <div style={{
            background: 'rgba(0, 200, 150, 0.05)', border: '1px solid rgba(0, 200, 150, 0.25)',
            borderRadius: '6px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px'
          }}>
            <div style={{ color: '#00C896', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Offspring hybrid successfully created!
            </div>
            <div style={{ fontSize: '10px', color: '#aaa' }}>
              <div>Name: {result.name}</div>
              <div>DNA Hash: {result.id}</div>
              <div>Generation: Gen {result.generation}</div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
