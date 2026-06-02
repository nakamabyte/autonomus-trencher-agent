'use client';

import React, { useState } from 'react';

function StatBox({ label, value, color }: { label: string, value: string | number, color: string }) {
  return (
    <div style={{ background: '#111118', border: '1px solid #1a1a28', padding: '16px', borderRadius: '8px', flex: 1 }}>
      <div style={{ fontSize: '10px', color: '#888', marginBottom: '8px' }}>{label}</div>
      <div style={{ fontSize: '24px', color, fontWeight: 'bold' }}>{value}</div>
    </div>
  );
}

export function BurnStats() {
  const [stats, setStats] = useState({
    total_autr_burned: 0,
    total_sol_collected: 0,
    total_deploys: 0,
    last_burn_at: null,
  })

  return (
    <div style={{ display: 'flex', gap: '16px', fontFamily: 'monospace' }}>
      <StatBox label="$AUTR BURNED" value={stats.total_autr_burned.toLocaleString()} color="#FF6B6B" />
      <StatBox label="SOL COLLECTED" value={stats.total_sol_collected.toFixed(2)} color="#00BBF9" />
      <StatBox label="AGENTS DEPLOYED" value={stats.total_deploys} color="#00C896" />
    </div>
  )
}
