import { useRef, useState } from 'react';
import type { Story } from '../types';
import { Icon } from './Icon';
import { Modal } from './ui';
import { useToast } from '../lib/toast';

/** Tautan bagikan: halaman pratinjau di server (judul + sampul untuk WhatsApp/Facebook), lalu dialihkan ke cerita. */
export function shareLink(id: number): string {
  return new URL('api/share.php?id=' + id, document.baseURI).href;
}

const isMobile = () => /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

export function ShareButton({ story, className = 'btn btn-outline btn-sm', label = 'Bagikan' }: { story: Pick<Story, 'id' | 'title' | 'region' | 'province'>; className?: string; label?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const url = shareLink(story.id);
  const text = `Baca “${story.title}” dari ${story.region}, ${story.province} di Cerita Rakyat Nusantara.`;
  const enc = encodeURIComponent;

  const start = async () => {
    // Di HP, buka lembar bagikan bawaan (WhatsApp, Instagram, dll. langsung muncul).
    if (isMobile() && typeof navigator.share === 'function') {
      try { await navigator.share({ title: story.title, text, url }); return; }
      catch (e: any) { if (e?.name === 'AbortError') return; }
    }
    setOpen(true);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast('Tautan disalin.'); }
    catch {
      inputRef.current?.select();
      try { document.execCommand('copy'); toast('Tautan disalin.'); } catch { toast('Salin manual: tekan Ctrl+C.', 'err'); }
    }
  };
  const targets = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${enc(text + ' ' + url)}`, bg: '#25D366', mark: 'WA' },
    { name: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, bg: '#1877F2', mark: 'f' },
    { name: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}`, bg: '#111', mark: 'X' },
    { name: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}`, bg: '#27A7E7', mark: 'TG' },
    { name: 'Email', href: `mailto:?subject=${enc(story.title)}&body=${enc(text + '\n\n' + url)}`, bg: '#8A5A00', mark: '@' },
  ];
  return (
    <>
      <button type="button" className={className} onClick={start}><Icon name="share" size={16} />{label}</button>
      {open && (
        <Modal title="Bagikan cerita" onClose={() => setOpen(false)}>
          <p className="muted share-lead">{story.title}</p>
          <div className="share-copy">
            <input ref={inputRef} readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label="Tautan cerita" />
            <button type="button" className="btn btn-primary btn-sm" onClick={copy}><Icon name="link" size={14} />Salin</button>
          </div>
          <div className="share-grid">
            {targets.map((t) => (
              <a key={t.name} className="share-target" href={t.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}>
                <span className="share-mark" style={{ background: t.bg }} aria-hidden="true">{t.mark}</span>{t.name}
              </a>
            ))}
          </div>
          <p className="muted share-note">Penerima akan melihat judul dan sampul cerita, lalu langsung dibawa ke halaman ceritanya.</p>
        </Modal>
      )}
    </>
  );
}
