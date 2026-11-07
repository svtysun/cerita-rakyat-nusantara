import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { Page } from '../types';
import { PAGE_H, PAGE_W } from '../types';
import { PageView } from './PageView';

export interface FlipHandle { next: () => void; prev: () => void; goTo: (page: number) => void; jump: (page: number) => void }
export interface FlipState { left: number | null; right: number | null; total: number; single: boolean; atStart: boolean; atEnd: boolean }

interface Props {
  pages: Page[];
  speed?: 'fast' | 'normal' | 'slow';
  autoplay?: boolean;
  startPage?: number;
  forceSingle?: boolean;
  onState?: (s: FlipState) => void;
  label?: string;
  /** Suara kertas saat halaman dibalik (hanya untuk balikan oleh pembaca, bukan pemutaran otomatis). */
  sound?: boolean;
}

const DUR = { fast: 520, normal: 800, slow: 1200 } as const;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const BLANK: Page = { id: 'blank', bg: '#FBF8F1', elements: [] };

/**
 * Buku flipbook 3D: halaman dibalik dengan klik, geser (drag), atau keyboard.
 * Layar lebar menampilkan dua halaman (sampul tunggal di awal), layar sempit satu halaman.
 */
export const FlipBook = forwardRef<FlipHandle, Props>(function FlipBook({ pages, speed = 'normal', autoplay = false, startPage = 0, forceSingle, onState, label, sound = false }, ref) {
  const stageRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<HTMLDivElement>(null);
  const leafEls = useRef<(HTMLDivElement | null)[]>([]);
  const castR = useRef<HTMLDivElement>(null);
  const castL = useRef<HTMLDivElement>(null);
  const edgeR = useRef<HTMLDivElement>(null);
  const edgeL = useRef<HTMLDivElement>(null);
  const boardR = useRef<HTMLDivElement>(null);
  const boardL = useRef<HTMLDivElement>(null);
  const prevA = useRef<number[]>([]);
  const audio = useRef<AudioContext | null>(null);
  const soundOn = useRef(false);
  soundOn.current = sound;

  // Suara kertas dibuat langsung dengan Web Audio (tanpa berkas audio): desis noise yang menyapu dari rendah ke tinggi.
  const swish = (ms: number, power = 1) => {
    if (!soundOn.current) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const ctx: AudioContext = audio.current ?? (audio.current = new AC());
      if (ctx.state === 'suspended') void ctx.resume();
      const dur = clamp(ms / 1000, 0.22, 0.6);
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
      const t = ctx.currentTime;
      bp.frequency.setValueAtTime(700, t); bp.frequency.exponentialRampToValueAtTime(4600, t + dur * 0.75);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.17 * power, t + dur * 0.22);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); bp.connect(g); g.connect(ctx.destination); src.start(t);
    } catch { /* suara bersifat tambahan */ }
  };
  // Ketukan halus saat lembar mendarat.
  const thump = () => {
    if (!soundOn.current || !audio.current) return;
    try {
      const ctx = audio.current; const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(60, t + 0.09);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.15);
    } catch { /* abaikan */ }
  };
  const [box, setBox] = useState({ w: 0, h: 0 });
  const single = forceSingle ?? box.w < 640;

  const list = useMemo(() => {
    const l = pages.length ? pages : [BLANK];
    return single || l.length % 2 === 0 ? l : [...l, { ...BLANK, bg: l[l.length - 1].bg }];
  }, [pages, single]);
  const n = list.length;
  const leaves = single ? n : n / 2;
  const maxK = single ? n - 1 : leaves;

  const angles = useRef<number[]>([]);
  const kRef = useRef(0);
  const [k, setK] = useState(0);
  const busy = useRef(false);
  const pw = box.w && box.h ? Math.floor(Math.min(single ? box.w : box.w / 2, (box.h * PAGE_W) / PAGE_H) * 0.97) : 0;
  const ph = Math.round((pw * PAGE_H) / PAGE_W);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const upd = () => setBox({ w: node.clientWidth, h: node.clientHeight });
    upd();
    const ro = new ResizeObserver(upd);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);

  const apply = useCallback(() => {
    const a = angles.current;
    const prev = prevA.current;
    const RAD = Math.PI / 180;
    let mAng = -1; let mBend = 0; let turned = 0;
    for (let i = 0; i < leaves; i++) {
      const el = leafEls.current[i];
      if (!el) continue;
      const ang = a[i] ?? 0;
      if (ang > 90) turned++;
      const bend = Math.sin(ang * RAD); // 0 saat rebah, 1 saat tegak: seberapa "terangkat" lembar itu
      if (ang > 0.5 && ang < 179.5 && bend > mBend) { mBend = bend; mAng = ang; }
      if (prev[i] === ang) continue;
      prev[i] = ang;
      // Lembar terangkat sedikit ke arah pembaca dan miring tipis, seperti kertas yang ditarik dari sudutnya.
      el.style.transform = `translateZ(${(bend * 5).toFixed(2)}px) rotateY(${-ang}deg) rotateX(${(bend * 0.6).toFixed(2)}deg) skewY(${(-bend * 0.9).toFixed(2)}deg)`;
      el.style.zIndex = String(ang < 90 ? leaves - i + 1 : i + 1);
      const f = el.querySelector<HTMLElement>('.fb-front .fb-shade');
      const b = el.querySelector<HTMLElement>('.fb-back .fb-shade');
      if (f) f.style.opacity = String(ang < 90 ? Math.sin((ang / 90) * (Math.PI / 2)) * 0.42 : 0);
      if (b) b.style.opacity = String(ang > 90 ? Math.sin((1 - (ang - 90) / 90) * (Math.PI / 2)) * 0.42 : 0);
      // Kilau cahaya menyapu permukaan kertas saat dibalik.
      const gf = el.querySelector<HTMLElement>('.fb-front .fb-gloss');
      const gb = el.querySelector<HTMLElement>('.fb-back .fb-gloss');
      if (gf) { gf.style.opacity = String(ang < 90 ? bend * 0.55 : 0); gf.style.backgroundPosition = `${100 - (ang / 90) * 100}% 0`; }
      if (gb) { gb.style.opacity = String(ang > 90 ? bend * 0.55 : 0); gb.style.backgroundPosition = `${100 - ((180 - ang) / 90) * 100}% 0`; }
    }
    // Bayangan lembar yang sedang dibalik jatuh pada halaman di bawahnya.
    const c = mAng >= 0 ? Math.cos(mAng * RAD) : 0;
    if (castR.current) {
      castR.current.style.opacity = mAng >= 0 && mAng < 90 ? String(Math.min(1, mBend * 1.15)) : '0';
      castR.current.style.transform = `translateZ(.5px) scaleX(${(c * 0.9 + 0.2).toFixed(3)})`;
    }
    if (castL.current) {
      castL.current.style.opacity = !single && mAng > 90 ? String(Math.min(1, mBend * 1.15)) : '0';
      castL.current.style.transform = `translateZ(.5px) scaleX(${(-c * 0.9 + 0.2).toFixed(3)})`;
    }
    // Tebal tumpukan halaman di kiri dan kanan berubah mengikuti halaman yang sudah/belum dibuka, plus papan sampulnya.
    const full = Math.min(16, 3 + leaves * 0.9);
    const thickR = full * ((leaves - turned) / leaves);
    const thickL = single ? 0 : full * (turned / leaves);
    if (edgeR.current) edgeR.current.style.width = `${thickR.toFixed(1)}px`;
    if (edgeL.current) edgeL.current.style.width = `${thickL.toFixed(1)}px`;
    if (boardR.current) {
      const o = single ? 1 : clamp((180 - (a[leaves - 1] ?? 0)) / 20, 0, 1);
      boardR.current.style.opacity = String(o);
      boardR.current.style.left = single ? '-3px' : 'calc(50% - 3px)';
      boardR.current.style.width = `${pw + 7 + thickR}px`;
    }
    if (boardL.current) {
      const o = single ? 0 : clamp((a[0] ?? 0) / 20, 0, 1);
      boardL.current.style.opacity = String(o);
      boardL.current.style.left = `${-(thickL + 4)}px`;
      boardL.current.style.width = `${pw + 7 + thickL}px`;
    }
    bookRef.current?.classList.toggle('moving', mAng >= 0);
    if (!single && bookRef.current) {
      const a0 = clamp((a[0] ?? 0) / 180, 0, 1);
      const aL = clamp((a[leaves - 1] ?? 0) / 180, 0, 1);
      const shift = (-pw / 2) * (1 - a0) + (pw / 2) * aL;
      bookRef.current.style.transform = `translateX(${shift}px)`;
    }
  }, [leaves, single, pw]);

  const publish = useCallback((kk: number) => {
    if (!onState) return;
    const left = single ? null : kk >= 1 ? 2 * kk - 1 : null;
    const right = single ? kk : kk < leaves ? 2 * kk : null;
    onState({ left, right, total: pages.length || 1, single, atStart: kk === 0, atEnd: kk >= maxK });
  }, [onState, single, leaves, maxK, pages.length]);

  // Posisi awal / saat mode atau jumlah halaman berubah.
  useLayoutEffect(() => {
    const target = clamp(single ? startPage : Math.ceil(startPage / 2), 0, maxK);
    const kk = Math.min(kRef.current > 0 ? kRef.current : target, maxK);
    angles.current = Array.from({ length: leaves }, (_, i) => (i < kk ? 180 : 0));
    prevA.current = [];
    kRef.current = kk;
    setK(kk);
    apply();
    publish(kk);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leaves, single, pw, pages]);

  const animate = (i: number, from: number, to: number, ms: number) =>
    new Promise<void>((resolve) => {
      const t0 = performance.now();
      const step = (now: number) => {
        const t = clamp((now - t0) / ms, 0, 1);
        angles.current[i] = from + (to - from) * ease(t);
        apply();
        if (t < 1) requestAnimationFrame(step); else resolve();
      };
      requestAnimationFrame(step);
    });

  const finish = (kk: number) => { kRef.current = kk; setK(kk); publish(kk); };

  const flipTo = async (target: number, ms: number = DUR[speed]) => {
    target = clamp(target, 0, maxK);
    if (busy.current || target === kRef.current) return;
    busy.current = true;
    const steps = Math.abs(target - kRef.current);
    // Lompatan jauh: lewati halaman perantara secara instan, animasikan hanya lembar terakhir.
    if (steps > 2) {
      const pre = target > kRef.current ? target - 1 : target + 1;
      angles.current = Array.from({ length: leaves }, (_, i) => (i < pre ? 180 : 0));
      kRef.current = pre;
      apply();
    }
    const per = steps > 1 ? Math.max(180, ms / Math.min(steps, 4)) : ms;
    while (kRef.current !== target) {
      const forward = target > kRef.current;
      const i = forward ? kRef.current : kRef.current - 1;
      swish(per);
      await animate(i, forward ? 0 : 180, forward ? 180 : 0, per);
      thump();
      kRef.current += forward ? 1 : -1;
    }
    busy.current = false;
    finish(kRef.current);
  };

  // Pindah langsung tanpa animasi (dipakai penggeser halaman agar mulus pada buku panjang).
  const jumpTo = (target: number) => {
    target = clamp(target, 0, maxK);
    if (busy.current || target === kRef.current) return;
    angles.current = Array.from({ length: leaves }, (_, i) => (i < target ? 180 : 0));
    kRef.current = target;
    apply();
    finish(target);
  };
  const jumpRef = useRef(jumpTo);
  jumpRef.current = jumpTo;

  const flipRef = useRef(flipTo);
  flipRef.current = flipTo;
  useImperativeHandle(ref, () => ({
    next: () => flipRef.current(kRef.current + 1),
    prev: () => flipRef.current(kRef.current - 1),
    goTo: (page: number) => flipRef.current(single ? page : Math.ceil(page / 2)),
    jump: (page: number) => jumpRef.current(single ? page : Math.ceil(page / 2)),
  }), [single]);

  // Keyboard.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'ArrowRight') flipRef.current(kRef.current + 1);
      if (e.key === 'ArrowLeft') flipRef.current(kRef.current - 1);
      if (e.key === 'Home') flipRef.current(0);
      if (e.key === 'End') flipRef.current(1e9);
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, []);

  // Pemutaran otomatis (hero beranda).
  useEffect(() => {
    if (!autoplay) return;
    const id = setInterval(() => {
      if (busy.current) return;
      if (kRef.current >= maxK) flipRef.current(0, 500); else flipRef.current(kRef.current + 1);
    }, 3800);
    return () => clearInterval(id);
  }, [autoplay, maxK]);

  // Geser dengan pointer / sentuhan.
  const drag = useRef<{ x: number; y: number; leaf: number; dir: 1 | -1; started: boolean; side: 'l' | 'r' } | null>(null);
  const onDown = (e: RPointerEvent) => {
    if (busy.current || e.button > 0) return;
    const rect = stageRef.current!.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const forward = single ? e.clientX > rect.left + rect.width * 0.35 : e.clientX > cx;
    const dir = forward ? 1 : -1;
    const leaf = forward ? kRef.current : kRef.current - 1;
    if (leaf < 0 || (forward && kRef.current >= maxK)) { drag.current = { x: e.clientX, y: e.clientY, leaf: -1, dir, started: false, side: forward ? 'r' : 'l' }; return; }
    drag.current = { x: e.clientX, y: e.clientY, leaf, dir, started: false, side: forward ? 'r' : 'l' };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current;
    if (!d || d.leaf < 0) return;
    const dx = e.clientX - d.x;
    if (!d.started && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - d.y)) d.started = true;
    if (!d.started) return;
    const p = clamp(Math.abs(dx) / (pw * 0.95), 0, 1);
    const moving = d.dir === 1 ? dx < 0 : dx > 0;
    const prog = moving ? p : 0;
    angles.current[d.leaf] = d.dir === 1 ? 180 * prog : 180 - 180 * prog;
    apply();
  };
  const onUp = async (e: RPointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    if (!d.started) {
      if (Math.abs(dx) < 8 && Math.abs(e.clientY - d.y) < 8) flipRef.current(kRef.current + (d.dir === 1 ? 1 : -1));
      return;
    }
    if (d.leaf < 0) return;
    const cur = angles.current[d.leaf];
    const doFlip = d.dir === 1 ? cur > 55 : cur < 125;
    busy.current = true;
    const target = doFlip ? (d.dir === 1 ? 180 : 0) : (d.dir === 1 ? 0 : 180);
    if (doFlip) swish(380, 0.8);
    await animate(d.leaf, cur, target, 320);
    if (doFlip) thump();
    kRef.current += doFlip ? d.dir : 0;
    busy.current = false;
    finish(kRef.current);
  };

  const visible = new Set<number>();
  if (single) visible.add(k); else { if (k >= 1) visible.add(2 * k - 1); if (k < leaves) visible.add(2 * k); }
  const faceW = pw;

  return (
    <div ref={stageRef} className="fb-stage" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      role="group" aria-label={label ?? 'Buku cerita'} tabIndex={0}>
      {pw > 0 && (
        <div ref={bookRef} className={`fb-book ${single ? 'is-single' : ''}`} style={{ width: single ? pw : pw * 2, height: ph }}>
          <div ref={boardL} className="fb-board fb-board-l" aria-hidden="true" />
          <div ref={boardR} className="fb-board fb-board-r" aria-hidden="true" />
          <div ref={edgeL} className="fb-edge fb-edge-l" aria-hidden="true" />
          <div ref={edgeR} className="fb-edge fb-edge-r" aria-hidden="true" />
          <div ref={castL} className="fb-cast fb-cast-l" style={{ width: pw, left: 0 }} aria-hidden="true" />
          <div ref={castR} className="fb-cast fb-cast-r" style={{ width: pw, left: single ? 0 : '50%' }} aria-hidden="true" />
          {Array.from({ length: leaves }, (_, i) => {
            const front = list[single ? i : 2 * i];
            const back = single ? null : list[2 * i + 1];
            return (
              <div key={i} ref={(el) => { leafEls.current[i] = el; }} className="fb-leaf" style={{ width: faceW, height: ph, left: single ? 0 : '50%' }}>
                <div className="fb-face fb-front">
                  <PageView page={front} active={visible.has(single ? i : 2 * i)} />
                  <div className="fb-spine fb-spine-l" /><div className="fb-shade" /><div className="fb-gloss" />
                </div>
                <div className="fb-face fb-back">
                  {back ? <PageView page={back} active={visible.has(2 * i + 1)} /> : <div className="fb-paper" />}
                  <div className="fb-spine fb-spine-r" /><div className="fb-shade" /><div className="fb-gloss" />
                </div>
              </div>
            );
          })}
          {k < maxK && <div className="fb-curl" aria-hidden="true" />}
        </div>
      )}
    </div>
  );
});
