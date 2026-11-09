/**
 * Lightweight canvas confetti burst. Fires once, cleans itself up, and is
 * a no-op when the user prefers reduced motion. Colours come from the
 * active club theme so the burst always matches the room.
 */

import { prefersReducedMotion } from '../utils/dom.js';

/**
 * @param {{
 *   originX?: number,   // 0..1, fraction of viewport width
 *   originY?: number,   // 0..1, fraction of viewport height
 *   count?: number,
 *   duration?: number   // ms
 * }} [options]
 * @returns {void}
 */
export function burstConfetti(options = {}) {
  if (typeof document === 'undefined') return;
  if (prefersReducedMotion()) return;

  const { originX = 0.5, originY = 0.55, count = 36, duration = 900 } = options;

  const styles = getComputedStyle(document.documentElement);
  const colors = [
    styles.getPropertyValue('--colorPrimary').trim() || '#DA291C',
    styles.getPropertyValue('--colorAccent').trim() || '#FBE122',
    styles.getPropertyValue('--colorText').trim() || '#F5F5F5',
  ];

  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return;
  }

  const cx = originX * canvas.width;
  const cy = originY * canvas.height;

  const particles = [];
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 3,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI,
      vrot: (Math.random() - 0.5) * 0.4,
      life: 1,
    });
  }

  const start = performance.now();
  const gravity = 0.22;
  const friction = 0.99;
  let raf = 0;

  function tick(now) {
    const t = Math.min(1, (now - start) / duration);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.vx *= friction;
      p.vy = p.vy * friction + gravity;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vrot;
      p.life = 1 - t;

      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.55);
      ctx.restore();
    }

    if (t < 1) {
      raf = requestAnimationFrame(tick);
    } else {
      cancelAnimationFrame(raf);
      canvas.remove();
    }
  }

  raf = requestAnimationFrame(tick);
}