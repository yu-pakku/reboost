'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { clamp, stepVessel, vesselSlots, type MemoryBall } from '@/domain/vessel-physics';

type Item = { id: string; entering?: boolean };
type MotionConstructor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<string> };
export function GravityVessel({ items, description }: { items: readonly Item[]; description: string }) {
  const uid = useId();
  const wallRef = useRef<SVGPathElement>(null);
  const layerRef = useRef<SVGGElement>(null);
  const controller = useRef({ shake: () => {}, pause: (_value: boolean) => { void _value; } });
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [sensor, setSensor] = useState(false);
  const [message, setMessage] = useState('');
  const permissionAttempt = useRef(0);
  const radius = items.length <= 32 ? 21 : 21 * Math.sqrt(24 / items.length);
  const signature = items.map(item => item.id).join('|');
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const invalidate = () => { permissionAttempt.current++; };
    const sync = () => { setReduced(media.matches); if (media.matches) { permissionAttempt.current++; setSensor(false); } };
    sync(); media.addEventListener('change', sync);
    return () => { invalidate(); media.removeEventListener('change', sync); };
  }, []);
  useEffect(() => {
    const path = wallRef.current, layer = layerRef.current;
    if (!path || !layer || typeof path.getTotalLength !== 'function') return;
    const length = path.getTotalLength();
    const wall = Array.from({ length: 192 }, (_, i) => { const p = path.getPointAtLength(i * length / 192); return { x: p.x, y: p.y }; });
    const nodes = [...layer.children];
    const slots = vesselSlots(wall, nodes.length, radius);
    const balls: MemoryBall[] = nodes.map((_, i) => ({ ...(slots[i] ?? { x: 200, y: 100 }), vx: i * 17 % 7 - 3, vy: 0, r: radius }));
    let gx = 0, gy = 300, held = paused, frameId = 0, last = 0;
    const draw = () => balls.forEach((ball, i) => nodes[i].setAttribute('transform', `translate(${ball.x.toFixed(2)} ${ball.y.toFixed(2)})`));
    const frame = (time: number) => {
      const dt = Math.min((time - last) / 1000 || 1 / 60, .032); last = time;
      for (let i = 0; i < 3; i++) stepVessel(wall, balls, dt / 3, gx, gy);
      draw(); if (!held && !reduced && !document.hidden) frameId = requestAnimationFrame(frame);
    };
    const play = () => { cancelAnimationFrame(frameId); last = 0; if (!held && !reduced && !document.hidden) frameId = requestAnimationFrame(frame); };
    for (let i = 0; i < 480; i++) stepVessel(wall, balls, 1 / 120);
    draw(); play();
    controller.current = {
      shake: () => { if (held || reduced) return; balls.forEach((ball, i) => { ball.vx += (i % 2 ? 1 : -1) * (80 + i % 6 * 16); ball.vy -= 160 + i % 6 * 11; }); play(); },
      pause: value => { held = value; play(); },
    };
    const motion = (event: DeviceMotionEvent) => {
      if (!sensor || held || reduced || document.hidden) return;
      const g = event.accelerationIncludingGravity, a = event.acceleration;
      if (!g || g.x == null || g.y == null || !Number.isFinite(g.x) || !Number.isFinite(g.y)) return;
      const orientation = window as Window & { orientation?: number };
      const angle = (window.screen.orientation?.angle ?? orientation.orientation ?? 0) * Math.PI / 180;
      const x = -g.x, y = g.y;
      gx += (clamp((x * Math.cos(angle) + y * Math.sin(angle)) * 31, -450, 450) - gx) * .18;
      gy += (clamp((-x * Math.sin(angle) + y * Math.cos(angle)) * 31, -450, 450) - gy) * .18;
      if (a && a.x != null && a.y != null && Number.isFinite(a.x) && Number.isFinite(a.y)) {
        const ix = -a.x * Math.cos(angle) + a.y * Math.sin(angle), iy = a.x * Math.sin(angle) + a.y * Math.cos(angle);
        balls.forEach(ball => { ball.vx += clamp(ix * .85, -25, 25); ball.vy += clamp(iy * .85, -25, 25); });
      }
    };
    document.addEventListener('visibilitychange', play);
    if (sensor && !reduced) window.addEventListener('devicemotion', motion);
    return () => { cancelAnimationFrame(frameId); document.removeEventListener('visibilitychange', play); window.removeEventListener('devicemotion', motion); };
    // Positions reset only when the collection, material scale, or sensor mode changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, radius, reduced, sensor]);
  async function toggleSensor() {
    if (sensor) { permissionAttempt.current++; setSensor(false); setMessage('端末連動を停止しました。'); return; }
    const attempt = ++permissionAttempt.current;
    if (!window.isSecureContext || !window.DeviceMotionEvent) { setMessage('この環境では端末連動を利用できません。容器をタップして揺らせます。'); return; }
    try {
      const motion = window.DeviceMotionEvent as MotionConstructor;
      if (motion.requestPermission && await motion.requestPermission() !== 'granted') { setMessage('許可されませんでした。容器をタップして揺らせます。'); return; }
      if (attempt !== permissionAttempt.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      setSensor(true); setMessage('端末連動中です。スマートフォンをゆっくり傾けてください。');
    } catch { setMessage('端末連動を開始できませんでした。'); }
  }
  return <div className="gravity-vessel">
    <button type="button" className="brain-button" aria-label="記憶の容器を揺らす" onClick={() => controller.current.shake()} disabled={paused || reduced}>
      <svg className="brain-svg" viewBox="0 -58.5 400 351" role="img" aria-labelledby={`${uid}-title`} aria-describedby={`${uid}-desc`}>
        <title id={`${uid}-title`}>脳型の知識容器</title><desc id={`${uid}-desc`}>{description}</desc>
          <defs>
            <linearGradient id={`${uid}-vessel-glass`} x2="0" y2="1"><stop stopColor="#f7fcfd" stopOpacity=".2"/><stop offset="1" stopColor="#d8eef5" stopOpacity=".58"/></linearGradient>
            <linearGradient id={`${uid}-bead-glass`} x2=".8" y2="1"><stop stopColor="#f6fcfe" stopOpacity=".9"/><stop offset="1" stopColor="#d5edf5" stopOpacity=".72"/></linearGradient>
            <path id={`${uid}-visual-cell`} d="M-20-10Q-20-15-15-18L-5-24Q0-27 5-24L15-18Q20-15 20-10V10Q20 15 15 18L5 24Q0 27-5 24L-15 18Q-20 15-20 10Z"/>
          </defs>
          <path ref={wallRef} id={`${uid}-gravity-wall`} d="M200 16.5C184 -15 155 -21 136 1.5C110 -9 88 10 82 39C58 48 45 77 51 108C40 140 48 177 70 193.5C78 229 102 245 125 229.5C147 255 178 247 200 222C222 247 251 251 274 228C298 242 323 222 330 192C351 173 359 136 348 106.5C354 74 339 44 318 36C308 6 285 -10 263 1.5C244 -22 214 -14 200 16.5Z" fill={`url(#${uid}-vessel-glass)`} stroke="#86adbe" strokeWidth="1.3"/>
          <path d="M200 18C197.5 34 201 49 199.5 64.5" fill="none" stroke="#b0d1dd" strokeWidth=".8" strokeOpacity=".7"/>
          <path d="M61 102Q59 67.5 86 55.5M140 13.5Q162 -3 180 15" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round"/>
          <g id={`${uid}-brain-fold-lines`} fill="none" stroke="#8fb6c7" strokeWidth=".85" strokeOpacity=".48" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M199.5 64.5C198 84 202 105 200 124C198 144 201 163 200 181C199 192 200 202 200 209"/>
            <path d="M137 7C125 28 129 49 148 53C166 57 176 46 181 34"/>
            <path d="M86 55C109 49 125 66 122 87C119 105 105 112 91 107"/>
            <path d="M151 83C173 84 182 104 173 124C165 143 146 142 144 162C141 178 153 192 170 190"/>
            <path d="M66 139C87 125 107 138 110 158C114 180 101 190 88 191"/>
            <path d="M264 7C278 26 275 48 256 52C237 56 224 43 221 32"/>
            <path d="M317 54C293 49 278 67 282 87C286 105 299 111 313 106"/>
            <path d="M250 84C228 88 220 107 229 126C238 144 256 145 257 164C258 180 247 193 232 191"/>
            <path d="M334 139C313 127 293 141 291 162C290 181 302 193 316 191"/>
          </g>
          <g ref={layerRef}>{items.map((item, i) => <g key={item.id} data-particle-id={item.id} data-crystal-position={i} transform={`translate(${140 + i % 3 * 45} ${170 - Math.floor(i / 3) * 40})`}>
            <g className={item.entering ? 'vessel-ball-enter particle-added' : undefined} onAnimationEnd={event => event.currentTarget.classList.remove('vessel-ball-enter', 'particle-added')}>
              <circle data-visual-item="" r={radius} fill={`url(#${uid}-bead-glass)`} stroke="#a6cbd9" strokeWidth=".85"/>
              <g transform={`scale(${radius / 21})`} fill="none" stroke="#7da5ad" strokeWidth=".9" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="0" cy="2.25" r="7.75" fill="#e4efe7" fillOpacity=".64"/>
                <path d="M0-5.5C-1.2-9.2-4.3-11.4-8-10.7C-7-7.1-3.7-5.5 0-5.5Z"/>
                <path d="M0-5.5C1.2-9.2 4.3-11.4 8-10.7C7-7.1 3.7-5.5 0-5.5Z"/>
              </g>

            </g>
          </g>)}</g>
      </svg>
    </button>
    <div className="vessel-controls">
      <button type="button" disabled={reduced} aria-pressed={paused} onClick={() => { controller.current.pause(!paused); setPaused(!paused); }}>{reduced ? '動きを軽減中' : paused ? '動きを再開' : '動きを止める'}</button>
      <button type="button" disabled={reduced} aria-pressed={sensor} onClick={toggleSensor}>{sensor ? '端末連動を停止' : '端末と連動'}</button>
    </div>
    {message && <p className="subtext" role="status">{message}</p>}
  </div>;
}
