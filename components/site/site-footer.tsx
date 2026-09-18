import { DATA_SOURCES, FIRST_YEAR, LAST_YEAR } from '@/lib/trends/series';

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p className="site-footer-note">
        Bundled assumptions are USDA ERS annual averages for {FIRST_YEAR}–
        {LAST_YEAR} and can be edited in the simulator. Results are planning
        estimates, not USDA forecasts or financial advice.
      </p>
      <ul className="site-footer-sources" aria-label="Data sources">
        {DATA_SOURCES.map((source) => (
          <li key={source.landingPage}>
            <a href={source.landingPage} rel="noreferrer">
              {source.label}
            </a>
          </li>
        ))}
      </ul>
    </footer>
  );
}
