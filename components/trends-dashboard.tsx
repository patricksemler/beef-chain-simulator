'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, BarChart3, Beef, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import historicalData from '@/lib/data/historical-scenarios.json';

type MetricKey = 'retailPricePerLb' | 'fedPricePerCwt' | 'feedCostPerTon' | 'calfPricePerCwt';
const metrics: Record<MetricKey, { label: string; unit: string; color: string; format: (value: number) => string }> = {
  retailPricePerLb: { label: 'Retail beef', unit: '$ / lb', color: '#500000', format: (value) => `$${value.toFixed(2)}` },
  fedPricePerCwt: { label: 'Fed cattle', unit: '$ / cwt', color: '#3d5c46', format: (value) => `$${value.toFixed(0)}` },
  feedCostPerTon: { label: 'Feed cost', unit: '$ / ton', color: '#b38b5d', format: (value) => `$${value.toFixed(0)}` },
  calfPricePerCwt: { label: 'Calf price', unit: '$ / cwt', color: '#4a4a4a', format: (value) => `$${value.toFixed(0)}` },
};
const years = historicalData.availableYears;
const rows = years.map((year) => { const profile = historicalData.years[String(year) as keyof typeof historicalData.years]; return { year, retailPricePerLb: profile.retailPricePerLb, fedPricePerCwt: profile.fedPricePerCwt, feedCostPerTon: profile.feedCostPerTon, calfPricePerCwt: profile.calfPricePerCwt }; });

export default function TrendsDashboard() {
  const [metric, setMetric] = React.useState<MetricKey>('retailPricePerLb');
  const [startYear, setStartYear] = React.useState(years[0]);
  const [endYear, setEndYear] = React.useState(years[years.length - 1]);
  const selectedMetric = metrics[metric];
  const start = Math.min(startYear, endYear); const end = Math.max(startYear, endYear);
  const filtered = rows.filter((row) => row.year >= start && row.year <= end);
  const first = filtered[0][metric]; const last = filtered[filtered.length - 1][metric];
  const change = ((last - first) / first) * 100; const high = filtered.reduce((a, b) => a[metric] > b[metric] ? a : b); const low = filtered.reduce((a, b) => a[metric] < b[metric] ? a : b);
  const overallChange = ((rows[rows.length - 1][metric] - rows[0][metric]) / rows[0][metric]) * 100;
  return (
    <main className="trends-page">
      <header className="trends-header"><Link href="/" className="brand-mark"><span className="brand-mark-icon"><Beef size={18} aria-hidden="true" /></span> Beef Chain <span>Simulator</span></Link><nav aria-label="Main navigation"><Link href="/">Home</Link><Link href="/trends" className="active">Market trends</Link><Link href="/simulator">Simulator <ArrowRight size={14} aria-hidden="true" /></Link></nav></header>
      <div className="trends-shell"><div className="trends-heading"><div><p className="eyebrow"><span className="eyebrow-line" /> Historical market view</p><h1>How the market has moved.</h1><p>Annual USDA averages make the long arc visible. Select a series and time window to see what changed, and when.</p></div><div className="data-badge"><BarChart3 size={17} aria-hidden="true" /><span>11 years of annual data<br /><strong>2015–2025</strong></span></div></div>
        <section className="trend-controls" aria-label="Chart controls"><div className="metric-picker"><span className="control-label">Measure</span><div className="metric-options">{(Object.keys(metrics) as MetricKey[]).map((key) => <button type="button" key={key} className={metric === key ? 'selected' : ''} onClick={() => setMetric(key)}>{metrics[key].label}</button>)}</div></div><div className="range-pickers"><label><span className="control-label">From</span><select value={startYear} onChange={(event) => setStartYear(Number(event.target.value))}>{years.map((year) => <option key={year}>{year}</option>)}</select></label><span className="range-arrow">→</span><label><span className="control-label">Through</span><select value={endYear} onChange={(event) => setEndYear(Number(event.target.value))}>{years.map((year) => <option key={year}>{year}</option>)}</select></label></div></section>
        <section className="trend-chart-panel" aria-label={`${selectedMetric.label} trend chart`}><div className="chart-panel-heading"><div><p className="panel-kicker">{selectedMetric.label} <span>· {selectedMetric.unit}</span></p><strong>{selectedMetric.format(last)}</strong><span className={`change-pill ${change >= 0 ? 'up' : 'down'}`}>{change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}{Math.abs(change).toFixed(1)}% in selected period</span></div><span className="chart-period">{start} — {end}</span></div><div className="trend-chart"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 800, height: 368 }}><LineChart data={filtered} margin={{ top: 12, right: 20, left: 4, bottom: 4 }}><CartesianGrid vertical={false} stroke="#e6dfd4" /><XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: '#5d5955', fontSize: 12 }} /><YAxis tickLine={false} axisLine={false} width={52} tick={{ fill: '#5d5955', fontSize: 12 }} tickFormatter={(value) => selectedMetric.format(value)} domain={['auto', 'auto']} /><Tooltip contentStyle={{ border: '1px solid #e6dfd4', borderRadius: 8, fontSize: 13 }} formatter={(value) => [selectedMetric.format(Number(value)), selectedMetric.label]} labelFormatter={(label) => `Year ${label}`} /><Line type="monotone" dataKey={metric} stroke={selectedMetric.color} strokeWidth={3} dot={{ fill: selectedMetric.color, r: 4, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} /></LineChart></ResponsiveContainer></div><div className="chart-source"><Info size={14} aria-hidden="true" /> USDA annual averages · Hover the line to inspect a year</div></section>
        <section className="insights-grid"><article className="insight-card insight-featured"><p className="panel-kicker">Selected period · {start}–{end}</p><h2>{change >= 0 ? 'A market moving higher.' : 'A market moving lower.'}</h2><p>{selectedMetric.label} changed {Math.abs(change).toFixed(1)}% from {selectedMetric.format(first)} to {selectedMetric.format(last)}. The period high was {selectedMetric.format(high[metric])} in {high.year}, while the low was {selectedMetric.format(low[metric])} in {low.year}.</p><div className="insight-stat"><strong>{change >= 0 ? '+' : ''}{change.toFixed(1)}%</strong><span>change across this window</span></div></article><article className="insight-card"><p className="panel-kicker">Long view · 2015–2025</p><h2>The decade in context.</h2><p>Across the full dataset, {selectedMetric.label.toLowerCase()} is {overallChange >= 0 ? 'up' : 'down'} {Math.abs(overallChange).toFixed(1)}%.</p><div className="insight-mini"><span>2015</span><div><i style={{ width: '42%' }} /><i style={{ width: '88%' }} /></div><span>2025</span></div></article></section>
        <div className="trends-next"><span>Ready to put the signal to work?</span><Link href="/simulator">Open the scenario simulator <ArrowRight size={16} aria-hidden="true" /></Link></div>
      </div>
    </main>
  );
}