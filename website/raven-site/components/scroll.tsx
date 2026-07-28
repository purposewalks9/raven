
'use client';

import { useEffect, useRef } from 'react';

const CHARS = '.:+-=*#@$&~<>[]|/\\';
const BURST_COUNT = 3;
const PARTICLE_LIFE = 0.6;
const GRAVITY = 20;
const SCROLL_THROTTLE = 30;

type Spark = {
  x: number; y: number;
  vx: number; vy: number;
  char: string;
  life: number;
  maxLife: number;
  size: number;
};

export default function ScrollSpark() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = canvas.getContext('2d')!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    let accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--accent').trim() || '#6366f1';

    const themeObs = new MutationObserver(() => {
      accent = getComputedStyle(document.documentElement)
        .getPropertyValue('--accent').trim() || '#6366f1';
    });
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    function resize() {
      canvas!.width = window.innerWidth * dpr;
      canvas!.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();

    const sparks: Spark[] = [];
    let touchX = -1, touchY = -1;
    let lastBurst = 0;
    let animId = 0;
    let running = false;
    let lastFrame = 0;

    function burst(x: number, y: number, scrollDelta: number) {
      const scrollSpeed = Math.min(Math.abs(scrollDelta), 200);
      const dir = scrollDelta > 0 ? -1 : 1;
      for (let i = 0; i < BURST_COUNT; i++) {
        const spread = (Math.random() - 0.5) * 60;
        const drift = dir * (60 + scrollSpeed * 0.8 + Math.random() * 40);
        sparks.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: spread,
          vy: drift,
          char: CHARS[Math.floor(Math.random() * CHARS.length)],
          life: PARTICLE_LIFE + Math.random() * 0.2,
          maxLife: PARTICLE_LIFE + Math.random() * 0.2,
          size: 7 + Math.random() * 4,
        });
      }
      if (!running) {
        running = true;
        lastFrame = performance.now();
        animId = requestAnimationFrame(frame);
      }
    }

    function frame(now: number) {
      const dt = Math.min((now - lastFrame) / 1000, 0.05);
      lastFrame = now;

      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let alive = 0;
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life -= dt;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        alive++;

        s.vy += GRAVITY * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 0.98;
        s.vy *= 0.98;

        const alpha = s.life / s.maxLife;
        ctx.globalAlpha = alpha * alpha;
        ctx.fillStyle = accent;
        ctx.font = `500 ${s.size}px "IBM Plex Mono", monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.char, s.x, s.y);
      }

      ctx.globalAlpha = 1;
      if (alive > 0) {
        animId = requestAnimationFrame(frame);
      } else {
        running = false;
      }
    }

    const onTouchStart = (e: TouchEvent) => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; };
    const onTouchMove  = (e: TouchEvent) => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; };
    const onTouchEnd   = () => { touchX = -1; touchY = -1; };
    const onMouseMove  = (e: MouseEvent) => { touchX = e.clientX; touchY = e.clientY; };
    const onMouseLeave = () => { touchX = -1; touchY = -1; };

    let lastScrollY = window.scrollY;
    let pendingWheel = 0;

    const onWheel = (e: WheelEvent) => {
      if (touchX < 0) return;
      pendingWheel = e.deltaY;
      requestAnimationFrame(() => {
        if (pendingWheel === 0) return;
        const delta = pendingWheel;
        pendingWheel = 0;
        const atTop = window.scrollY <= 0 && delta < 0;
        const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 1 && delta > 0;
        if (atTop || atBottom) return;
        const now = performance.now();
        if (now - lastBurst < SCROLL_THROTTLE) return;
        lastBurst = now;
        burst(touchX, touchY, delta);
      });
    };

    const onScroll = () => {
      if (touchX < 0) return;
      const delta = window.scrollY - lastScrollY;
      lastScrollY = window.scrollY;
      if (Math.abs(delta) < 2) return;
      const now = performance.now();
      if (now - lastBurst < SCROLL_THROTTLE) return;
      lastBurst = now;
      burst(touchX, touchY, delta);
    };

    const clearPos = () => { touchX = -1; touchY = -1; };
    const onVisChange = () => { if (document.hidden) clearPos(); };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('resize', resize);
    window.addEventListener('blur', clearPos);
    document.addEventListener('visibilitychange', onVisChange);

    return () => {
      cancelAnimationFrame(animId);
      themeObs.disconnect();
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', resize);
      window.removeEventListener('blur', clearPos);
      document.removeEventListener('visibilitychange', onVisChange);
      sparks.length = 0;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 40,
      }}
    />
  );
}