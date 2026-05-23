'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import type * as D3Type from 'd3';
import type { AgentStatusInfo } from '@/types';
import { NODES, EDGES, NODE_FULL } from '@/constants/agents';
import { LC } from '@/constants/layers';

interface PlatformGraphProps {
  statuses: Record<string, AgentStatusInfo>;
  onOpenAgent: (id: string) => void;
}

export interface PlatformGraphHandle {
  updateGraph: () => void;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

// eslint-disable-next-line react/display-name
export const PlatformGraph = forwardRef<PlatformGraphHandle, PlatformGraphProps>(
  ({ statuses, onOpenAgent }, ref) => {
    const refsRef = useRef<Record<string, unknown> | null>(null);
    const statusesRef = useRef(statuses);
    const selectedRef = useRef<string | null>(null);
    const rafRef = useRef<number | null>(null);
    const simRef = useRef<unknown>(null);
    const d3Ref = useRef<typeof D3Type | null>(null);
    const SID = useRef('p' + Math.random().toString(36).slice(2, 5)).current;

    // Keep statuses in ref so D3 tick can access latest without re-init
    useEffect(() => {
      statusesRef.current = statuses;
    }, [statuses]);

    useImperativeHandle(ref, () => ({
      updateGraph: () => updateGraphVisuals(),
    }));

    function updateGraphVisuals() {
      if (!refsRef.current || !d3Ref.current) return;
      const d3 = d3Ref.current;
      const { nodeGs, edgeSel } = refsRef.current as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nodeGs: D3Type.Selection<SVGGElement, any, SVGGElement, unknown>;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        edgeSel: D3Type.Selection<SVGLineElement, any, SVGGElement, unknown>;
      };
      const pvStatuses = statusesRef.current;
      const pvSelected = selectedRef.current;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      nodeGs.each((_d: any, i: number, nodes: ArrayLike<SVGGElement>) => {
        const d = _d;
        if (!d) return;
        const info = pvStatuses[d.id] || { st: 'idle', load: 0 };
        const st = info.st;
        const isSel = d.id === pvSelected;
        const lc = LC[d.layer] || LC.core;
        const g = d3.select(nodes[i]);

        g.select('.nb')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .attr('r', (n: any) => st === 'active' ? n.kr + 2 : n.kr)
          .attr('fill', lc.grad)
          .attr('opacity', st === 'idle' ? 0.38 : 0.85);

        g.select('.nh').attr('fill', lc.grad)
          .attr('opacity', st === 'active' ? 0.18 : isSel ? 0.12 : 0.05);

        g.select('.ng').attr('fill', lc.grad)
          .attr('opacity', st === 'active' ? 0.5 : 0);

        const RC: Record<string, string> = {
          idle: 'transparent', active: '#4ADE80', processing: '#FCD34D', error: '#F87171',
        };
        g.select('.nr').attr('stroke', isSel ? '#fff' : RC[st])
          .attr('opacity', st !== 'idle' || isSel ? 0.8 : 0);

        g.select('.nl').attr('fill',
          st === 'active' ? 'rgba(255,255,255,.92)' :
          isSel ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.6)');
        g.select('.ns').attr('fill',
          st === 'active' ? 'rgba(255,255,255,.4)' : 'rgba(255,255,255,.18)');
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      edgeSel.each((_d: any, i: number, edgeEls: ArrayLike<SVGLineElement>) => {
        const d = _d;
        if (!d?.source?.id) return;
        const ss = pvStatuses[d.source.id]?.st;
        const ts = pvStatuses[d.target.id]?.st;
        const live = ss === 'active' || ts === 'active';
        const proc = ss === 'processing' || ts === 'processing';

        const stops = d3.selectAll(`#${SID}g${i} stop`);
        stops.each(function (_s: unknown, si: number) {
          const op = si === 0 ? (live ? 0.85 : proc ? 0.6 : 0.42)
                   : si === 1 ? (live ? 0.3  : proc ? 0.15 : 0.1)
                   : 0;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          d3.select(this as any).attr('stop-opacity', op);
        });
        d3.select(edgeEls[i]).attr('stroke-width', live ? 1.5 : proc ? 1 : 0.8);
      });
    }

    function buildNodes() {
      return NODES.map(n => ({
        ...n,
        kr: n.layer === 'core' ? 13 : n.r > 26 ? 9 : n.r > 20 ? 7 : 6,
      }));
    }

    function buildLinks() {
      return EDGES.map(e => ({
        ...e,
        srcLayer: NODES.find(n => n.id === e.source)?.layer || 'core',
      }));
    }

    useEffect(() => {
      let mounted = true;

      async function initGraph() {
        const gw = document.getElementById('pv-gw');
        if (!gw || !mounted) return;

        const W = gw.clientWidth || 900;
        const H = gw.clientHeight || 500;

        const tagEl = document.getElementById('pv-gtag');
        if (tagEl) tagEl.textContent = `AGENT NETWORK — ${NODES.length} NODES · ${EDGES.length} EDGES`;

        const d3 = await import('d3');
        if (!mounted) return;
        d3Ref.current = d3;

        const svg = d3.select('#pv-svg');
        svg.attr('viewBox', null).attr('preserveAspectRatio', null);
        svg.selectAll('*').remove();

        const zoom = d3.zoom()
          .scaleExtent([0.25, 4])
          .on('zoom', (event: any) => {
            gZoom.attr('transform', event.transform);
          });
        svg.call(zoom as any);

        svg.append('rect').attr('width', '100%').attr('height', '100%').attr('fill', '#000');

        const defs = svg.append('defs');

        const softF = defs.append('filter').attr('id', `${SID}soft`)
          .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
        softF.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '1.2').attr('result', 'blur');
        softF.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

        const glowF = defs.append('filter').attr('id', `${SID}glow`)
          .attr('x', '-80%').attr('y', '-80%').attr('width', '260%').attr('height', '260%');
        glowF.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', '5').attr('result', 'blur');
        glowF.append('feMerge').selectAll('feMergeNode').data(['blur', 'SourceGraphic'])
          .enter().append('feMergeNode').attr('in', (d: string) => d);

        const vgr = defs.append('radialGradient')
          .attr('id', `${SID}vg`).attr('cx', '50%').attr('cy', '50%').attr('r', '72%');
        vgr.append('stop').attr('offset', '40%').attr('stop-color', '#000').attr('stop-opacity', 0);
        vgr.append('stop').attr('offset', '100%').attr('stop-color', '#000').attr('stop-opacity', 0.6);

        const nodes = buildNodes();
        const links = buildLinks();

        links.forEach((d, i) => {
          const c = LC[d.srcLayer]?.grad || '#fff';
          const gr = defs.append('linearGradient')
            .attr('id', `${SID}g${i}`)
            .attr('gradientUnits', 'userSpaceOnUse')
            .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 0);
          gr.append('stop').attr('offset', '0%').attr('stop-color', '#ffffff').attr('stop-opacity', 0.45);
          gr.append('stop').attr('offset', '50%').attr('stop-color', c).attr('stop-opacity', 0.12);
          gr.append('stop').attr('offset', '100%').attr('stop-color', c).attr('stop-opacity', 0);
        });

        const gZoom = svg.append('g').attr('class', 'g-zoom');

        const gEdge = gZoom.append('g');
        const gPart = gZoom.append('g');
        const gNode = gZoom.append('g');
        svg.append('rect').attr('width', '100%').attr('height', '100%')
          .attr('fill', `url(#${SID}vg)`).style('pointer-events', 'none');

        const edgeSel = gEdge.selectAll<SVGLineElement, typeof links[0]>('line.el').data(links).enter()
          .append('line').attr('class', 'el')
          .attr('stroke', (_d: typeof links[0], i: number) => `url(#${SID}g${i})`)
          .attr('stroke-width', 0.8)
          .attr('stroke-linecap', 'round');

        const ttEl = document.getElementById('pv-tt');

        type SimNode = typeof nodes[0] & D3Type.SimulationNodeDatum;
        const nodeGs = gNode.selectAll<SVGGElement, SimNode>('g.nd').data(nodes as SimNode[]).enter()
          .append('g').attr('class', 'nd').attr('cursor', 'pointer')
          .call(
            d3.drag<SVGGElement, SimNode>()
              .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
              .on('drag',  (e, d) => { d.fx = e.x; d.fy = e.y; })
              .on('end',   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
          );

        nodeGs.append('circle').attr('class', 'nh')
          .attr('r', (d: typeof nodes[0]) => d.kr * 2.2)
          .attr('fill', (d: typeof nodes[0]) => LC[d.layer]?.grad || '#888')
          .attr('opacity', 0.06)
          .style('filter', `url(#${SID}soft)`);

        nodeGs.append('circle').attr('class', 'nb')
          .attr('r', (d: typeof nodes[0]) => d.kr)
          .attr('fill', (d: typeof nodes[0]) => LC[d.layer]?.grad || '#888')
          .attr('opacity', 0.82)
          .style('filter', `url(#${SID}soft)`);

        nodeGs.append('circle').attr('class', 'ng')
          .attr('r', (d: typeof nodes[0]) => d.kr * 1.8)
          .attr('fill', (d: typeof nodes[0]) => LC[d.layer]?.grad || '#888')
          .attr('opacity', 0)
          .style('filter', `url(#${SID}glow)`);

        nodeGs.append('circle').attr('class', 'nr')
          .attr('r', (d: typeof nodes[0]) => d.kr + 5).attr('fill', 'none')
          .attr('stroke', 'transparent').attr('stroke-width', 1.5).attr('opacity', 0);

        nodeGs.append('text').attr('class', 'nl')
          .attr('x', (d: typeof nodes[0]) => d.kr + 8).attr('y', 0).attr('dy', '0.35em')
          .attr('text-anchor', 'start').attr('fill', 'rgba(255,255,255,0.65)')
          .style('font-family', "'Barlow Condensed',sans-serif")
          .style('font-size', (d: typeof nodes[0]) => d.layer === 'core' ? '11px' : '9px')
          .style('font-weight', (d: typeof nodes[0]) => d.layer === 'core' ? '700' : '500')
          .style('letter-spacing', '0.05em').style('pointer-events', 'none')
          .text((d: typeof nodes[0]) => d.label.length > 11 ? d.label.slice(0, 10) + '…' : d.label);

        nodeGs.append('text').attr('class', 'ns')
          .attr('x', (d: typeof nodes[0]) => d.kr + 8).attr('y', 0).attr('dy', '1.55em')
          .attr('text-anchor', 'start').attr('fill', 'rgba(255,255,255,0.22)')
          .style('font-family', "'Barlow',sans-serif").style('font-size', '6.5px')
          .style('pointer-events', 'none').text((d: typeof nodes[0]) => d.sub);

        if (ttEl) {
          nodeGs
            .on('mouseenter', (ev: MouseEvent, d: typeof nodes[0]) => {
              const r = gw.getBoundingClientRect();
              ttEl.style.left = (ev.clientX - r.left + 16) + 'px';
              ttEl.style.top  = (ev.clientY - r.top - 12) + 'px';
              ttEl.textContent = NODE_FULL[d.id] || d.id;
              ttEl.classList.remove('hide');
            })
            .on('mouseleave', () => ttEl.classList.add('hide'))
            .on('click', (_ev: MouseEvent, d: typeof nodes[0]) => {
              selectedRef.current = selectedRef.current === d.id ? null : d.id;
              updateGraphVisuals();
              onOpenAgent(d.id);
            });
        }

        const sim = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
          .force('link', d3.forceLink(links).id((d: d3.SimulationNodeDatum) => (d as typeof nodes[0]).id)
            .distance((d: d3.SimulationLinkDatum<d3.SimulationNodeDatum>) => {
              const s = d.source as typeof nodes[0];
              const t = d.target as typeof nodes[0];
              return (s.layer === 'core' || t.layer === 'core') ? 118 : 85;
            })
            .strength(0.45))
          .force('charge', d3.forceManyBody().strength(-260))
          .force('center', d3.forceCenter(W / 2, H / 2).strength(0.07))
          .force('collide', d3.forceCollide().radius((d: d3.SimulationNodeDatum) => (d as typeof nodes[0]).kr + 24).strength(0.75));

        simRef.current = sim;

        sim.on('tick', () => {
          nodes.forEach(n => {
            (n as d3.SimulationNodeDatum & typeof nodes[0]).x = Math.max(n.kr + 55, Math.min(W - n.kr - 55, (n as d3.SimulationNodeDatum).x!));
            (n as d3.SimulationNodeDatum & typeof nodes[0]).y = Math.max(n.kr + 18, Math.min(H - n.kr - 18, (n as d3.SimulationNodeDatum).y!));
          });

          links.forEach((d, i) => {
            const s = d.source as unknown as D3Type.SimulationNodeDatum & typeof nodes[0];
            const t = d.target as unknown as D3Type.SimulationNodeDatum & typeof nodes[0];
            if (!s?.x || !t?.x || !s?.y || !t?.y) return;
            const dx = t.x - s.x, dy = t.y - s.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const nx = dx / len, ny = dy / len;
            d3.select(`#${SID}g${i}`)
              .attr('x1', s.x + nx * s.kr).attr('y1', s.y + ny * s.kr)
              .attr('x2', t.x - nx * (t.kr + 6)).attr('y2', t.y - ny * (t.kr + 6));
          });

          edgeSel
            .attr('x1', (d: typeof links[0]) => (d.source as unknown as D3Type.SimulationNodeDatum).x ?? 0)
            .attr('y1', (d: typeof links[0]) => (d.source as unknown as D3Type.SimulationNodeDatum).y ?? 0)
            .attr('x2', (d: typeof links[0]) => {
              const s = d.source as unknown as D3Type.SimulationNodeDatum & typeof nodes[0];
              const t = d.target as unknown as D3Type.SimulationNodeDatum & typeof nodes[0];
              const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0;
              const dx = tx - sx, dy = ty - sy;
              const l = Math.sqrt(dx * dx + dy * dy) || 1;
              return tx - (dx / l) * (t.kr + 6);
            })
            .attr('y2', (d: typeof links[0]) => {
              const s = d.source as unknown as D3Type.SimulationNodeDatum & typeof nodes[0];
              const t = d.target as unknown as D3Type.SimulationNodeDatum & typeof nodes[0];
              const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0;
              const dx = tx - sx, dy = ty - sy;
              const l = Math.sqrt(dx * dx + dy * dy) || 1;
              return ty - (dy / l) * (t.kr + 6);
            });

          nodeGs.attr('transform', (d: D3Type.SimulationNodeDatum) => `translate(${d.x ?? 0},${d.y ?? 0})`);
        });

        // Particles
        let pvPs: { lnk: typeof links[0]; t: number; spd: number; pid: number; sz: number; color: string }[] = [];
        let pvPid = 0;
        let lastSpawn = 0;

        const step = (ts: number) => {
          if (!mounted) return;
          if (ts - lastSpawn > 160) {
            lastSpawn = ts;
            const valid = links.filter(l => {
              const s = l.source as unknown as D3Type.SimulationNodeDatum;
              const t = l.target as unknown as D3Type.SimulationNodeDatum;
              return s && t && typeof s.x === 'number';
            });
            if (valid.length) {
              const lnk = valid[Math.floor(Math.random() * valid.length)];
              pvPs.push({
                lnk, t: 0,
                spd: 0.002 + Math.random() * 0.004,
                pid: pvPid++,
                sz: Math.random() > 0.6 ? 2 : 1.4,
                color: LC[(lnk as typeof links[0]).srcLayer]?.grad || '#fff',
              });
            }
          }
          pvPs = pvPs.filter(p => p.t < 1).map(p => ({ ...p, t: p.t + p.spd }));

          const dots = gPart.selectAll<SVGCircleElement, typeof pvPs[0]>('circle.pt')
            .data(pvPs, d => d.pid);
          dots.enter().append('circle').attr('class', 'pt').merge(dots)
            .attr('r', d => d.sz)
            .attr('cx', d => {
              const s = d.lnk.source as unknown as D3Type.SimulationNodeDatum;
              const t = d.lnk.target as unknown as D3Type.SimulationNodeDatum;
              return lerp(s.x!, t.x!, d.t);
            })
            .attr('cy', d => {
              const s = d.lnk.source as unknown as D3Type.SimulationNodeDatum;
              const t = d.lnk.target as unknown as D3Type.SimulationNodeDatum;
              return lerp(s.y!, t.y!, d.t);
            })
            .attr('fill', d => d.color)
            .attr('opacity', d => Math.sin(d.t * Math.PI) * 0.85);
          dots.exit().remove();

          rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        refsRef.current = { svg, nodes, nodeGs, edgeSel, links } as any;
      }

      initGraph();

      return () => {
        mounted = false;
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        if (simRef.current) { (simRef.current as { stop: () => void }).stop(); simRef.current = null; }
        import('d3').then(d3 => d3.select('#pv-svg').selectAll('*').remove());
        refsRef.current = null;
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Update visuals when statuses change
    useEffect(() => {
      updateGraphVisuals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statuses]);

    return (
      <div className="pv-gw" id="pv-gw">
        <svg id="pv-svg" />
        <div className="pv-gtag" id="pv-gtag">AGENT NETWORK — LIVE</div>
        <div id="pv-tt" className="pv-tt hide" />
        <div className="pv-gcorner">drag nodes · click to inspect</div>
        <div className="pv-legend">
          <div className="pv-legend-title">Agent Layers</div>
          <div className="pv-legend-grid">
            {[
              { color: '#2563EB', label: 'Data' },
              { color: '#7C3AED', label: 'Enrichment' },
              { color: '#16A34A', label: 'Analysis' },
              { color: '#D97706', label: 'Decision' },
              { color: '#DC2626', label: 'Execution' },
              { color: '#475569', label: 'Interface' },
            ].map(item => (
              <div key={item.label} className="pv-legend-item">
                <div className="pv-legend-dot" style={{ background: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
);
