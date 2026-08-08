const STAGES = [
  'not_qualified',
  'qualified',
  'not_for_this_service',
  'attempt_1',
  'attempt_2',
  'attempt_3',
  'gatekeeper_new_1',
  'gatekeeper_new_2',
  'missed_call_new_1',
  'missed_call_new_2',
  'meeting_booked_new',
  'after_meeting_new',
  'contact_later_new',
  'in_progress',
  'lost',
  'won',
];

const STAGE_LABELS = {
  not_qualified: 'Not Qualified',
  qualified: 'Qualified',
  not_for_this_service: 'Not for this service',
  attempt_1: 'Attempt 1',
  attempt_2: 'Attempt 2',
  attempt_3: 'Attempt 3',
  gatekeeper_new_1: 'Gatekeeper 1',
  gatekeeper_new_2: 'Gatekeeper 2',
  missed_call_new_1: 'Missed Call 1',
  missed_call_new_2: 'Missed Call 2',
  meeting_booked_new: 'Meeting Booked',
  after_meeting_new: 'After Meeting',
  contact_later_new: 'Contact Later',
  in_progress: 'In progress',
  lost: 'Lost',
  won: 'Won',
  // Legacy labels (kept for any unmigrated history display)
  not_contacted_yet: 'Not contacted yet',
  gatekeeper_1: 'Gatekeeper 1',
  gatekeeper_2: 'Gatekeeper 2',
  missed_call_1: 'Missed call 1',
  missed_call_2: 'Missed call 2',
  meeting_booked: 'Meeting booked',
  after_meeting: 'After meeting',
  interested_in_demo: 'Interested in demo',
  demo_send: 'Demo send',
  written_message_send: 'Written message send',
  contact_later: 'Contact later',
  in_process: 'In process',
  win: 'Win',
};

/** Map old websites (and leftover) stage ids onto the unified pipeline. */
const WEBSITES_TO_PIPELINE_STAGES = {
  not_contacted_yet: 'not_qualified',
  gatekeeper_1: 'gatekeeper_new_1',
  gatekeeper_2: 'gatekeeper_new_2',
  missed_call_1: 'missed_call_new_1',
  missed_call_2: 'missed_call_new_2',
  meeting_booked: 'meeting_booked_new',
  after_meeting: 'after_meeting_new',
  interested_in_demo: 'in_progress',
  demo_send: 'in_progress',
  written_message_send: 'in_progress',
  contact_later: 'contact_later_new',
  in_process: 'in_progress',
  win: 'won',
};

function mapStageToPipeline(stage) {
  if (stage == null || stage === '') return stage;
  return WEBSITES_TO_PIPELINE_STAGES[stage] || stage;
}

const PIPELINES = ['inbox', 'pipeline'];

const PIPELINE_LABELS = {
  inbox: 'Nowe leady',
  pipeline: 'Pipeline',
};

const ASSIGNABLE_PIPELINES = ['pipeline'];

module.exports = {
  STAGES,
  STAGE_LABELS,
  WEBSITES_TO_PIPELINE_STAGES,
  mapStageToPipeline,
  PIPELINES,
  PIPELINE_LABELS,
  ASSIGNABLE_PIPELINES,
};
