import type { MouseEvent as RMouseEvent } from 'react';
import type { Story } from '../types';
import { Link, navigate } from '../lib/router';
import { Icon } from './Icon';
import { Cover } from './ui';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { useToast } from '../lib/toast';
import { fmtViews } from '../lib/format';

export function StoryCard({ story, onFavChange, showFav = true, rank }: { story: Story; onFavChange?: (id: number, fav: boolean) => void; showFav?: boolean; rank?: number }) {
  const { user } = useAuth();
  const toast = useToast();
  const toggle = async (e: RMouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) { toast('Masuk dulu untuk menyimpan cerita favorit.', 'err'); navigate('/masuk?next=' + encodeURIComponent(window.location.hash.slice(1) || '/')); return; }
    try {
      const r = await api.post<{ is_favorite: boolean }>('favorites/' + story.id);
      onFavChange?.(story.id, r.is_favorite);
      toast(r.is_favorite ? 'Ditambahkan ke favorit.' : 'Dihapus dari favorit.');
    } catch (err: any) { toast(err.message, 'err'); }
  };
  return (
    <Link to={`/cerita/${story.id}`} className="card story-card" data-cat={story.category}>
      <div className="sc-img">
        <Cover src={story.image_url} alt={`Sampul ${story.title}`} province={story.province} title={story.title} />
        {rank && <span className="rank-badge" aria-label={`Peringkat ${rank}`}>#{rank}</span>}
        {showFav && (
          <button className={`fav-btn ${story.is_favorite ? 'on' : ''}`} onClick={toggle} aria-label={story.is_favorite ? 'Hapus dari favorit' : 'Simpan ke favorit'} aria-pressed={!!story.is_favorite}>
            <Icon name="heart" size={17} fill={!!story.is_favorite} />
          </button>
        )}
      </div>
      <div className="sc-body">
        <span className="sc-cat">{story.category}</span>
        <h3>{story.title}</h3>
        <p className="sc-loc"><Icon name="pin" size={14} />{story.region}, {story.province}</p>
        <p className="sc-desc">{story.short_description}</p>
        <div className="sc-stat"><span title="Jumlah pembaca"><Icon name="eye" size={13} />{fmtViews(story.views)} dibaca</span></div>
        <span className="sc-more"><Icon name="book" size={15} />Baca selengkapnya</span>
      </div>
    </Link>
  );
}
