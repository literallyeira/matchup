import type { Application } from './supabase';

export interface BadgeInfo {
  key: string;
  label: string;
  icon: string;
  colorClass: string;
}

const BADGE_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/20 text-blue-400',
  green: 'bg-green-500/20 text-green-400',
  pink: 'bg-pink-500/20 text-pink-400',
  violet: 'bg-violet-500/20 text-violet-400',
  amber: 'bg-amber-500/20 text-amber-400',
};

/** Client-side rozet hesaplama - Application verisinden türetilebilen rozetler */
export function getInlineBadges(app: Application): BadgeInfo[] {
  const badges: BadgeInfo[] = [];

  if (app.is_verified) {
    badges.push({ key: 'verified', label: 'Doğrulanmış', icon: 'fa-circle-check', colorClass: BADGE_COLORS.blue });
  }

  if (app.phone?.trim()) {
    badges.push({ key: 'phone_verified', label: 'Onaylı', icon: 'fa-phone', colorClass: BADGE_COLORS.green });
  }

  const daysSince = (Date.now() - new Date(app.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince < 7) {
    badges.push({ key: 'new_member', label: 'Yeni', icon: 'fa-seedling', colorClass: BADGE_COLORS.green });
  }
  if (daysSince >= 30) {
    badges.push({ key: 'veteran', label: 'Kıdemli', icon: 'fa-medal', colorClass: BADGE_COLORS.amber });
  }

  return badges;
}
