import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { El, Page } from '../types';
import { PAGE_H, PAGE_W } from '../types';

const FONTS = {
  serif: "'Fraunces', Georgia, serif",
  sans: "'Plus Jakarta Sans', system-ui, sans-serif",
  reading: "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif",
} as const;

export const IMG_FILTERS: Record<string, string | undefined> = {
  none: undefined, grayscale: 'grayscale(1)', sepia: 'sepia(.85)', warm: 'sepia(.35) saturate(1.3) hue-rotate(-10deg)',
  vintage: 'sepia(.5) contrast(.9) brightness(1.05) saturate(.8)', bright: 'brightness(1.15) contrast(1.05)', soft: 'contrast(.9) brightness(1.08) saturate(.9)',
};

export function ElementView({ el, active, editing }: { el: El; active: boolean; editing?: boolean }) {
  const outer: CSSProperties = {
    position: 'absolute', left: el.x, top: el.y, width: el.w, height: el.h,
    transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined, opacity: el.opacity,
  };
  const animClass = active && el.anim.type !== 'none' ? `anim anim-${el.anim.type}` : '';
  const animStyle = { '--ad': `${el.anim.duration}s`, '--adl': `${el.anim.delay}s` } as CSSProperties;
  let inner: React.ReactNode;
  if (el.type === 'text') {
    inner = (
      <div style={{
        fontFamily: FONTS[el.font], fontSize: el.size, color: el.color, fontWeight: el.bold ? 700 : 400,
        fontStyle: el.italic ? 'italic' : 'normal', textAlign: el.align, lineHeight: el.lineHeight,
        whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', visibility: editing ? 'hidden' : undefined,
      }}>{el.text}</div>
    );
  } else if (el.type === 'image') {
    const flip = `${el.flipX ? 'scaleX(-1) ' : ''}${el.flipY ? 'scaleY(-1)' : ''}`.trim();
    inner = <img src={el.src} alt={el.alt} draggable={false} style={{ width: '100%', height: '100%', objectFit: el.fit ?? 'cover', borderRadius: el.radius, display: 'block', transform: flip || undefined, filter: IMG_FILTERS[el.filter ?? 'none'] }} />;
  } else {
    inner = <div style={{ width: '100%', height: '100%', background: el.fill, borderRadius: el.shape === 'circle' ? '50%' : el.radius }} />;
  }
  return (
    <div style={outer} data-el={el.id}>
      <div className={animClass} style={{ width: '100%', height: '100%', filter: el.shadow ? 'drop-shadow(0 6px 10px rgba(30,6,12,.38))' : undefined, ...animStyle }}>{inner}</div>
    </div>
  );
}

interface Props { page: Page; active?: boolean; editor?: boolean; hide?: string }

/** Menggambar satu halaman 400x560 dan menyesuaikan skala dengan lebar wadahnya. */
export const PageView = memo(function PageView({ page, active = false, editor = false, hide }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const update = () => setScale((node.clientWidth || PAGE_W) / PAGE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={ref} className="pv" style={{ background: page.bg }}>
      <div className="pv-inner" style={{ width: PAGE_W, height: PAGE_H, transform: `scale(${scale})`, background: page.bg }}>
        {page.bgImage && <img src={page.bgImage} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        {page.elements.map((el) => <ElementView key={el.id} el={el} active={active && !editor} editing={hide === el.id} />)}
      </div>
    </div>
  );
});
