/**
 * # Page
 *
 * ## What this file is for
 * This file helps run the simulator experience and shows the controls and results people use to test scenarios.
 *
 * ## What it does
 * - Helps the app show the right page, section, or feature.
 * - Accepts or sends data needed by the rest of the app.
 * - Keeps the code organized so it is easier to understand and update.
 *
 * ## Main pieces in this file
 * - `TrendsPage`: the main thing this file provides to the app.
 * - Other small helper functions or values support that main work.
 *
 * ## Important tools and connections
 * - Uses project code and libraries that help the app run smoothly.
 * - Works with the rest of the simulator, dashboard, or UI layers.
 *
 * ## How data moves through it
 * Data usually comes in from a user action or from another part of the app. This file reads that information, applies the needed logic, and then sends it on or displays it on screen.
 *
 * ## Errors and edge cases
 * The code checks for missing, unusual, or invalid values and tries to handle them safely. If something is not valid, it usually falls back to a safe default or prevents the bad input from continuing.
 *
 * ## How it fits into the app
 * This file is one small part of the larger system. It connects to other sections so the app feels like one working tool instead of separate pieces.
 *
 * ## Helpful notes
 * The goal here is to keep the code simple, clear, and easy to maintain without changing how the app behaves.
 */
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
            USDA annual averages, {FIRST_YEAR} to {LAST_YEAR}, in nominal
            dollars (not adjusted for inflation). Pick a point in the chain,
            then a window of years.
          </p>
        </section>

        <TrendsDashboard />

        <section className="site-section trends-next" aria-label="Next step">
          <p>
            Choose any of these years under &ldquo;Market year&rdquo; in the
            simulator to load its prices and costs, with your own herd on top of
            it.
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
