'use client';

import React from 'react';

export default function BurnHistoryPage() {
  return (
    <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'monospace', color: '#fff' }}>
      <h1 style={{ color: '#FF6B6B', borderBottom: '1px solid #333', paddingBottom: '16px', marginBottom: '16px' }}>
        $AUTR Burn History
      </h1>
      
      <div style={{ marginBottom: '32px' }}>
        <a href="/" style={{ color: '#00BBF9', textDecoration: 'none', fontSize: '14px', display: 'inline-block', border: '1px solid #00BBF9', padding: '6px 12px', borderRadius: '4px' }}>
          ← Back to Home
        </a>
      </div>

      <p style={{ color: '#888', marginBottom: '24px' }}>
        A transparent log of all $AUTR buyback and burn events executed by the protocol.
      </p>

      <div style={{
        background: '#111118', border: '1px solid #1a1a28', borderRadius: '8px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#1a1a28', color: '#888', fontSize: '12px', textTransform: 'uppercase' }}>
            <tr>
              <th style={{ padding: '16px' }}>Date</th>
              <th style={{ padding: '16px' }}>SOL Spent</th>
              <th style={{ padding: '16px' }}>$AUTR Burned</th>
              <th style={{ padding: '16px' }}>Burn TX</th>
            </tr>
          </thead>
          <tbody style={{ fontSize: '14px' }}>
            <tr style={{ borderTop: '1px solid #222' }}>
              <td style={{ padding: '16px', color: '#ccc' }}>Pending</td>
              <td style={{ padding: '16px', color: '#00BBF9' }}>- SOL</td>
              <td style={{ padding: '16px', color: '#FF6B6B' }}>- $AUTR</td>
              <td style={{ padding: '16px' }}>-</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '12px', color: '#555', marginTop: '16px', textAlign: 'center' }}>
        Burn cycles run automatically every 6 hours.
      </p>
    </div>
  );
}
