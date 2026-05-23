'use client';

import { useState, useCallback } from 'react';
import { usePlatform } from '@/hooks/usePlatform';
import { PlatformHeader } from './PlatformHeader';
import { PlatformSidebar } from './PlatformSidebar';
import { PlatformGraph } from './PlatformGraph';
import { PlatformLogStrip } from './PlatformLogStrip';
import { PlatformPositions } from './PlatformPositions';
import { Modal } from '@/components/ui/Modal';
import { NODES, NODE_FULL, AGENT_DATA } from '@/constants/agents';
import { LC } from '@/constants/layers';

interface PlatformViewProps {
  onClose: () => void;
}

export function PlatformView({ onClose }: PlatformViewProps) {
  const { metrics, statuses, logs } = usePlatform();
  const [agentModalId, setAgentModalId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [logHeight, setLogHeight] = useState(120);

  const startSidebarDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      setSidebarWidth(Math.max(150, Math.min(800, startW + deltaX)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const startLogDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = logHeight;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = startY - moveEvent.clientY;
      setLogHeight(Math.max(60, Math.min(800, startH + deltaY)));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [logHeight]);

  const openAgent = useCallback((id: string) => {
    setAgentModalId(id);
  }, []);

  const closeAgentModal = useCallback(() => {
    setAgentModalId(null);
  }, []);

  // Build agent modal content
  const agentModalContent = (() => {
    if (!agentModalId) return null;
    const n = NODES.find(x => x.id === agentModalId);
    const d = AGENT_DATA[agentModalId];
    if (!n || !d) return null;
    const lc = LC[n.layer];

    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span style={{
            background: lc.fill, color: lc.text,
            fontFamily: "'Barlow Condensed',sans-serif", fontSize: '9px', fontWeight: 700,
            letterSpacing: '.14em', textTransform: 'uppercase', padding: '4px 10px',
          }}>
            {n.layer}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '8px', color: '#999' }}>
            r={n.r}px
          </span>
        </div>
        <p>{d.role}</p>
        <div className="modal-sec-label">Receives from</div>
        {d.connects_from.length > 0 ? d.connects_from.map(f => {
          const fn = NODES.find(x => x.id === f);
          const flc = LC[fn?.layer || 'core'];
          return (
            <div key={f} className="modal-kv">
              <span className="modal-k">{f}</span>
              <span className="modal-v" style={{ color: flc.stroke }}>{NODE_FULL[f] || f}</span>
            </div>
          );
        }) : <div className="modal-kv"><span className="modal-k">—</span></div>}
        <div className="modal-sec-label">Sends to</div>
        {d.connects_to.length > 0 ? d.connects_to.map(t => {
          const tn = NODES.find(x => x.id === t);
          const tlc = LC[tn?.layer || 'core'];
          return (
            <div key={t} className="modal-kv">
              <span className="modal-k">{t}</span>
              <span className="modal-v" style={{ color: tlc.stroke }}>{NODE_FULL[t] || t}</span>
            </div>
          );
        }) : <div className="modal-kv"><span className="modal-k">—</span></div>}
      </>
    );
  })();

  return (
    <>
      <div className="pv-root" style={{ gridTemplateRows: `48px 1fr ${logHeight}px` }}>
        <PlatformHeader metrics={metrics} onClosePlatform={onClose} />
        
        {/* Horizontal Drag Handle for Log Strip */}
        <div 
          style={{ position: 'absolute', bottom: logHeight - 3, left: 0, right: 0, height: '6px', cursor: 'ns-resize', zIndex: 50 }} 
          onMouseDown={startLogDrag} 
        />

        <div className="pv-main" style={{ gridTemplateColumns: `1fr ${sidebarWidth}px`, position: 'relative' }}>
          <PlatformPositions metrics={metrics} />
          <PlatformGraph statuses={statuses} onOpenAgent={openAgent} />
          
          {/* Vertical Drag Handle for Sidebar */}
          <div 
            style={{ position: 'absolute', right: sidebarWidth - 3, top: 48, bottom: logHeight, width: '6px', cursor: 'ew-resize', zIndex: 50 }} 
            onMouseDown={startSidebarDrag} 
          />

          <PlatformSidebar statuses={statuses} onOpenAgent={openAgent} />
        </div>
        <PlatformLogStrip logs={logs} />
      </div>

      {/* Agent Detail Modal */}
      <Modal
        id="agent-modal"
        isOpen={!!agentModalId}
        onClose={closeAgentModal}
        title={agentModalId ? (NODE_FULL[agentModalId] || agentModalId.toUpperCase()) : ''}
      >
        {agentModalContent}
      </Modal>
    </>
  );
}
