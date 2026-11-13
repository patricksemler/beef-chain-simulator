import { SteerMark } from '@/components/site/hand-drawn';
import { ThemeToggle } from '@/components/site/theme-toggle';

export type SitePage = 'home' | 'trends' | 'simulator';

const NAV_LINKS: readonly { page: SitePage; href: string; label: string }[] = [
  { page: 'trends', href: '/trends', label: 'Market trends' },
  { page: 'simulator', href: '/simulator', label: 'Simulator' },
];

/**
 * The one header for every page: a maroon band with the brand, two links and
 * the theme toggle. `wide` spans the window for the simulator's full-width
 * layout. Links are plain anchors on purpose: the site is a static export of
 * three separate documents, and the framework's client router does not
 * survive that build, so a full page load is the reliable path.
 */
export function SiteHeader({
  current,
  wide = false,
}: {
  current: SitePage;
  wide?: boolean;
}) {
  return (
    <header className="site-header" data-wide={wide || undefined}>
      <div className="site-header-inner">
        <a
          href="/"
          className="site-brand"
          aria-current={current === 'home' ? 'page' : undefined}
        >
          <SteerMark className="site-brand-mark" />
          <span className="site-brand-name">Beef Chain Simulator</span>
        </a>
        <div className="site-header-actions">
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
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
