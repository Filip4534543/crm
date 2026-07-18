// Stages for the main pipeline board
export const PIPELINE_STAGES = [
  { id: 'not_qualified', label: 'Not Qualified', color: '#64748b' },
  { id: 'qualified', label: 'Qualified', color: '#6366f1' },
  { id: 'attempt_1', label: 'Attempt 1', color: '#7c3aed' },
  { id: 'attempt_2', label: 'Attempt 2', color: '#8b5cf6' },
  { id: 'attempt_3', label: 'Attempt 3', color: '#a855f7' },
  { id: 'missed_call_new_1', label: 'Missed Call 1', color: '#f97316' },
  { id: 'missed_call_new_2', label: 'Missed Call 2', color: '#f43f5e' },
  { id: 'gatekeeper_new_1', label: 'Gatekeeper 1', color: '#9333ea' },
  { id: 'gatekeeper_new_2', label: 'Gatekeeper 2', color: '#c026d3' },
  { id: 'meeting_booked_new', label: 'Meeting Booked', color: '#d946ef' },
  { id: 'after_meeting_new', label: 'After Meeting', color: '#ec4899' },
  { id: 'contact_later_new', label: 'Contact Later', color: '#f59e0b' },
  { id: 'in_progress', label: 'In progress', color: '#eab308' },
  { id: 'lost', label: 'Lost', color: '#374151' },
  { id: 'won', label: 'Won', color: '#22c55e' },
];

export const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.id, s]));

/** @deprecated Use PIPELINE_STAGES */
export const NEW_PIPELINE_STAGES = PIPELINE_STAGES;
/** @deprecated Use STAGE_MAP */
export const NEW_STAGE_MAP = STAGE_MAP;
export const ALL_STAGE_MAP = STAGE_MAP;

export const PIPELINES = {
  inbox: { id: 'inbox', label: 'Nowe leady' },
  pipeline: { id: 'pipeline', label: 'Pipeline' },
};

export const ASSIGNABLE_PIPELINES = ['pipeline'];
