const STAGES = [
  'not_contacted_yet',
  'gatekeeper_1',
  'gatekeeper_2',
  'missed_call_1',
  'missed_call_2',
  'meeting_booked',
  'after_meeting',
  'interested_in_demo',
  'demo_send',
  'written_message_send',
  'contact_later',
  'in_process',
  'win',
  'lost',
  // New pipeline stages
  'not_qualified',
  'qualified',
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
  'won',
];

const STAGE_LABELS = {
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
  lost: 'Lost',
  // New pipeline
  not_qualified: 'Not Qualified',
  qualified: 'Qualified',
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
  won: 'Won',
};

const PIPELINES = ['inbox', 'websites', 'new'];

const PIPELINE_LABELS = {
  inbox: 'Nowe leady',
  websites: 'Websites',
  new: 'New',
};

const ASSIGNABLE_PIPELINES = ['websites', 'new'];

module.exports = {
  STAGES,
  STAGE_LABELS,
  PIPELINES,
  PIPELINE_LABELS,
  ASSIGNABLE_PIPELINES,
};
