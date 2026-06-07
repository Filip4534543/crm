export const STAGES = [
  { id: 'not_contacted_yet', label: 'Not contacted yet', color: '#6366f1' },
  { id: 'gatekeeper_1', label: 'Gatekeeper 1', color: '#7c3aed' },
  { id: 'gatekeeper_2', label: 'Gatekeeper 2', color: '#9333ea' },
  { id: 'missed_call_1', label: 'Missed call 1', color: '#8b5cf6' },
  { id: 'missed_call_2', label: 'Missed call 2', color: '#a855f7' },
  { id: 'meeting_booked', label: 'Meeting booked', color: '#d946ef' },
  { id: 'after_meeting', label: 'After meeting', color: '#ec4899' },
  { id: 'written_message_send', label: 'Written message send', color: '#f43f5e' },
  { id: 'contact_later', label: 'Contact later', color: '#f97316' },
  { id: 'in_process', label: 'In process', color: '#eab308' },
  { id: 'win', label: 'Win', color: '#22c55e' },
  { id: 'lost', label: 'Lost', color: '#64748b' },
];

export const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.id, s]));

export const PIPELINES = {
  inbox: { id: 'inbox', label: 'Nowe leady' },
  websites: { id: 'websites', label: 'Websites' },
  seo: { id: 'seo', label: 'SEO' },
};

export const ASSIGNABLE_PIPELINES = ['websites', 'seo'];
