import { STAGE_MAP } from '../constants';

export default function StatsPage({ stats, leads }) {
  if (!stats?.length) {
    return (
      <div className="stats-page">
        <p className="stats-empty">Brak danych</p>
      </div>
    );
  }

  const total = stats.reduce((sum, s) => sum + s.count, 0);
  const maxCount = Math.max(...stats.map((s) => s.count), 1);
  const winCount = stats.find((s) => s.stage === 'win')?.count ?? 0;
  const lostCount = stats.find((s) => s.stage === 'lost')?.count ?? 0;
  const activeCount = total - winCount - lostCount;
  const totalEarnings = (leads || [])
    .filter((l) => l.stage === 'win' && l.earnings != null)
    .reduce((sum, l) => sum + l.earnings, 0);

  return (
    <div className="stats-page">
      <div className="stats-summary">
        <div className="summary-card">
          <span className="summary-value">{total}</span>
          <span className="summary-label">Wszystkie leady</span>
        </div>
        <div className="summary-card accent">
          <span className="summary-value">{activeCount}</span>
          <span className="summary-label">W trakcie</span>
        </div>
        <div className="summary-card win">
          <span className="summary-value">{winCount}</span>
          <span className="summary-label">Win</span>
        </div>
        <div className="summary-card lost">
          <span className="summary-value">{lostCount}</span>
          <span className="summary-label">Lost</span>
        </div>
        {totalEarnings > 0 && (
          <div className="summary-card earnings">
            <span className="summary-value">
              {totalEarnings.toLocaleString('pl-PL', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="summary-label">Zarobek (PLN)</span>
          </div>
        )}
      </div>

      <section className="stats-section">
        <h2>Leady na stage</h2>
        <div className="stats-chart">
          {stats.map(({ stage, label, count }) => {
            const color = STAGE_MAP[stage]?.color || 'var(--accent)';
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div key={stage} className="chart-row">
                <div className="chart-row-header">
                  <span className="chart-label">{label}</span>
                  <span className="chart-meta">
                    <strong>{count}</strong>
                    {total > 0 && (
                      <span className="chart-pct"> ({pct}%)</span>
                    )}
                  </span>
                </div>
                <div className="chart-track">
                  <div
                    className="chart-fill"
                    style={{
                      width: `${barWidth}%`,
                      background: color,
                      boxShadow: count > 0 ? `0 0 12px ${color}55` : 'none',
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="stats-section">
        <h2>Podgląd kart</h2>
        <div className="stats-grid">
          {stats.map(({ stage, label, count }) => (
            <div
              key={stage}
              className={`stat-card${stage === 'win' ? ' win' : ''}${stage === 'lost' ? ' lost' : ''}`}
              style={{
                '--stage-color': STAGE_MAP[stage]?.color || 'var(--accent)',
              }}
            >
              <span className="stat-card-count">{count}</span>
              <span className="stat-card-label">{label}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
