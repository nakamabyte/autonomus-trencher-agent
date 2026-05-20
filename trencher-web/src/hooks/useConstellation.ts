'use client';

import { useEffect, useRef } from 'react';

export function useConstellation(svgId: string, opacityFactor: number) {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let d3Module: typeof import('d3') | null = null;

    async function init() {
      const el = document.getElementById(svgId) as SVGSVGElement | null;
      if (!el) return;

      d3Module = await import('d3');

      // Re-check after async gap
      const svgEl = document.getElementById(svgId) as SVGSVGElement | null;
      if (!svgEl) return;

      function resize() {
        const svgNode = document.getElementById(svgId) as SVGSVGElement | null;
        const parent = svgNode?.parentElement;
        const W = parent?.clientWidth || window.innerWidth;
        const H = parent?.clientHeight || 600;
        svgNode?.setAttribute('width', String(W));
        svgNode?.setAttribute('height', String(H));
        return { W, H };
      }

      let { W, H } = resize();
      const palette = ['#2563EB', '#7C3AED', '#16A34A', '#D97706', '#DC2626', '#475569', '#FFFFFF'];
      const nodes = Array.from({ length: 22 }, (_, i) => ({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.32,
        vy: (Math.random() - 0.5) * 0.32,
        r: 2 + Math.random() * 4,
        color: palette[i % palette.length],
        p: Math.random() * Math.PI * 2,
      }));

      const svg = d3Module.select(`#${svgId}`);
      const gL = svg.append('g');
      const gD = svg.append('g');
      const MAX = 190;

      function step() {
        nodes.forEach(n => {
          n.x += n.vx; n.y += n.vy; n.p += 0.016;
          if (n.x < -20 || n.x > W + 20) n.vx *= -1;
          if (n.y < -20 || n.y > H + 20) n.vy *= -1;
        });

        const edges: { s: typeof nodes[0]; t: typeof nodes[0]; d: number }[] = [];
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < MAX) edges.push({ s: nodes[i], t: nodes[j], d });
          }
        }

        const lines = gL.selectAll<SVGLineElement, typeof edges[0]>('line').data(edges);
        lines.enter().append('line').merge(lines)
          .attr('x1', e => e.s.x).attr('y1', e => e.s.y)
          .attr('x2', e => e.t.x).attr('y2', e => e.t.y)
          .attr('stroke', e => e.s.color)
          .attr('stroke-width', 0.7)
          .attr('opacity', e => (1 - e.d / MAX) * opacityFactor * 0.5);
        lines.exit().remove();

        const circles = gD.selectAll<SVGCircleElement, typeof nodes[0]>('circle').data(nodes);
        circles.enter().append('circle').merge(circles)
          .attr('cx', n => n.x).attr('cy', n => n.y)
          .attr('r', n => n.r + Math.sin(n.p) * 0.8)
          .attr('fill', n => n.color)
          .attr('opacity', n => opacityFactor * (0.45 + Math.sin(n.p) * 0.18));
        circles.exit().remove();

        rafRef.current = requestAnimationFrame(step);
      }

      rafRef.current = requestAnimationFrame(step);

      const handleResize = () => {
        const s = resize();
        W = s.W; H = s.H;
      };
      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }

    const cleanupPromise = init();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      cleanupPromise.then(cleanup => cleanup?.());
      // Remove D3 elements
      const el = document.getElementById(svgId);
      if (el && d3Module) {
        d3Module.select(`#${svgId}`).selectAll('*').remove();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgId, opacityFactor]);
}
