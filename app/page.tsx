import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { ChainLedger } from '@/components/trends/chain-ledger';
import { siteFontClassName } from '@/lib/site-fonts';
import { FIRST_YEAR, LAST_YEAR } from '@/lib/trends/series';

const CAPABILITIES = [
  {
    title: 'Runs the herd',
    body: 'One to thirty million calves over one to ten years, with mortality, biological variation, work-in-process inventory, and correlated market risk.',
  },
  {
    title: 'Loads a USDA year',
    body: `Any year from ${FIRST_YEAR} through ${LAST_YEAR} sets prices, feed, and phase costs while your herd size, timing, cadence, and risk settings stay put.`,
  },
  {
    title: 'Reports by sector',
    body: 'Cash and full economic profit for each stage, monthly profit, break-even prices, risk ranges, and sensitivities, compared against a saved baseline.',
  },
];

export default function Home() {
  return (
    <div className={`site ${siteFontClassName}`}>
      <SiteHeader current="home" />

      <main className="site-main">
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">
            Cattle economics, from the pasture to the meat case.
          </h1>
          <div className="hero-aside">
            <p className="hero-lede">
              Beef Chain Simulator moves a herd through cow{'\u2011'}calf,
              stocker, feedlot, packer, and retail using USDA annual averages
              from {FIRST_YEAR} to {LAST_YEAR}. Set your own herd size and
              assumptions, run it, and see which stages make money.
            </p>
            <div className="hero-actions">
              <a href="/simulator" className="button button-primary">
                Open the simulator
              </a>
              <a href="/trends" className="button button-quiet">
                <span className="button-quiet-label">See market trends</span>
                <span className="button-quiet-arrow" aria-hidden="true">
                  {'\u2192'}
                </span>
              </a>
            </div>
          </div>
        </section>

        <section className="site-section" aria-label="The beef chain">
          <ChainLedger />
          <p className="ledger-more">
            <a href="/trends">
              Every year since {FIRST_YEAR}, series by series
            </a>
          </p>
        </section>

        <section
          className="site-section capabilities"
          aria-labelledby="capabilities-title"
        >
          <h2 id="capabilities-title">What the model does</h2>
          <dl className="capabilities-list">
            {CAPABILITIES.map(({ title, body }) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{body}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
