const STAGES = [
  'not_contacted_yet',
  'missed_call_1',
  'missed_call_2',
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
  missed_call_1: 'Missed call 1',
  missed_call_2: 'Missed call 2',
  interested_in_demo: 'Interested in demo',
  demo_send: 'Demo send',
  written_message_send: 'Written message send',
  contact_later: 'Contact later',
  in_process: 'In process',
  win: 'Win',
  lost: 'Lost',
};

module.exports = { STAGES, STAGE_LABELS };
