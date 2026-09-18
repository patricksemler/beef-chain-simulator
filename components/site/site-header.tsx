export type SitePage = 'home' | 'trends' | 'simulator';

const NAV_LINKS: readonly { page: SitePage; href: string; label: string }[] = [
  { page: 'trends', href: '/trends', label: 'Market trends' },
  { page: 'simulator', href: '/simulator', label: 'Simulator' },
];

/**
 * Header for the public pages. Links are plain anchors on purpose: the site is
 * a static export of three separate documents, and the framework's client
 * router does not survive that build, so a full page load is the reliable path.
 */
export function SiteHeader({ current }: { current: SitePage }) {
  return (
    <header className="site-header">
      <a
        href="/"
        className="site-brand"
        aria-current={current === 'home' ? 'page' : undefined}
      >
        Beef Chain Simulator
      </a>
      <nav className="site-nav" aria-label="Site">
        {NAV_LINKS.map(({ page, href, label }) => (
          <a
            key={page}
            href={href}
            aria-current={current === page ? 'page' : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
    </header>
  );
}
