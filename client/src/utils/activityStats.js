const DAY_MS = 24 * 60 * 60 * 1000;

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
    firstContact: new Set(),
    interestedInDemo: new Set(),
    demoSent: new Set(),
  };
}

function countBucket(bucket) {
  return {
    firstContact: bucket.firstContact.size,
    interestedInDemo: bucket.interestedInDemo.size,
    demoSent: bucket.demoSent.size,
  };
}

export function buildActivityStats(leads = []) {
  const buckets = new Map();

  for (const lead of leads) {
    for (const entry of lead.history || []) {
      const createdAt = parseStageTimestamp(entry.created_at);
      if (!createdAt) continue;

      const dayKey = toDayKey(createdAt);
      let bucket = buckets.get(dayKey);
      if (!bucket) {
        bucket = createBucket();
        buckets.set(dayKey, bucket);
      }

      if (
        entry.from_stage === 'not_contacted_yet' &&
        entry.to_stage &&
        entry.to_stage !== 'not_contacted_yet'
      ) {
        bucket.firstContact.add(lead.id);
      }

      if (entry.to_stage === 'interested_in_demo') {
        bucket.interestedInDemo.add(lead.id);
      }

      if (entry.to_stage === 'demo_send') {
        bucket.demoSent.add(lead.id);
      }
    }
  }

  const todayKey = toDayKey(new Date());
  const metricDayKeys = Array.from(buckets.keys()).sort();
  const minDayKey = metricDayKeys[0] ?? todayKey;
  const maxDayKey = metricDayKeys.length
    ? metricDayKeys[metricDayKeys.length - 1] > todayKey
      ? metricDayKeys[metricDayKeys.length - 1]
      : todayKey
    : todayKey;

  const totalDays =
    Math.round((fromDayKey(maxDayKey).getTime() - fromDayKey(minDayKey).getTime()) / DAY_MS) + 1;

  const timeline = [];
  for (let index = 0; index < totalDays; index += 1) {
    const dayKey = shiftDayKey(minDayKey, index);
    const counts = countBucket(buckets.get(dayKey) || createBucket());
    timeline.push({
      dayKey,
      firstContact: counts.firstContact,
      interestedInDemo: counts.interestedInDemo,
      demoSent: counts.demoSent,
      total: counts.firstContact + counts.interestedInDemo + counts.demoSent,
    });
  }

  const today = timeline.find((item) => item.dayKey === todayKey) || {
    dayKey: todayKey,
    firstContact: 0,
    interestedInDemo: 0,
    demoSent: 0,
    total: 0,
  };

  return {
    today,
    timeline,
    minDayKey,
    maxDayKey,
    hasActivity: metricDayKeys.length > 0,
  };
}
