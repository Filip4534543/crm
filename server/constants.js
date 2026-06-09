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
};

const PIPELINES = ['inbox', 'websites', 'seo'];

const PIPELINE_LABELS = {
  inbox: 'Nowe leady',
  websites: 'Websites',
  seo: 'SEO',
};

const ASSIGNABLE_PIPELINES = ['websites', 'seo'];

module.exports = {
  STAGES,
  STAGE_LABELS,
  PIPELINES,
  PIPELINE_LABELS,
  ASSIGNABLE_PIPELINES,
};
