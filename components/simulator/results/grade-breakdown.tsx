'use client';

import { compactCurrency } from '@/lib/model/format';
import { getHistoricalProfile, isHistoricalYear } from '@/lib/model/historical';
import type { GradeKey, SimulationSummary } from '@/lib/model/types';

const GRADE_META: Record<GradeKey, { label: string; color: string }> = {
  prime: { label: 'Prime', color: '#500000' },
  choice: { label: 'Choice', color: '#8f7157' },
  select: { label: 'Select', color: '#c9b59a' },
};

const GRADES: GradeKey[] = ['prime', 'choice', 'select'];

type PerLbField =
  | 'pricePerLb'
  | 'beefCostPerLb'
  | 'storeCostPerLb'
  | 'profitPerLb';

function dollarsPerLb(value: number) {
  return `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(2)}`;
}

function ShareBar({
  label,
  shares,
}: {
  label: string;
  shares: Record<GradeKey, number>;
}) {
  return (
    <div className="grade-share-row">
      <span className="label">{label}</span>
      <div
        className="expense-mix-bar"
        aria-label={GRADES.map(
          (key) =>
            `${GRADE_META[key].label}: ${Math.round(shares[key] * 100)}%`,
        ).join('; ')}
      >
        {GRADES.map((key) => (
          <span
            key={key}
            style={{
              width: `${shares[key] * 100}%`,
              background: GRADE_META[key].color,
            }}
          />
        ))}
      </div>
      <ul className="expense-mix-key">
        {GRADES.map((key) => (
          <li key={key}>
            <span
              style={{ background: GRADE_META[key].color }}
              aria-hidden="true"
            />
            {GRADE_META[key].label}
            <strong>{Math.round(shares[key] * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Splits retail profit across USDA quality grades. */
export function GradeBreakdown({ result }: { result: SimulationSummary }) {
  const grades = result.retailByGrade;
  const totalProfit = GRADES.reduce((sum, key) => sum + grades[key].profit, 0);
  const totalPounds = GRADES.reduce((sum, key) => sum + grades[key].pounds, 0);
  /** Pound-weighted average across grades. */
  const allGrades = (field: PerLbField) =>
    totalPounds > 0
      ? GRADES.reduce(
          (sum, key) => sum + grades[key][field] * grades[key].pounds,
          0,
        ) / totalPounds
      : 0;
  const allProfitable = GRADES.every((key) => grades[key].profit > 0);
  const poundShares = Object.fromEntries(
    GRADES.map((key) => [key, grades[key].share]),
  ) as Record<GradeKey, number>;
  const profitShares = Object.fromEntries(
    GRADES.map((key) => [key, grades[key].profit / totalProfit]),
  ) as Record<GradeKey, number>;

  const year = result.scenario.referenceYear;
  const profile = isHistoricalYear(year) ? getHistoricalProfile(year) : null;
  const usesUsdaMix =
    profile !== null &&
    GRADES.every(
      (key) =>
        Math.abs(profile.gradeMix[key] - result.scenario.gradeMix[key]) <
        0.0001,
    );

  return (
    <div className="stage-visual grade-breakdown">
      <div className="stage-visual-heading">
        <div>
          <h4>Where retail profit comes from</h4>
          <p>
            Each USDA quality grade’s share of the beef sold and of the retail
            profit
          </p>
        </div>
      </div>

      {grades.choice.pounds > 0 ? (
        <>
          <div className="grade-share-bars">
            <ShareBar label="Share of beef sold" shares={poundShares} />
            {allProfitable ? (
              <ShareBar label="Share of retail profit" shares={profitShares} />
            ) : null}
          </div>

          <div className="grade-table-wrap">
            <table className="grade-table">
              <thead>
                <tr>
                  <th scope="col">Grade</th>
                  <th scope="col">Beef sold</th>
                  <th scope="col">Sells for /lb</th>
                  <th scope="col">Beef cost /lb</th>
                  <th scope="col">Store cost /lb</th>
                  <th scope="col">Profit /lb</th>
                  <th scope="col">Total profit</th>
                </tr>
              </thead>
              <tbody>
                {GRADES.map((key) => {
                  const grade = grades[key];
                  return (
                    <tr key={key}>
                      <th scope="row">
                        <span
                          className="grade-swatch"
                          style={{ background: GRADE_META[key].color }}
                          aria-hidden="true"
                        />
                        {GRADE_META[key].label}
                      </th>
                      <td>{(grade.share * 100).toFixed(1)}%</td>
                      <td>{dollarsPerLb(grade.pricePerLb)}</td>
                      <td>{dollarsPerLb(grade.beefCostPerLb)}</td>
                      <td>{dollarsPerLb(grade.storeCostPerLb)}</td>
                      <td className={grade.profitPerLb < 0 ? 'negative' : ''}>
                        {dollarsPerLb(grade.profitPerLb)}
                      </td>
                      <td className={grade.profit < 0 ? 'negative' : ''}>
                        {compactCurrency(grade.profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">All grades</th>
                  <td>100%</td>
                  <td>{dollarsPerLb(allGrades('pricePerLb'))}</td>
                  <td>{dollarsPerLb(allGrades('beefCostPerLb'))}</td>
                  <td>{dollarsPerLb(allGrades('storeCostPerLb'))}</td>
                  <td
                    className={allGrades('profitPerLb') < 0 ? 'negative' : ''}
                  >
                    {dollarsPerLb(allGrades('profitPerLb'))}
                  </td>
                  <td className={totalProfit < 0 ? 'negative' : ''}>
                    {compactCurrency(totalProfit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <p className="stage-visual-note">
            {usesUsdaMix
              ? `Grade shares are USDA steer and heifer grading for ${profile.gradeMixYear}${profile.gradeMixYear !== year ? ' (the latest year USDA published)' : ''}.`
              : 'Grade shares are your custom mix.'}{' '}
            USDA publishes retail prices for Choice only, so Prime and Select
            prices are Choice prices scaled by their wholesale price gap.
            Prime’s gap comes mostly from rib and loin cuts, so it may run high.
          </p>
        </>
      ) : (
        <p className="stage-visual-note">
          No cattle reach retail in this time period, so there is no grade split
          to show.
        </p>
      )}
    </div>
  );
}
