export type Role = 'user' | 'reviewer' | 'admin';
/** Admin (hanya satu) dan reviewer/publisher sama-sama memakai panel pengelolaan cerita. */
export const isStaff = (u?: { role: Role } | null): boolean => u?.role === 'admin' || u?.role === 'reviewer';
export const ROLE_LABEL: Record<Role, string> = { admin: 'Admin', reviewer: 'Reviewer', user: 'Pengguna' };
export type StoryStatus = 'pending' | 'approved' | 'published' | 'rejected';

export interface User { id: number; name: string; email: string; role: Role; created_at?: string }

export interface Story {
  id: number; user_id: number; title: string; region: string; province: string; category: string;
  short_description: string; full_story?: string; image_url: string | null; author: string;
  status: StoryStatus; reject_reason: string | null; created_at: string; updated_at: string;
  views?: number; is_favorite?: boolean; has_flipbook?: boolean; owner_name?: string; owner_email?: string;
}

export type AnimType = 'none' | 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoom' | 'bounce' | 'float' | 'pulse' | 'sway';
export interface Anim { type: AnimType; delay: number; duration: number }

interface BaseEl { id: string; x: number; y: number; w: number; h: number; rotation: number; opacity: number; anim: Anim; shadow?: boolean }
export interface TextEl extends BaseEl {
  type: 'text'; text: string; font: 'serif' | 'sans' | 'reading'; size: number; color: string;
  bold: boolean; italic: boolean; align: 'left' | 'center' | 'right'; lineHeight: number;
}
export type ImgFilter = 'none' | 'grayscale' | 'sepia' | 'warm' | 'vintage' | 'bright' | 'soft';
export interface ImageEl extends BaseEl { type: 'image'; src: string; alt: string; radius: number; fit?: 'cover' | 'contain' | 'fill'; flipX?: boolean; flipY?: boolean; filter?: ImgFilter }
export interface ShapeEl extends BaseEl { type: 'shape'; shape: 'rect' | 'circle'; fill: string; radius: number }
export type El = TextEl | ImageEl | ShapeEl;

export interface Page { id: string; bg: string; bgImage?: string; elements: El[] }
export interface Flipbook {
  status: 'draft' | 'published'; pages: Page[]; settings: { speed: 'fast' | 'normal' | 'slow' };
  published_at?: string | null; updated_at?: string;
}

export interface Meta {
  published: number; regions: number;
  provinces: { province: string; count: number }[];
  categories: { category: string; count: number }[];
  all_provinces: string[]; all_categories: string[];
}
export interface Notif { id: number; type: string; message: string; is_read: boolean; created_at: string }
export interface StoryRequest { id: number; story_id: number; request_type: 'edit' | 'delete'; reason: string; created_at: string; title: string; user_name: string }
export interface AdminStats { total: number; pending: number; approved: number; published: number; rejected: number; users: number; admins: number; reviewers?: number; requests: number; is_admin?: boolean; default_password?: boolean }
export interface AdminUser { id: number; name: string; email: string; role: Role; created_at: string; stories: number }
export interface Asset { id: number; url: string; original_name: string; created_at: string; used?: boolean }

export const PAGE_W = 400;
export const PAGE_H = 560;

export interface AdminLog { id: number; admin_id: number | null; admin_name: string; action: string; target_type: string; target_id: number | null; target_label: string; detail: string | null; created_at: string }
export interface AdminLogsRes { logs: AdminLog[]; total: number; admins: { id: number; name: string }[]; retention_days?: number }
