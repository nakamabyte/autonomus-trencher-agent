import Link from 'next/link';
import TokenGateCard from '@/components/platform/TokenGateCard';

export default function VerifyPage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#000', padding: '20px', position: 'relative' }}>
      <Link 
        href="/" 
        className="hover:text-white"
        style={{ position: 'absolute', top: '32px', left: '32px', color: '#888', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 500, transition: 'color 0.2s' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Back to Home
      </Link>
      <TokenGateCard />
    </main>
  );
}
