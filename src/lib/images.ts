const IMGUR_PAGE_HOSTS = new Set(['imgur.com', 'www.imgur.com', 'm.imgur.com']);
const IMGUR_IMAGE_HOSTS = new Set(['i.imgur.com']);
const KNOWN_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];

function stripUrlDecorations(url: string): string {
  return url.split('#')[0].split('?')[0];
}

function getImgurIdFromPath(pathname: string): string | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length !== 1) return null;
  const candidate = parts[0].trim();
  if (!candidate || candidate.includes('.')) return candidate.split('.')[0] || null;
  return candidate;
}

export function isImgurUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return IMGUR_PAGE_HOSTS.has(parsed.hostname) || IMGUR_IMAGE_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export function getImageCandidates(url: string | null | undefined): string[] {
  if (!url?.trim()) return [];

  const trimmed = url.trim();
  const candidates = new Set<string>([trimmed, stripUrlDecorations(trimmed)]);

  try {
    const parsed = new URL(trimmed);
    if (IMGUR_IMAGE_HOSTS.has(parsed.hostname)) {
      const base = `https://i.imgur.com${stripUrlDecorations(parsed.pathname)}`;
      candidates.add(base);

      const lowerBase = base.toLowerCase();
      if (lowerBase.endsWith('.jpeg')) candidates.add(base.replace(/\.jpeg$/i, '.jpg'));
      if (lowerBase.endsWith('.jpg')) candidates.add(base.replace(/\.jpg$/i, '.jpeg'));
    }

    if (IMGUR_PAGE_HOSTS.has(parsed.hostname)) {
      const imageId = getImgurIdFromPath(parsed.pathname);
      if (imageId) {
        const lowerPath = parsed.pathname.toLowerCase();
        const existingExt = KNOWN_IMAGE_EXTENSIONS.find((ext) => lowerPath.endsWith(ext));
        if (existingExt) {
          candidates.add(`https://i.imgur.com/${imageId}${existingExt}`);
        } else {
          candidates.add(`https://i.imgur.com/${imageId}.jpg`);
          candidates.add(`https://i.imgur.com/${imageId}.jpeg`);
          candidates.add(`https://i.imgur.com/${imageId}.png`);
          candidates.add(`https://i.imgur.com/${imageId}.webp`);
        }
      }
    }
  } catch {
    return [...candidates].filter(Boolean);
  }

  return [...candidates].filter(Boolean);
}

export function getPreferredImageUrl(url: string | null | undefined): string {
  const candidates = getImageCandidates(url);
  return candidates.find((candidate) => candidate.includes('i.imgur.com')) || candidates[0] || '';
}

