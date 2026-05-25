import { useMemo, useState } from 'react';
import { STAGE_MAP } from '../constants';
import {
  clampDayKey,
  formatDayLabel,
  shiftDayKey,
} from '../utils/activityStats';

const RANGE_PRESETS = [
  { key: '7', label: '7D', days: 7 },
  { key: '14', label: '14D', days: 14 },
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
  { key: 'all', label: 'Całość' },
];

const ACTIVITY_METRICS = [
  {
    key: 'firstContact',
    label: 'Pierwszy kontakt',
    shortLabel: '1. kontakt',
    color: '#60a5fa',
  },
  {
    key: 'interestedInDemo',
    label: 'Chętny na demo',
    shortLabel: 'Demo chętni',
    color: '#d946ef',
  },
  {
    key: 'demoSent',
    label: 'Demo wysłane',
    shortLabel: 'Demo wysłane',
    color: '#34d399',
  },
];

function buildLinePath(points) {
  return points.reduce(
    (path, point, index) =>
      `${path}${index === 0 ? 'M' : ' L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
    ''
  );
}

function ActivityChart({ timeline }) {
  const chartWidth = Math.max(700, timeline.length * 48);
  const chartHeight = 280;
  const padding = { top: 20, right: 18, bottom: 38, left: 40 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const maxValue = Math.max(
    ...timeline.flatMap((item) =>
      ACTIVITY_METRICS.map((metric) => item[metric.key] || 0)
    ),
    1
  );
  const yTicks = Array.from(
    new Set([0, 1, 2, 3, 4].map((step) => Math.round((maxValue * step) / 4)))
  ).sort((a, b) => a - b);
  const labelStep = Math.max(1, Math.ceil(timeline.length / 8));

  const metricLines = ACTIVITY_METRICS.map((metric) => {
    const points = timeline.map((item, index) => {
      const x =
        padding.left +
        (timeline.length === 1 ? plotWidth / 2 : (index / (timeline.length - 1)) * plotWidth);
      const y =
        padding.top +
        plotHeight -
        ((item[metric.key] || 0) / maxValue) * plotHeight;
      return { x, y, item };
    });

    return {
      ...metric,
      points,
      path: buildLinePath(points),
    };
  });

  return (
    <div className="activity-chart-scroll">
      <svg
        className="activity-chart-svg"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        role="img"
        aria-label="Wykres dziennej aktywności leadów"
      >
        {yTicks.map((tick) => {
          const y =
            padding.top + plotHeight - (tick / maxValue) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={chartWidth - padding.right}
                y2={y}
                className="activity-grid-line"
              />
              <text
                x={padding.left - 10}
                y={y + 4}
                textAnchor="end"
                className="activity-axis-label"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {timeline.map((item, index) => {
          if (index % labelStep !== 0 && index !== timeline.length - 1) return null;
          const x =
            padding.left +
            (timeline.length === 1 ? plotWidth / 2 : (index / (timeline.length - 1)) * plotWidth);
          return (
            <text
              key={item.dayKey}
              x={x}
              y={chartHeight - 12}
              textAnchor="middle"
              className="activity-axis-label"
            >
              {formatDayLabel(item.dayKey, { day: 'numeric', month: 'short' })}
            </text>
          );
        })}

        {metricLines.map((metric) => (
          <g key={metric.key}>
            <path
              d={metric.path}
              fill="none"
              stroke={metric.color}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {metric.points.map((point) => (
              <circle
                key={`${metric.key}-${point.item.dayKey}`}
                cx={point.x}
                cy={point.y}
                r="4.5"
                fill={metric.color}
                stroke="var(--surface)"
                strokeWidth="2"
              >
                <title>
                  {`${formatDayLabel(point.item.dayKey, {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
${metric.label}: ${point.item[metric.key] || 0}`}
                </title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default function StatsPage({ stats, leads, activityStats }) {
  const [rangeKey, setRangeKey] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const stageStats = stats || [];
  const total = stageStats.reduce((sum, s) => sum + s.count, 0);
  const maxCount = Math.max(...stageStats.map((s) => s.count), 1);
  const winCount = stageStats.find((s) => s.stage === 'win')?.count ?? 0;
  const lostCount = stageStats.find((s) => s.stage === 'lost')?.count ?? 0;
  const activeCount = total - winCount - lostCount;
  const totalEarnings = (leads || [])
    .filter((lead) => lead.stage === 'win' && lead.earnings != null)
    .reduce((sum, lead) => sum + lead.earnings, 0);
  const minDayKey = activityStats?.minDayKey || customStart || customEnd;
  const maxDayKey = activityStats?.maxDayKey || minDayKey;

  const resolvedRange = useMemo(() => {
    if (!minDayKey || !maxDayKey) return null;

    if (rangeKey === 'all') {
      return { start: minDayKey, end: maxDayKey };
    }

    if (rangeKey === 'custom') {
      let start = clampDayKey(customStart || minDayKey, minDayKey, maxDayKey);
      let end = clampDayKey(customEnd || maxDayKey, minDayKey, maxDayKey);
      if (start > end) [start, end] = [end, start];
      return { start, end };
    }

    const preset = RANGE_PRESETS.find((item) => item.key === rangeKey);
    if (!preset?.days) {
      return { start: minDayKey, end: maxDayKey };
    }

    return {
      start: clampDayKey(
        shiftDayKey(maxDayKey, -(preset.days - 1)),
        minDayKey,
        maxDayKey
      ),
      end: maxDayKey,
    };
  }, [customEnd, customStart, maxDayKey, minDayKey, rangeKey]);

  const filteredTimeline = useMemo(() => {
    if (!resolvedRange) return activityStats?.timeline || [];
    return (activityStats?.timeline || []).filter(
      (item) =>
        item.dayKey >= resolvedRange.start && item.dayKey <= resolvedRange.end
    );
  }, [activityStats?.timeline, resolvedRange]);

  const rangeTotals = filteredTimeline.reduce(
    (totals, item) => ({
      firstContact: totals.firstContact + item.firstContact,
      interestedInDemo: totals.interestedInDemo + item.interestedInDemo,
      demoSent: totals.demoSent + item.demoSent,
    }),
    { firstContact: 0, interestedInDemo: 0, demoSent: 0 }
  );

  const hasRangeActivity = filteredTimeline.some(
    (item) => item.firstContact || item.interestedInDemo || item.demoSent
  );

  if (!stageStats.length) {
    return (
      <div className="stats-page">
        <p className="stats-empty">Brak danych</p>
      </div>
    );
  }

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
        <div className="stats-section-head">
          <div>
            <h2>Aktywność dzisiaj</h2>
            <p className="stats-section-copy">
              Każdy lead liczy się maksymalnie raz dziennie w ramach danej
              metryki.
            </p>
          </div>
        </div>
        <div className="activity-today-grid">
          {ACTIVITY_METRICS.map((metric) => (
            <div
              key={metric.key}
              className="activity-mini-card"
              style={{ '--metric-color': metric.color }}
            >
              <span className="activity-mini-value">
                {activityStats?.today?.[metric.key] ?? 0}
              </span>
              <span className="activity-mini-label">{metric.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="stats-section">
        <div className="stats-section-head">
          <div>
            <h2>Trend aktywności</h2>
            <p className="stats-section-copy">
              Historia zmian stage dla pierwszego kontaktu, zainteresowania demo
              i wysłania demo.
            </p>
          </div>
        </div>

        <div className="activity-controls">
          <div className="activity-range-presets">
            {RANGE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={`range-pill${rangeKey === preset.key ? ' active' : ''}`}
                onClick={() => setRangeKey(preset.key)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="activity-range-inputs">
            <label className="range-input">
              <span>Od</span>
              <input
                type="date"
                min={minDayKey}
                max={maxDayKey}
                value={rangeKey === 'custom' ? customStart : resolvedRange?.start || ''}
                onChange={(event) => {
                  setRangeKey('custom');
                  setCustomStart(event.target.value);
                }}
              />
            </label>
            <label className="range-input">
              <span>Do</span>
              <input
                type="date"
                min={minDayKey}
                max={maxDayKey}
                value={rangeKey === 'custom' ? customEnd : resolvedRange?.end || ''}
                onChange={(event) => {
                  setRangeKey('custom');
                  setCustomEnd(event.target.value);
                }}
              />
            </label>
          </div>
        </div>

        <div className="activity-range-summary">
          {ACTIVITY_METRICS.map((metric) => (
            <div
              key={metric.key}
              className="activity-range-card"
              style={{ '--metric-color': metric.color }}
            >
              <span className="activity-range-card-label">{metric.shortLabel}</span>
              <strong>{rangeTotals[metric.key]}</strong>
            </div>
          ))}
        </div>

        <div className="activity-chart-card">
          <div className="activity-chart-head">
            <div>
              <strong>
                {resolvedRange
                  ? `${formatDayLabel(resolvedRange.start, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })} - ${formatDayLabel(resolvedRange.end, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}`
                  : 'Brak zakresu'}
              </strong>
              <span>
                {(filteredTimeline || []).length} dni w wybranym zakresie
              </span>
            </div>
            <div className="activity-legend">
              {ACTIVITY_METRICS.map((metric) => (
                <span key={metric.key} className="activity-legend-item">
                  <span
                    className="activity-legend-dot"
                    style={{ background: metric.color }}
                  />
                  {metric.label}
                </span>
              ))}
            </div>
          </div>

          {hasRangeActivity ? (
            <ActivityChart timeline={filteredTimeline} />
          ) : (
            <p className="activity-empty">
              W tym zakresie nie ma jeszcze ruchów dla tych metryk.
            </p>
          )}
        </div>
      </section>

      <section className="stats-section">
        <h2>Leady na stage</h2>
        <div className="stats-chart">
          {stageStats.map(({ stage, label, count }) => {
            const color = STAGE_MAP[stage]?.color || 'var(--accent)';
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

            return (
              <div key={stage} className="chart-row">
                <div className="chart-row-header">
                  <span className="chart-label">{label}</span>
                  <span className="chart-meta">
                    <strong>{count}</strong>
                    {total > 0 && <span className="chart-pct"> ({pct}%)</span>}
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
          {stageStats.map(({ stage, label, count }) => (
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
