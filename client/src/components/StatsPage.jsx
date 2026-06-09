import { useEffect, useMemo, useState } from 'react';
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
    key: 'contacts',
    label: 'Kontakty',
    shortLabel: 'Kontakty',
    color: '#60a5fa',
  },
  {
    key: 'meetingsBooked',
    label: 'Umówione spotkania',
    shortLabel: 'Umów. spotk.',
    color: '#d946ef',
  },
  {
    key: 'interestedInDemo',
    label: 'Demo chętni',
    shortLabel: 'Demo chętni',
    color: '#e879f9',
  },
  {
    key: 'demoSent',
    label: 'Demo wysłane',
    shortLabel: 'Demo wysłane',
    color: '#f472b6',
  },
  {
    key: 'meetingsToday',
    label: 'Spotkania dziś',
    shortLabel: 'Spotk. dziś',
    color: '#34d399',
    manual: true,
  },
];

const GOALS_KEY = 'filips-crm-daily-goals-v2';

const DEFAULT_GOALS = {
  contacts: 5,
  meetingsBooked: 2,
  interestedInDemo: 2,
  demoSent: 2,
  meetingsToday: 2,
  callMinutes: 90,
};

function getDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatSeconds(totalSeconds) {
  const safe = Math.max(0, Number(totalSeconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;
}

function loadGoals() {
  try {
    const raw = localStorage.getItem(GOALS_KEY);
    if (!raw) return { ...DEFAULT_GOALS };
    return { ...DEFAULT_GOALS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_GOALS };
  }
}

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

export default function StatsPage({
  stats,
  leads,
  activityStats,
  callSecondsToday = 0,
  callTimerRunning = false,
  onToggleCallTimer,
  meetingsToday = 0,
  onAdjustMeetingsToday,
  nextContactStats,
}) {
  const [rangeKey, setRangeKey] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [goals, setGoals] = useState(loadGoals);
  const todayKey = getDayKey();
  const callMinutesToday = Math.floor(callSecondsToday / 60);

  useEffect(() => {
    try {
      localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
    } catch {
      /* ignore */
    }
  }, [goals]);

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
      contacts: totals.contacts + item.contacts,
      meetingsBooked: totals.meetingsBooked + item.meetingsBooked,
      interestedInDemo: totals.interestedInDemo + item.interestedInDemo,
      demoSent: totals.demoSent + item.demoSent,
      meetingsToday: totals.meetingsToday + item.meetingsToday,
    }),
    { contacts: 0, meetingsBooked: 0, interestedInDemo: 0, demoSent: 0, meetingsToday: 0 }
  );

  const hasRangeActivity = filteredTimeline.some(
    (item) =>
      item.contacts ||
      item.meetingsBooked ||
      item.interestedInDemo ||
      item.demoSent ||
      item.meetingsToday
  );
  const goalProgress = [
    {
      key: 'contacts',
      label: 'Kontakty',
      done: activityStats?.today?.contacts ?? 0,
      goal: Number(goals.contacts || 0),
    },
    {
      key: 'meetingsBooked',
      label: 'Umówione spotkania',
      done: activityStats?.today?.meetingsBooked ?? 0,
      goal: Number(goals.meetingsBooked || 0),
    },
    {
      key: 'interestedInDemo',
      label: 'Demo chętni',
      done: activityStats?.today?.interestedInDemo ?? 0,
      goal: Number(goals.interestedInDemo || 0),
    },
    {
      key: 'demoSent',
      label: 'Demo wysłane',
      done: activityStats?.today?.demoSent ?? 0,
      goal: Number(goals.demoSent || 0),
    },
    {
      key: 'meetingsToday',
      label: 'Spotkania dziś',
      done: meetingsToday,
      goal: Number(goals.meetingsToday || 0),
      manual: true,
    },
    {
      key: 'callMinutes',
      label: 'Call time (min)',
      done: callMinutesToday,
      goal: Number(goals.callMinutes || 0),
    },
  ];

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
        <div className="summary-card accent">
          <span className="summary-value">{nextContactStats?.planned ?? 0}</span>
          <span className="summary-label">Kolejny kontakt (ustawione)</span>
        </div>
        <div className="summary-card lost">
          <span className="summary-value">{nextContactStats?.overdue ?? 0}</span>
          <span className="summary-label">Kolejny kontakt po terminie</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">{nextContactStats?.dueToday ?? 0}</span>
          <span className="summary-label">Kolejny kontakt dziś</span>
        </div>
        <div className="summary-card">
          <span className="summary-value">{nextContactStats?.dueFuture ?? 0}</span>
          <span className="summary-label">Kolejny kontakt w przyszłości</span>
        </div>
      </div>

      <section className="stats-section">
        <div className="stats-section-head">
          <div>
            <h2>Cele dzienne ({todayKey})</h2>
            <p className="stats-section-copy">
              Ustaw swoje targety i od razu sprawdzaj, czy cel dnia został zrealizowany.
            </p>
          </div>
        </div>
        <div className="goals-grid">
          {goalProgress.map((item) => {
            const done = item.done >= item.goal && item.goal > 0;
            return (
              <div key={item.key} className={`goal-card${done ? ' done' : ''}`}>
                <label>{item.label}</label>
                <input
                  type="number"
                  min="0"
                  value={goals[item.key]}
                  onChange={(event) =>
                    setGoals((prev) => ({
                      ...prev,
                      [item.key]: Math.max(0, Number(event.target.value || 0)),
                    }))
                  }
                />
                <p>
                  {item.done}/{item.goal}{' '}
                  <strong>{done ? 'Cel zrealizowany' : 'W trakcie'}</strong>
                </p>
                {item.manual && (
                  <div className="manual-counter">
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => onAdjustMeetingsToday?.(-1)}
                      disabled={meetingsToday <= 0}
                    >
                      −
                    </button>
                    <strong>{meetingsToday}</strong>
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() => onAdjustMeetingsToday?.(1)}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="stats-section">
        <div className="stats-section-head">
          <div>
            <h2>Timer rozmów</h2>
            <p className="stats-section-copy">
              Mierzy łączny czas dzwonienia w bieżącym dniu.
            </p>
          </div>
        </div>
        <div className="call-timer-card">
          <strong>{formatSeconds(callSecondsToday)}</strong>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onToggleCallTimer?.()}
          >
            {callTimerRunning ? 'Zatrzymaj timer' : 'Start timer'}
          </button>
        </div>
      </section>

      <section className="stats-section">
        <div className="stats-section-head">
          <div>
            <h2>Aktywność dzisiaj</h2>
            <p className="stats-section-copy">
              Kontakty, umówione spotkania i demo liczone automatycznie (max 1
              na leada dziennie). Spotkania dziś dodajesz ręcznie.
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
                {metric.manual
                  ? meetingsToday
                  : activityStats?.today?.[metric.key] ?? 0}
              </span>
              <span className="activity-mini-label">{metric.label}</span>
              {metric.manual && (
                <div className="manual-counter compact">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => onAdjustMeetingsToday?.(-1)}
                    disabled={meetingsToday <= 0}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => onAdjustMeetingsToday?.(1)}
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="stats-section">
        <div className="stats-section-head">
          <div>
            <h2>Trend aktywności</h2>
            <p className="stats-section-copy">
              Historia kontaktów, umówionych spotkań, demo i ręcznie dodanych
              spotkań dziennych.
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
