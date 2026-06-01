'use client';

import React, { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import dynamic from 'next/dynamic';
import { signIn, useSession } from 'next-auth/react';
import bs58 from 'bs58';

const WalletMultiButton = dynamic(
  async () => (await import('@solana/wallet-adapter-react-ui')).WalletMultiButton,
  { ssr: false }
);

export default function TokenGateCard() {
  const { publicKey, signMessage } = useWallet();
  const { data: session, status } = useSession();
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleVerify = async () => {
    try {
      setLoading(true);
      setError('');
      setMessage('');

      if (!publicKey || !signMessage) {
        throw new Error('Wallet not fully connected or does not support message signing.');
      }

      if (status !== 'authenticated') {
        throw new Error('Please connect your GitHub account first.');
      }

      // 1. Sign a message to prove ownership of the wallet
      const messageStr = `Sign this message to verify ownership of your wallet for Trencher Agent. Nonce: ${Date.now()}`;
      const messageBytes = new TextEncoder().encode(messageStr);
      const signatureBytes = await signMessage(messageBytes);
      const signature = bs58.encode(signatureBytes);

      // 2. Send to backend
      const res = await fetch('/api/grant-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: publicKey.toBase58(),
          signature,
          message: messageStr
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify token balance.');
      }

      setMessage(data.message || 'Success! Check your GitHub email for the repository invitation.');
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      border: '1px solid #333',
      borderRadius: '8px',
      padding: '24px',
      background: '#111',
      color: '#fff',
      maxWidth: '400px',
      margin: '0 auto',
      fontFamily: 'sans-serif'
    }}>
      <h2 style={{ marginTop: 0 }}>GitHub Access Verification</h2>
      <p style={{ fontSize: '14px', color: '#aaa', marginBottom: '24px' }}>
        Hold at least <strong>1% of the total supply</strong> of AUTR to get access to the private repository.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Step 1: Connect Wallet */}
        <div>
          <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>1. Connect Solana Wallet</div>
          <WalletMultiButton style={{ width: '100%', justifyContent: 'center' }} />
        </div>

        {/* Step 2: Connect GitHub */}
        <div>
          <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>2. Connect GitHub</div>
          {status === 'authenticated' ? (
            <div style={{ padding: '10px', background: '#2ea043', borderRadius: '4px', textAlign: 'center' }}>
              Connected as {(session?.user as { login?: string })?.login || session?.user?.name}
            </div>
          ) : (
            <button 
              onClick={() => signIn('github')}
              style={{
                width: '100%',
                padding: '12px',
                background: '#24292e',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Sign in with GitHub
            </button>
          )}
        </div>

        {/* Step 3: Verify */}
        <div>
          <div style={{ marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>3. Claim Access</div>
          <button 
            onClick={handleVerify}
            disabled={!publicKey || status !== 'authenticated' || loading}
            style={{
              width: '100%',
              padding: '12px',
              background: (!publicKey || status !== 'authenticated' || loading) ? '#444' : '#6e56cf',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (!publicKey || status !== 'authenticated' || loading) ? 'not-allowed' : 'pointer',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Verifying...' : 'Verify Token & Get Access'}
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div style={{ color: '#ff4d4f', fontSize: '13px', marginTop: '8px', padding: '10px', background: 'rgba(255, 77, 79, 0.1)', borderRadius: '4px' }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ color: '#52c41a', fontSize: '13px', marginTop: '8px', padding: '10px', background: 'rgba(82, 196, 26, 0.1)', borderRadius: '4px' }}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}
