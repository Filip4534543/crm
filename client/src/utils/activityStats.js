const DAY_MS = 24 * 60 * 60 * 1000;

/** Statystyki liczone od tej daty (włącznie). */
export const ACTIVITY_STATS_START = '2026-06-07';

const MEETING_BOOKED_STAGES = new Set(['meeting_booked_new']);
// "Analyzed" = left not_qualified (move or delete)
const ANALYZED_FROM = 'not_qualified';

function pad(value) {
  return String(value).padStart(2, '0');
}

function parseStageTimestamp(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(' ', 'T');
  const withZone =
    /(?:Z|[+-]\d{2}:\d{2})$/.test(normalized) ? normalized : `${normalized}Z`;
  const date = new Date(withZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDayKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function fromDayKey(dayKey) {
  const [year, month, day] = String(dayKey)
    .split('-')
    .map((part) => Number(part));
  return new Date(year, (month || 1) - 1, day || 1);
}

export function shiftDayKey(dayKey, diff) {
  const date = fromDayKey(dayKey);
  date.setDate(date.getDate() + diff);
  return toDayKey(date);
}

export function clampDayKey(dayKey, minDayKey, maxDayKey) {
  if (!dayKey) return minDayKey;
  if (dayKey < minDayKey) return minDayKey;
  if (dayKey > maxDayKey) return maxDayKey;
  return dayKey;
}

export function formatDayLabel(dayKey, options = {}) {
  return new Intl.DateTimeFormat('pl-PL', options).format(fromDayKey(dayKey));
}

function isPipelineLead(lead) {
  const p = lead.pipeline || '';
  return p === 'pipeline' || p === 'new';
}

/**
 * Pipeline analytics (analyzed, qualified, contacted, meetingBooked)
 * from leads with pipeline === 'pipeline' (also accepts legacy 'new').
 *
 * Analyzed = left not_qualified (stage move) OR deleted while in not_qualified.
 * Contacted = any stage change except moves to "qualified" and
 *             not_qualified → lost (discard without contact).
 */
export function buildNewPipelineStats(leads = [], deletedLeads = []) {
  const pipelineLeads = leads.filter(isPipelineLead);

  const analyzed = new Set();
  const qualified = new Set();
  const contacted = new Set();
  const meetingBooked = new Set();

  const buckets = new Map();

  function getBucket(dayKey) {
    if (!buckets.has(dayKey)) {
      buckets.set(dayKey, {
        analyzed: new Set(),
        qualified: new Set(),
        contacted: new Set(),
        meetingBooked: new Set(),
      });
    }
    return buckets.get(dayKey);
  }

  function markAnalyzed(id, dayKey) {
    analyzed.add(id);
    getBucket(dayKey).analyzed.add(id);
  }

  for (const lead of pipelineLeads) {
    for (const entry of lead.history || []) {
      const createdAt = parseStageTimestamp(entry.created_at);
      if (!createdAt) continue;
      const dayKey = toDayKey(createdAt);
      if (dayKey < ACTIVITY_STATS_START) continue;

      const bucket = getBucket(dayKey);

      // Analyzed: left not_qualified
      if (
        entry.from_stage === ANALYZED_FROM &&
        entry.to_stage &&
        entry.to_stage !== ANALYZED_FROM
      ) {
        markAnalyzed(lead.id, dayKey);
      }

      // Qualified
      if (entry.to_stage === 'qualified') {
        qualified.add(lead.id);
        bucket.qualified.add(lead.id);
      }

      // Contacted: every stage change except moves to qualified /
      // not_for_this_service and not_qualified → lost (discard, not a contact)
      const isNqToLost =
        entry.from_stage === ANALYZED_FROM && entry.to_stage === 'lost';
      if (
        entry.from_stage != null &&
        entry.to_stage &&
        entry.from_stage !== entry.to_stage &&
        entry.to_stage !== 'qualified' &&
        entry.to_stage !== 'not_for_this_service' &&
        !isNqToLost
      ) {
        contacted.add(lead.id);
        bucket.contacted.add(lead.id);
      }

      // Meeting booked
      if (entry.to_stage && MEETING_BOOKED_STAGES.has(entry.to_stage)) {
        meetingBooked.add(lead.id);
        bucket.meetingBooked.add(lead.id);
      }
    }
  }

  // Deletion from not_qualified counts as analyzed
  for (const lead of deletedLeads) {
    if (!isPipelineLead(lead)) continue;
    if (lead.stage !== ANALYZED_FROM) continue;
    const deletedAt = parseStageTimestamp(lead.deleted_at);
    if (!deletedAt) continue;
    const dayKey = toDayKey(deletedAt);
    if (dayKey < ACTIVITY_STATS_START) continue;
    const id = `deleted:${lead.deleted_id ?? lead.id ?? lead.original_id}`;
    markAnalyzed(id, dayKey);
  }

  const todayKey = toDayKey(new Date());
  const metricDayKeys = Array.from(buckets.keys()).sort();

  const minDayKey =
    metricDayKeys.length > 0
      ? metricDayKeys[0]
      : todayKey >= ACTIVITY_STATS_START
        ? todayKey
        : ACTIVITY_STATS_START;
  const maxDayKey =
    metricDayKeys.length > 0
      ? metricDayKeys[metricDayKeys.length - 1] > todayKey
        ? metricDayKeys[metricDayKeys.length - 1]
        : todayKey
      : todayKey;

  const rangeStart = minDayKey >= ACTIVITY_STATS_START ? minDayKey : ACTIVITY_STATS_START;
  const totalDays =
    Math.round((fromDayKey(maxDayKey).getTime() - fromDayKey(rangeStart).getTime()) / DAY_MS) + 1;

  const timeline = [];
  for (let index = 0; index < totalDays; index += 1) {
    const dayKey = shiftDayKey(rangeStart, index);
    const bucket = buckets.get(dayKey) || {
      analyzed: new Set(),
      qualified: new Set(),
      contacted: new Set(),
      meetingBooked: new Set(),
    };
    timeline.push({
      dayKey,
      analyzed: bucket.analyzed.size,
      qualified: bucket.qualified.size,
      contacted: bucket.contacted.size,
      meetingBooked: bucket.meetingBooked.size,
    });
  }

  return {
    total: pipelineLeads.length,
    analyzed: analyzed.size,
    qualified: qualified.size,
    contacted: contacted.size,
    meetingBooked: meetingBooked.size,
    timeline,
    minDayKey: rangeStart,
    maxDayKey,
    hasActivity: metricDayKeys.length > 0,
  };
}
