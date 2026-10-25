// Authored folders in src/locales take precedence over automatic translation.
// Add another supported translation target here to offer it in the selector.
export const languages = [
  { code: 'he', label: 'עברית', shortLabel: 'עב', direction: 'rtl' },
  { code: 'en', label: 'English', shortLabel: 'EN', direction: 'ltr' },
  { code: 'ru', label: 'Русский', shortLabel: 'RU', direction: 'ltr' },
];

export function pageNamespaces(pathname, available) {
  const tours = available.filter(name => name.startsWith('tour-') && name !== 'tour-detail');
  const articles = available.filter(name => name.startsWith('article-'));
  let page;
  if (pathname === '/') page = [...tours, ...articles, 'guides', 'gallery', 'home'];
  else if (pathname === '/tours') page = [...tours, 'tours'];
  else if (pathname.startsWith('/tours/')) page = ['tour-detail', `tour-${pathname.split('/')[2]}`];
  else if (pathname === '/blog') page = [...articles, 'blog'];
  else if (pathname.startsWith('/blog/')) page = ['article', `article-${pathname.split('/')[2]}`];
  else if (pathname === '/about') page = ['home', 'about'];
  else if (pathname === '/privacy-policy') page = ['legal', 'privacy'];
  else if (['/accessibility', '/terms'].includes(pathname)) page = ['legal', pathname.slice(1)];
  else page = [pathname.slice(1)];
  return [...new Set(['common', 'not-found', ...page.filter(name => available.includes(name))])];
}
