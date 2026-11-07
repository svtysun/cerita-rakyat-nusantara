import { useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { El, Page, TextEl } from '../types';
import { PAGE_H, PAGE_W } from '../types';
import { ElementView } from '../components/PageView';
import { Icon } from '../components/Icon';

export interface Play { key: number; id?: string }
interface Props {
  page: Page; zoom: number; selId: string | null; play: Play | null;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: Partial<El>, record: boolean) => void;
  onGesture: (start: boolean) => void;
  onDup?: () => void; onDel?: () => void;
}

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
const HANDLES: { h: Handle; sx: number; sy: number }[] = [
  { h: 'nw', sx: -1, sy: -1 }, { h: 'n', sx: 0, sy: -1 }, { h: 'ne', sx: 1, sy: -1 }, { h: 'e', sx: 1, sy: 0 },
  { h: 'se', sx: 1, sy: 1 }, { h: 's', sx: 0, sy: 1 }, { h: 'sw', sx: -1, sy: 1 }, { h: 'w', sx: -1, sy: 0 },
];
const FONTS = { serif: "'Fraunces', Georgia, serif", sans: "'Plus Jakarta Sans', system-ui, sans-serif", reading: "'Iowan Old Style', 'Palatino Linotype', Georgia, serif" } as const;
const SNAP = 5;

export function Canvas({ page, zoom, selId, play, onSelect, onPatch, onGesture, onDup, onDel }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number }>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const sel = page.elements.find((e) => e.id === selId) ?? null;

  useEffect(() => { setEditing(null); }, [page.id]);

  const gesture = (e: RPointerEvent, el: El, kind: 'move' | 'resize' | 'rotate', handle?: { sx: number; sy: number }) => {
    e.preventDefault(); e.stopPropagation();
    const start = { px: e.clientX, py: e.clientY, el: { ...el } };
    const rect = stageRef.current!.getBoundingClientRect();
    let moved = false;
    onGesture(true); setDragging(true);
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - start.px) / zoom, dy = (ev.clientY - start.py) / zoom;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 1.5) return;
      moved = true;
      const s = start.el;
      if (kind === 'move') {
        let x = s.x + dx, y = s.y + dy;
        const g: { x?: number; y?: number } = {};
        if (!ev.altKey) {
          const others = page.elements.filter((o) => o.id !== s.id);
          const xs = [0, PAGE_W / 2, PAGE_W, ...others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w])];
          const ys = [0, PAGE_H / 2, PAGE_H, ...others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h])];
          const best = (pts: number[], targets: number[]) => {
            let r: { d: number; to: number } | null = null;
            for (const p of pts) for (const t of targets) { const d = t - p; if (Math.abs(d) < SNAP && (!r || Math.abs(d) < Math.abs(r.d))) r = { d, to: t }; }
            return r;
          };
          const bx = best([x, x + s.w / 2, x + s.w], xs);
          const by = best([y, y + s.h / 2, y + s.h], ys);
          if (bx) { x += bx.d; g.x = bx.to; }
          if (by) { y += by.d; g.y = by.to; }
        }
        setGuides(g);
        onPatch(s.id, { x: Math.round(x), y: Math.round(y) }, false);
      } else if (kind === 'resize' && handle) {
        const th = (s.rotation * Math.PI) / 180;
        const dxl = dx * Math.cos(th) + dy * Math.sin(th), dyl = -dx * Math.sin(th) + dy * Math.cos(th);
        let nw = handle.sx ? Math.max(12, s.w + handle.sx * dxl) : s.w;
        let nh = handle.sy ? Math.max(12, s.h + handle.sy * dyl) : s.h;
        const lock = handle.sx && handle.sy && (s.type === 'image') !== ev.shiftKey;
        if (lock) { const r = s.w / s.h; if (Math.abs(nw - s.w) / s.w > Math.abs(nh - s.h) / s.h) nh = nw / r; else nw = nh * r; }
        const a = handle.sx * (nw - s.w) / 2, b = handle.sy * (nh - s.h) / 2;
        const ccx = s.x + s.w / 2 + Math.cos(th) * a - Math.sin(th) * b;
        const ccy = s.y + s.h / 2 + Math.sin(th) * a + Math.cos(th) * b;
        onPatch(s.id, { w: Math.round(nw), h: Math.round(nh), x: Math.round(ccx - nw / 2), y: Math.round(ccy - nh / 2) }, false);
      } else if (kind === 'rotate') {
        const cx = rect.left + (s.x + s.w / 2) * zoom, cy = rect.top + (s.y + s.h / 2) * zoom;
        let ang = (Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180) / Math.PI + 90;
        if (ang > 180) ang -= 360;
        const snapped = Math.round(ang / 15) * 15;
        if (ev.shiftKey || Math.abs(ang - snapped) < 4) ang = snapped;
        onPatch(s.id, { rotation: Math.round(ang) }, false);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setGuides({}); setDragging(false);
      onGesture(false);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onStageDown = (e: RPointerEvent) => {
    const t = (e.target as HTMLElement).closest('[data-el]') as HTMLElement | null;
    if (editing) {
      if ((e.target as HTMLElement).classList.contains('cv-edit')) return;
      (document.activeElement as HTMLElement | null)?.blur();
    }
    if (!t) { onSelect(null); return; }
    const el = page.elements.find((x) => x.id === t.dataset.el);
    if (!el) return;
    onSelect(el.id);
    gesture(e, el, 'move');
  };

  const handleSize = 11 / zoom;
  const playing = (el: El) => !!play && (!play.id || play.id === el.id);

  return (
    <div className="cv-wrap" style={{ width: PAGE_W * zoom, height: PAGE_H * zoom }}>
      <div ref={stageRef} className="cv-stage" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${zoom})`, background: page.bg }}
        onPointerDown={onStageDown} onDoubleClick={(e) => {
          const t = (e.target as HTMLElement).closest('[data-el]') as HTMLElement | null;
          const el = t && page.elements.find((x) => x.id === t.dataset.el);
          if (el?.type === 'text') setEditing(el.id);
        }}>
        {page.bgImage && <img src={page.bgImage} alt="" draggable={false} className="cv-bgimg" />}
        {page.elements.map((el) => (
          <ElementView key={el.id + (playing(el) ? ':' + play!.key : '')} el={el} active={playing(el)} editing={editing === el.id} />
        ))}
        <div className="cv-safe" />
        {guides.x !== undefined && <div className="cv-guide cv-guide-v" style={{ left: guides.x, width: 1 / zoom }} />}
        {guides.y !== undefined && <div className="cv-guide cv-guide-h" style={{ top: guides.y, height: 1 / zoom }} />}

        {sel && editing !== sel.id && (
          <div className="cv-sel" style={{ left: sel.x, top: sel.y, width: sel.w, height: sel.h, transform: `rotate(${sel.rotation}deg)`, outlineWidth: 1.5 / zoom }}>
            {HANDLES.map(({ h, sx, sy }) => (
              <span key={h} className={`cv-h cv-h-${h}`} onPointerDown={(e) => gesture(e, sel, 'resize', { sx, sy })}
                style={{ width: handleSize, height: handleSize, left: `calc(${(sx + 1) * 50}% - ${handleSize / 2}px)`, top: `calc(${(sy + 1) * 50}% - ${handleSize / 2}px)`, borderWidth: 1.5 / zoom }} />
            ))}
            <span className="cv-rot-line" style={{ height: 22 / zoom, top: -22 / zoom, width: 1.5 / zoom }} />
            <span className="cv-rot" title="Putar" onPointerDown={(e) => gesture(e, sel, 'rotate')}
              style={{ width: handleSize * 1.25, height: handleSize * 1.25, top: -(22 / zoom) - handleSize * 0.9, left: `calc(50% - ${handleSize * 0.625}px)`, borderWidth: 1.5 / zoom }} />
          </div>
        )}

        {editing && (() => {
          const el = page.elements.find((x) => x.id === editing) as TextEl | undefined;
          if (!el || el.type !== 'text') return null;
          return (
            <textarea className="cv-edit" autoFocus defaultValue={el.text}
              onFocus={(e) => e.currentTarget.setSelectionRange(e.currentTarget.value.length, e.currentTarget.value.length)}
              onBlur={(e) => { if (e.currentTarget.value !== el.text) onPatch(el.id, { text: e.currentTarget.value } as Partial<El>, true); setEditing(null); }}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) (e.target as HTMLElement).blur(); }}
              style={{
                left: el.x, top: el.y, width: el.w, height: el.h, transform: `rotate(${el.rotation}deg)`, fontFamily: FONTS[el.font], fontSize: el.size,
                color: el.color, fontWeight: el.bold ? 700 : 400, fontStyle: el.italic ? 'italic' : 'normal', textAlign: el.align, lineHeight: el.lineHeight,
                outlineWidth: 1.5 / zoom,
              }} />
          );
        })()}
      </div>
      {sel && editing !== sel.id && !dragging && onDup && onDel && (() => {
        const above = sel.y * zoom - 74;
        const top = above >= -8 ? above : (sel.y + sel.h) * zoom + 16;
        const left = Math.min(PAGE_W * zoom - 44, Math.max(44, (sel.x + sel.w / 2) * zoom));
        return (
          <div className="cv-float" style={{ left, top }} role="toolbar" aria-label="Aksi elemen" onPointerDown={(e) => e.stopPropagation()}>
            <button onClick={onDup} title="Gandakan (Ctrl+D)" aria-label="Gandakan"><Icon name="copy" size={16} /></button>
            <button className="danger" onClick={onDel} title="Hapus (Delete)" aria-label="Hapus elemen"><Icon name="trash" size={16} /></button>
          </div>
        );
      })()}
    </div>
  );
}
