import Link from 'next/link';
import { ArrowRight, BarChart3, Beef, Calculator, LineChart } from 'lucide-react';

export default function Home() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Main navigation">
        <Link href="/" className="brand-mark"><span className="brand-mark-icon"><Beef size={18} aria-hidden="true" /></span> Beef Chain <span>Simulator</span></Link>
        <div className="landing-nav-links"><Link href="/trends">Market trends</Link><Link href="/simulator" className="nav-cta">Open simulator <ArrowRight size={15} aria-hidden="true" /></Link></div>
      </nav>
      <section className="landing-hero">
        <div className="landing-hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> U.S. beef economics, made legible</p><h1>See the chain.<br /><em>Shape the outcome.</em></h1><p className="landing-lede">Understand how cattle markets move from pasture to plate, then test practical operating decisions with a focused planning model.</p><div className="landing-actions"><Link href="/trends" className="button-primary">Explore market trends <ArrowRight size={17} aria-hidden="true" /></Link><Link href="/simulator" className="button-text">Run a scenario <span aria-hidden="true">↗</span></Link></div></div>
        <div className="landing-signal"><div className="signal-topline"><span>Market snapshot</span><span>2015–2025</span></div><div className="signal-value">$8.84<span>/lb</span></div><div className="signal-label">2025 retail beef average</div><div className="signal-chart" aria-hidden="true"><span style={{ height: '28%' }} /><span style={{ height: '24%' }} /><span style={{ height: '30%' }} /><span style={{ height: '34%' }} /><span style={{ height: '29%' }} /><span style={{ height: '45%' }} /><span style={{ height: '51%' }} /><span style={{ height: '55%' }} /><span style={{ height: '65%' }} /><span style={{ height: '73%' }} /><span style={{ height: '88%' }} /></div><div className="signal-foot"><span>Annual average</span><strong>+38.4% <span>since 2020</span></strong></div></div>
      </section>
      <section className="landing-intro"><div className="intro-kicker"><LineChart size={18} aria-hidden="true" /> One connected view</div><div><h2>From signal to decision.</h2><p>Explore historical context, then translate it into a scenario with the same assumptions and economics.</p></div></section>
      <section className="landing-features" aria-label="Workspace tools"><Link href="/trends" className="feature-row"><span className="feature-icon"><LineChart size={21} aria-hidden="true" /></span><span><h3>Read the market</h3><p>Trace annual prices and feed costs across a decade of USDA-backed history.</p></span><ArrowRight className="feature-arrow" size={20} aria-hidden="true" /></Link><Link href="/simulator" className="feature-row"><span className="feature-icon"><Calculator size={21} aria-hidden="true" /></span><span><h3>Model a scenario</h3><p>Stress-test headcount, timing, costs, biology, and market risk.</p></span><ArrowRight className="feature-arrow" size={20} aria-hidden="true" /></Link></section>
      <footer className="landing-footer"><span>Beef Chain Simulator</span><span>USDA annual averages · 2015–2025</span><span><BarChart3 size={15} aria-hidden="true" /> Built for clearer decisions</span></footer>
    </main>
  );
}
