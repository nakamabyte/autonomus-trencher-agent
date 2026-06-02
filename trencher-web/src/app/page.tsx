'use client';

import { useState, useCallback, useEffect } from 'react';

// Layout
import { Nav } from '@/components/layout/Nav';
import { Footer } from '@/components/layout/Footer';

// Landing sections
import { Hero } from '@/components/sections/Hero';
import { Marquee } from '@/components/sections/Marquee';
import { Pipeline } from '@/components/sections/Pipeline';
import { Layers } from '@/components/sections/Layers';
import { Features } from '@/components/sections/Features';
import { Modes } from '@/components/sections/Modes';
import { AgentsTable } from '@/components/sections/AgentsTable';
import { Strategies } from '@/components/sections/Strategies';
import { Config } from '@/components/sections/Config';
import { Ecosystem } from '@/components/sections/Ecosystem';
import { CTA } from '@/components/sections/CTA';

// Platform
import { PlatformView } from '@/components/platform/PlatformView';

// UI
import { Modal } from '@/components/ui/Modal';

// Data
import { LAYER_DATA } from '@/constants/layers';
import { NODES } from '@/constants/agents';

// Statuses for agents table in landing (static zeros until platform opens)
const EMPTY_STATUSES = Object.fromEntries(
  NODES.map(n => [n.id, { st: 'idle' as const, load: 0 }])
);

export default function Home() {
  const [isPlatformOpen, setIsPlatformOpen] = useState(false);

  // Layer modal state
  const [layerModalKey, setLayerModalKey] = useState<string | null>(null);

  // Agent modal state (from landing agents table)
  const [agentModalId, setAgentModalId] = useState<string | null>(null);

  const openPlatform = useCallback(() => {
    setIsPlatformOpen(true);
    document.body.style.overflow = 'hidden';
  }, []);

  // Automatically open platform if coming back from profile page
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('platform') === 'true') {
        setTimeout(openPlatform, 0);
      }
    }
  }, [openPlatform]);

  const closePlatform = useCallback(() => {
    setIsPlatformOpen(false);
    document.body.style.overflow = '';
  }, []);

  const openLayerModal = useCallback((key: string) => {
    setLayerModalKey(key);
  }, []);

  const closeLayerModal = useCallback(() => {
    setLayerModalKey(null);
  }, []);

  const openAgentModal = useCallback((id: string) => {
    setAgentModalId(id);
  }, []);

  const closeAgentModal = useCallback(() => {
    setAgentModalId(null);
  }, []);

  // Layer modal content
  const layerModalContent = (() => {
    if (!layerModalKey) return null;
    const d = LAYER_DATA[layerModalKey];
    if (!d) return null;
    return (
      <>
        <p>{d.desc}</p>
        <div className="modal-sec-label">Agents in this layer</div>
        {d.agents.map(a => (
          <div key={a} className="modal-kv">
            <span className="modal-k">{a}</span>
          </div>
        ))}
        <div className="modal-sec-label">Key Parameters</div>
        {d.details.map(([k, v]) => (
          <div key={k} className="modal-kv">
            <span className="modal-k">{k}</span>
            <span className="modal-v">{v}</span>
          </div>
        ))}
      </>
    );
  })();

  return (
    <>
      {/* ── LANDING VIEW ── */}
      <div id="landing-view" style={{ display: isPlatformOpen ? 'none' : 'block' }}>
        <Nav onOpenPlatform={openPlatform} />
        <Hero onOpenPlatform={openPlatform} />
        <Marquee />
        <Pipeline />
        <Layers onOpenModal={openLayerModal} />
        <Features />
        <Modes />
        <AgentsTable statuses={EMPTY_STATUSES} onOpenAgent={openAgentModal} />
        <Strategies />
        <Config onOpenPlatform={openPlatform} />
        <Ecosystem />
        <CTA onOpenPlatform={openPlatform} />
        <Footer onOpenPlatform={openPlatform} />
      </div>

      {/* ── PLATFORM VIEW ── */}
      <div id="platform-view" style={{ display: isPlatformOpen ? 'block' : 'none' }}>
        {isPlatformOpen && <PlatformView onClose={closePlatform} />}
      </div>

      {/* ── LAYER MODAL ── */}
      <Modal
        id="layer-modal"
        isOpen={!!layerModalKey}
        onClose={closeLayerModal}
        title={layerModalKey ? (LAYER_DATA[layerModalKey]?.title || '') : ''}
      >
        {layerModalContent}
      </Modal>

      {/* ── AGENT MODAL (from landing table) ── */}
      <Modal
        id="agent-modal-landing"
        isOpen={!!agentModalId}
        onClose={closeAgentModal}
        title={agentModalId ? agentModalId.toUpperCase() : ''}
      >
        {agentModalId && (
          <p style={{ fontFamily: 'var(--fb)', fontSize: '13px', color: 'var(--i2)' }}>
            Click &quot;Launch Platform&quot; to inspect live agent connections in the full dashboard.
          </p>
        )}
      </Modal>
    </>
  );
}
