export interface PageView { path: string; title: string; views: number }
export const publicPages = [
  { path: '/', title: 'Accueil' },
  { path: '/projects/', title: 'Projets' },
  { path: '/projects/video-qr/', title: 'Vidéo QR' },
  { path: '/about/', title: 'À propos' },
  { path: '/photography/', title: 'Photographie' },
  { path: '/art/', title: 'Art' },
  { path: '/science/', title: 'Science' },
];
const canonical = (path: string) => path === '/' || /\.[^/]+$/.test(path) ? path : `${path.replace(/\/+$/, '')}/`;
export function pageViews(counts: { path: string; views: number }[], catalog = publicPages): PageView[] {
  const pages = new Map<string, PageView>();
  for (const page of catalog) pages.set(canonical(page.path), { ...page, path: canonical(page.path), views: 0 });
  for (const count of counts) {
    const path = canonical(count.path);
    const page = pages.get(path) ?? { path, title: path, views: 0 };
    page.views += count.views;
    pages.set(path, page);
  }
  return [...pages.values()].sort((a, b) => b.views - a.views || a.title.localeCompare(b.title, 'fr'));
}
