const { getStore } = require('@netlify/blobs');
const { STAGES, STAGE_LABELS } = require('../constants');

const DATA_KEY = 'crm-main';

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function emptyData() {
  return {
    nextLeadId: 1,
    nextHistoryId: 1,
    nextTaskId: 1,
    leads: [],
    history: [],
    tasks: [],
  };
}

function getStoreInstance() {
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token =
    process.env.NETLIFY_BLOBS_TOKEN ||
    process.env.NETLIFY_AUTH_TOKEN;

  const opts = { name: 'filips-crm-data' };

  if (siteID && token) {
    return getStore({ ...opts, siteID, token });
  }

  return getStore(opts);
}

async function loadData() {
  const store = getStoreInstance();
  const raw = await store.get(DATA_KEY, { type: 'text' });
  if (!raw) return emptyData();
  try {
    return { ...emptyData(), ...JSON.parse(raw) };
  } catch {
    return emptyData();
  }
}

async function saveData(data) {
  const store = getStoreInstance();
  await store.set(DATA_KEY, JSON.stringify(data));
}

function mapLeadRow(data, row) {
  if (!row) return null;
  const history = data.history
    .filter((h) => h.lead_id === row.id)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  const lastDescription =
    history.find((h) => h.description)?.description ?? null;
  return {
    ...row,
    stage_label: STAGE_LABELS[row.stage] || row.stage,
    last_description: lastDescription,
    history,
  };
}

async function getAllLeads() {
  const data = await loadData();
  return data.leads
    .slice()
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .map((row) => mapLeadRow(data, row));
}

async function getLeadById(id) {
  const data = await loadData();
  const row = data.leads.find((l) => l.id === id);
  return mapLeadRow(data, row);
}

async function getStageCounts() {
  const data = await loadData();
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const lead of data.leads) {
    if (counts[lead.stage] !== undefined) counts[lead.stage]++;
  }
  return STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: counts[stage],
  }));
}

async function insertLead(payload) {
  const data = await loadData();
  const ts = now();
  const lead = {
    id: data.nextLeadId++,
    company_name: payload.company_name ?? payload.Company_Name ?? null,
    maps_url: payload.maps_url ?? payload.Maps_url ?? null,
    phone: payload.phone ?? payload.Phone ?? null,
    address: payload.address ?? payload.Adress ?? payload.Address ?? null,
    website: payload.website ?? payload.Website ?? null,
    rating: parseFloat(payload.rating ?? payload.Rating) || null,
    rating_count:
      parseInt(payload.rating_count ?? payload.Rating_count, 10) || null,
    processed: payload.processed ?? payload.Processed ?? null,
    contact_name: payload.contact_name ?? payload.Contact_Name ?? null,
    prospect_name: payload.prospect_name ?? payload.Prospect_Name ?? null,
    stage: 'not_contacted_yet',
    agreed_sum: null,
    earnings: null,
    created_at: ts,
    updated_at: ts,
  };
  data.leads.push(lead);
  data.history.push({
    id: data.nextHistoryId++,
    lead_id: lead.id,
    from_stage: null,
    to_stage: 'not_contacted_yet',
    description: 'Nowy lead z n8n',
    created_at: ts,
  });
  await saveData(data);
  return getLeadById(lead.id);
}

async function updateLeadStage(id, toStage, description, agreedSum) {
  const data = await loadData();
  const lead = data.leads.find((l) => l.id === id);
  if (!lead) return null;
  if (!STAGES.includes(toStage)) throw new Error('Invalid stage');

  const fromStage = lead.stage;
  lead.stage = toStage;
  lead.updated_at = now();

  if (agreedSum !== undefined && agreedSum !== null && agreedSum !== '') {
    lead.agreed_sum = parseFloat(agreedSum);
  }
  if (toStage === 'win' && lead.agreed_sum != null) {
    lead.earnings = lead.agreed_sum;
  }

  data.history.push({
    id: data.nextHistoryId++,
    lead_id: id,
    from_stage: fromStage,
    to_stage: toStage,
    description: description || null,
    created_at: now(),
  });

  await saveData(data);
  return getLeadById(id);
}

async function updateLeadFields(id, fields) {
  const data = await loadData();
  const lead = data.leads.find((l) => l.id === id);
  if (!lead) return null;
  const allowed = [
    'agreed_sum',
    'earnings',
    'contact_name',
    'prospect_name',
    'phone',
  ];
  let changed = false;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      lead[key] = fields[key];
      changed = true;
    }
  }
  if (!changed) return getLeadById(id);
  lead.updated_at = now();
  await saveData(data);
  return getLeadById(id);
}

async function getAllTasks() {
  const data = await loadData();
  const active = data.tasks
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        b.stack_position - a.stack_position || b.id - a.id
    )
    .map((t) => ({ ...t, done: false }));
  const done = data.tasks
    .filter((t) => t.done)
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    .map((t) => ({ ...t, done: true }));
  return { active, done };
}

function nextStackPosition(data) {
  const active = data.tasks.filter((t) => !t.done);
  if (!active.length) return 1;
  return Math.max(...active.map((t) => t.stack_position)) + 1;
}

async function insertTask({ title, notes }) {
  if (!title?.trim()) throw new Error('Title required');
  const data = await loadData();
  const ts = now();
  const task = {
    id: data.nextTaskId++,
    title: title.trim(),
    notes: notes?.trim() || null,
    stack_position: nextStackPosition(data),
    done: 0,
    created_at: ts,
    updated_at: ts,
  };
  data.tasks.push(task);
  await saveData(data);
  return getTaskById(task.id);
}

async function getTaskById(id) {
  const data = await loadData();
  const row = data.tasks.find((t) => t.id === id);
  if (!row) return null;
  return { ...row, done: Boolean(row.done) };
}

async function updateTask(id, fields) {
  const data = await loadData();
  const task = data.tasks.find((t) => t.id === id);
  if (!task) return null;

  if (fields.done !== undefined) {
    task.done = fields.done ? 1 : 0;
    if (!fields.done) task.stack_position = nextStackPosition(data);
    task.updated_at = now();
    await saveData(data);
    return getTaskById(id);
  }

  if (fields.title !== undefined) task.title = fields.title.trim();
  if (fields.notes !== undefined) task.notes = fields.notes?.trim() || null;
  task.updated_at = now();
  await saveData(data);
  return getTaskById(id);
}

async function deleteTask(id) {
  const data = await loadData();
  const before = data.tasks.length;
  data.tasks = data.tasks.filter((t) => t.id !== id);
  if (data.tasks.length === before) return false;
  await saveData(data);
  return true;
}

module.exports = {
  getAllLeads,
  getLeadById,
  getStageCounts,
  insertLead,
  updateLeadStage,
  updateLeadFields,
  getAllTasks,
  insertTask,
  updateTask,
  deleteTask,
};
