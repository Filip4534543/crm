const DAY_MS = 24 * 60 * 60 * 1000;

/** Statystyki liczone od tej daty (włącznie). */
export const ACTIVITY_STATS_START = '2026-06-07';

const MEETING_BOOKED_STAGES = new Set(['meeting_booked']);

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

function createBucket() {
  return {
    contacts: new Set(),
    meetingsBooked: new Set(),
    interestedInDemo: new Set(),
    demoSent: new Set(),
  };
}

function countBucket(bucket, meetingsToday = 0) {
  return {
    contacts: bucket.contacts.size,
    meetingsBooked: bucket.meetingsBooked.size,
    interestedInDemo: bucket.interestedInDemo.size,
    demoSent: bucket.demoSent.size,
    meetingsToday,
  };
}

export function buildActivityStats(leads = [], { meetingsTodayByDay = {} } = {}) {
  const buckets = new Map();

  for (const lead of leads) {
    for (const entry of lead.history || []) {
      const createdAt = parseStageTimestamp(entry.created_at);
      if (!createdAt) continue;

      const dayKey = toDayKey(createdAt);
      if (dayKey < ACTIVITY_STATS_START) continue;

      let bucket = buckets.get(dayKey);
      if (!bucket) {
        bucket = createBucket();
        buckets.set(dayKey, bucket);
      }

      if (
        entry.from_stage &&
        entry.to_stage &&
        entry.from_stage !== entry.to_stage
      ) {
        bucket.contacts.add(lead.id);
      }

      if (entry.to_stage && MEETING_BOOKED_STAGES.has(entry.to_stage)) {
        bucket.meetingsBooked.add(lead.id);
      }

      if (entry.to_stage === 'interested_in_demo') {
        bucket.interestedInDemo.add(lead.id);
      }

      if (entry.to_stage === 'demo_send') {
        bucket.demoSent.add(lead.id);
      }
    }
  }

  for (const dayKey of Object.keys(meetingsTodayByDay)) {
    if (dayKey < ACTIVITY_STATS_START) continue;
    if (!buckets.has(dayKey)) {
      buckets.set(dayKey, createBucket());
    }
  }

  const todayKey = toDayKey(new Date());
  const metricDayKeys = Array.from(
    new Set([...buckets.keys(), ...Object.keys(meetingsTodayByDay)])
  )
    .filter((dayKey) => dayKey >= ACTIVITY_STATS_START)
    .sort();

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
    const meetingsToday = Number(meetingsTodayByDay[dayKey] || 0);
    const counts = countBucket(buckets.get(dayKey) || createBucket(), meetingsToday);
    timeline.push({
      dayKey,
      contacts: counts.contacts,
      meetingsBooked: counts.meetingsBooked,
      interestedInDemo: counts.interestedInDemo,
      demoSent: counts.demoSent,
      meetingsToday: counts.meetingsToday,
      total:
        counts.contacts +
        counts.meetingsBooked +
        counts.interestedInDemo +
        counts.demoSent +
        counts.meetingsToday,
    });
  }

  const today = timeline.find((item) => item.dayKey === todayKey) || {
    dayKey: todayKey,
    contacts: 0,
    meetingsBooked: 0,
    interestedInDemo: 0,
    demoSent: 0,
    meetingsToday: Number(meetingsTodayByDay[todayKey] || 0),
    total: Number(meetingsTodayByDay[todayKey] || 0),
  };

  return {
    today,
    timeline,
    minDayKey: rangeStart,
    maxDayKey,
    hasActivity: metricDayKeys.length > 0,
  };
}
