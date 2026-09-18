import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { TrendsDashboard } from '@/components/trends/trends-dashboard';
import { siteFontClassName } from '@/lib/site-fonts';
import { FIRST_YEAR, LAST_YEAR } from '@/lib/trends/series';

export const metadata = { title: 'Market trends | Beef Chain Simulator' };

export default function TrendsPage() {
  return (
    <div className={`site ${siteFontClassName}`}>
      <SiteHeader current="trends" />

      <main className="site-main">
        <section className="page-title" aria-labelledby="trends-title">
          <h1 id="trends-title">Market trends</h1>
          <p>
            USDA annual averages, {FIRST_YEAR} to {LAST_YEAR}. Pick a point in
            the chain, then a window of years.
          </p>
        </section>

        <TrendsDashboard />

        <section className="site-section trends-next" aria-label="Next step">
          <p>
            Any year here can be loaded into the simulator as a complete set of
            prices and costs, with your own herd on top of it.
          </p>
          <a href="/simulator" className="button button-primary">
            Open the simulator
          </a>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
