const { getStore } = require('@netlify/blobs');
const {
  STAGES,
  STAGE_LABELS,
  PIPELINE_LABELS,
  ASSIGNABLE_PIPELINES,
} = require('../constants');
const { sortActiveTasks } = require('./sortTasks');
const {
  findBestDuplicateMatch,
  duplicateIdsToRemoveForStage,
  assertBulkStage,
} = require('./leadUtils');

const DATA_KEY = 'crm-main';

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function emptyData() {
  return {
    nextLeadId: 1,
    nextDeletedLeadId: 1,
    nextHistoryId: 1,
    nextTaskId: 1,
    leads: [],
    deleted_leads: [],
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

function migrateLeadPipelines(data) {
  let changed = false;
  for (const lead of data.leads || []) {
    if (!lead.pipeline) {
      lead.pipeline = 'websites';
      changed = true;
    }
    if (lead.pipeline === 'new' && lead.stage === 'not_contacted_yet') {
      lead.stage = 'not_qualified';
      changed = true;
    }
  }
  for (const row of data.deleted_leads || []) {
    if (!row.pipeline) {
      row.pipeline = 'websites';
      changed = true;
    }
    if (row.pipeline === 'new' && row.stage === 'not_contacted_yet') {
      row.stage = 'not_qualified';
      changed = true;
    }
  }
  return changed;
}

async function loadData() {
  const store = getStoreInstance();
  const raw = await store.get(DATA_KEY, { type: 'text' });
  if (!raw) return emptyData();
  try {
    const data = { ...emptyData(), ...JSON.parse(raw) };
    if (migrateLeadPipelines(data)) {
      await saveData(data);
    }
    return data;
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
    pipeline: row.pipeline || 'websites',
    pipeline_label: PIPELINE_LABELS[row.pipeline] || row.pipeline || 'Websites',
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

function mapDeletedLeadRow(row) {
  if (!row) return null;
  return {
    ...row,
    stage_label: STAGE_LABELS[row.stage] || row.stage,
  };
}

async function getDeletedLeads() {
  const data = await loadData();
  return (data.deleted_leads || [])
    .slice()
    .sort((a, b) => (a.deleted_at < b.deleted_at ? 1 : -1))
    .map(mapDeletedLeadRow);
}

async function getLeadById(id) {
  const data = await loadData();
  const row = data.leads.find((l) => l.id === id);
  return mapLeadRow(data, row);
}

async function getStageCounts(pipeline) {
  const data = await loadData();
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  for (const lead of data.leads) {
    if (pipeline) {
      if ((lead.pipeline || 'websites') !== pipeline) continue;
    } else if ((lead.pipeline || 'websites') === 'inbox') {
      continue;
    }
    if (counts[lead.stage] !== undefined) counts[lead.stage]++;
  }
  return STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    count: counts[stage],
  }));
}

function pickText(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function pickNumber(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function normalizeLeadInput(payload = {}) {
  const lead = {
    company_name: pickText(payload.company_name, payload.Company_Name),
    maps_url: pickText(payload.maps_url, payload.Maps_url),
    phone: pickText(payload.phone, payload.Phone),
    address: pickText(payload.address, payload.Adress, payload.Address),
    website: pickText(payload.website, payload.Website),
    rating: pickNumber(payload.rating, payload.Rating),
    rating_count: pickNumber(payload.rating_count, payload.Rating_count),
    processed: pickText(payload.processed, payload.Processed),
    contact_name: pickText(payload.contact_name, payload.Contact_Name),
    prospect_name: pickText(payload.prospect_name, payload.Prospect_Name),
    initial_description: pickText(
      payload.initial_description,
      payload.description,
      payload.note
    ),
  };

  if (!lead.company_name && !lead.prospect_name) {
    throw new Error('Podaj nazwę firmy lub prospecta');
  }

  return lead;
}

async function insertLead(payload, options = {}) {
  const data = await loadData();
  const ts = now();
  const leadInput = normalizeLeadInput(payload);
  const duplicate = findBestDuplicateMatch(
    leadInput,
    [
      { source: 'active', leads: data.leads || [] },
      { source: 'deleted', leads: data.deleted_leads || [] },
    ],
    {}
  );
  if (duplicate) {
    const sourceLabel = duplicate.source === 'deleted' ? 'usuniętym' : 'aktywnym';
    throw new Error(
      `Duplikat leada (dopasowanie: ${duplicate.matchedFields.join(', ')}) — rekord istnieje już w ${sourceLabel} leadzie #${duplicate.lead.id}`
    );
  }
  const initialDescription =
    leadInput.initial_description ||
    (options.source === 'manual' ? 'Lead dodany ręcznie' : 'Nowy lead z n8n');
  const pipeline =
    options.pipeline || (options.source === 'manual' ? 'websites' : 'inbox');
  const lead = {
    id: data.nextLeadId++,
    company_name: leadInput.company_name,
    maps_url: leadInput.maps_url,
    phone: leadInput.phone,
    address: leadInput.address,
    website: leadInput.website,
    rating: leadInput.rating,
    rating_count: leadInput.rating_count,
    processed: leadInput.processed,
    contact_name: leadInput.contact_name,
    prospect_name: leadInput.prospect_name,
    stage: 'not_contacted_yet',
    pipeline,
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
    description: initialDescription,
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

function entryStageForPipeline(pipeline) {
  return pipeline === 'new' ? 'not_qualified' : 'not_contacted_yet';
}

async function assignLeadToPipeline(id, targetPipeline) {
  if (!ASSIGNABLE_PIPELINES.includes(targetPipeline)) {
    throw new Error('Invalid pipeline');
  }
  const data = await loadData();
  const lead = data.leads.find((l) => l.id === id);
  if (!lead) return null;
  if (lead.pipeline !== 'inbox') {
    throw new Error('Przenosienie dozwolone tylko z zakładki Nowe leady');
  }

  const fromStage = lead.stage;
  const label = PIPELINE_LABELS[targetPipeline] || targetPipeline;
  const entryStage = entryStageForPipeline(targetPipeline);
  lead.pipeline = targetPipeline;
  lead.stage = entryStage;
  lead.updated_at = now();

  data.history.push({
    id: data.nextHistoryId++,
    lead_id: id,
    from_stage: fromStage,
    to_stage: entryStage,
    description: `Przeniesiono do pipeline ${label}`,
    created_at: now(),
  });

  await saveData(data);
  return getLeadById(id);
}

async function assignAllInboxToPipeline(targetPipeline) {
  if (!ASSIGNABLE_PIPELINES.includes(targetPipeline)) {
    throw new Error('Invalid pipeline');
  }
  const data = await loadData();
  const ids = data.leads
    .filter((l) => (l.pipeline || 'websites') === 'inbox')
    .map((l) => l.id);
  let moved = 0;
  for (const id of ids) {
    const lead = data.leads.find((l) => l.id === id);
    if (!lead || lead.pipeline !== 'inbox') continue;
    const fromStage = lead.stage;
    const label = PIPELINE_LABELS[targetPipeline] || targetPipeline;
    const entryStage = entryStageForPipeline(targetPipeline);
    lead.pipeline = targetPipeline;
    lead.stage = entryStage;
    lead.updated_at = now();
    data.history.push({
      id: data.nextHistoryId++,
      lead_id: id,
      from_stage: fromStage,
      to_stage: entryStage,
      description: `Przeniesiono do pipeline ${label}`,
      created_at: now(),
    });
    moved++;
  }
  if (moved > 0) await saveData(data);
  return { moved, pipeline: targetPipeline };
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
  const active = sortActiveTasks(
    data.tasks.filter((t) => !t.done).map((t) => ({ ...t, done: false }))
  );
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

async function insertTask({ title, notes, due_date, lead_id }) {
  if (!title?.trim()) throw new Error('Title required');
  const data = await loadData();
  const ts = now();
  const task = {
    id: data.nextTaskId++,
    title: title.trim(),
    notes: notes?.trim() || null,
    due_date: due_date?.trim() || null,
    lead_id: lead_id != null ? Number(lead_id) : null,
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
  if (fields.due_date !== undefined) task.due_date = fields.due_date?.trim() || null;
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

async function deleteLead(id) {
  const data = await loadData();
  const deleted = deleteLeadIdsFromData(data, [id]);
  if (deleted === 0) return false;
  await saveData(data);
  return true;
}

function moveLeadsToDeletedFromData(data, ids) {
  const idSet = new Set(ids.map(Number));
  const rows = data.leads.filter((lead) => idSet.has(lead.id));
  if (!rows.length) return 0;
  const ts = now();
  for (const row of rows) {
    data.deleted_leads.push({
      ...row,
      deleted_id: data.nextDeletedLeadId++,
      original_id: row.id,
      deleted_at: ts,
    });
  }
  return rows.length;
}

function deleteLeadIdsFromData(data, ids) {
  const uniqueIds = [...new Set(ids.map(Number).filter(Number.isFinite))];
  if (!uniqueIds.length) return 0;
  const idSet = new Set(uniqueIds);
  const before = data.leads.length;
  moveLeadsToDeletedFromData(data, uniqueIds);
  data.leads = data.leads.filter((l) => !idSet.has(l.id));
  const deleted = before - data.leads.length;
  if (deleted === 0) return 0;
  data.history = data.history.filter((h) => !idSet.has(h.lead_id));
  data.tasks = data.tasks.filter((t) => !idSet.has(t.lead_id));
  return deleted;
}

async function deleteAllLeadsInStage(stage, pipeline = 'websites') {
  assertBulkStage(stage);
  const data = await loadData();
  const ids = data.leads
    .filter((l) => l.stage === stage && (l.pipeline || 'websites') === pipeline)
    .map((l) => l.id);
  const deleted = deleteLeadIdsFromData(data, ids);
  if (deleted > 0) await saveData(data);
  return { deleted, stage, pipeline };
}

async function deleteDuplicateLeadsInStage(stage, pipeline = 'websites') {
  assertBulkStage(stage);
  const data = await loadData();
  const leads = data.leads.filter(
    (l) => l.stage === stage && (l.pipeline || 'websites') === pipeline
  );
  const activeOutsideScope = data.leads.filter(
    (l) => l.stage !== stage || (l.pipeline || 'websites') !== pipeline
  );
  const ids = duplicateIdsToRemoveForStage({
    scopedLeads: leads,
    activeLeadsOutsideScope: activeOutsideScope,
    deletedLeads: data.deleted_leads || [],
  });
  const deleted = deleteLeadIdsFromData(data, ids);
  if (deleted > 0) await saveData(data);
  return { deleted, stage, pipeline, groupsAffected: ids.length };
}

async function restoreDeletedLead(deletedId) {
  const data = await loadData();
  const idx = (data.deleted_leads || []).findIndex((row) => row.deleted_id === Number(deletedId));
  if (idx === -1) return null;
  const row = data.deleted_leads[idx];
  const duplicate = findBestDuplicateMatch(
    row,
    [{ source: 'active', leads: data.leads || [] }],
    {}
  );
  if (duplicate) {
    throw new Error(
      `Nie można przywrócić: aktywny duplikat #${duplicate.lead.id} (${duplicate.matchedFields.join(', ')})`
    );
  }
  const ts = now();
  const restored = {
    id: data.nextLeadId++,
    company_name: row.company_name,
    maps_url: row.maps_url,
    phone: row.phone,
    address: row.address,
    website: row.website,
    rating: row.rating,
    rating_count: row.rating_count,
    processed: row.processed,
    contact_name: row.contact_name,
    prospect_name: row.prospect_name,
    stage: row.stage || 'not_contacted_yet',
    pipeline: row.pipeline || 'websites',
    agreed_sum: row.agreed_sum ?? null,
    earnings: row.earnings ?? null,
    created_at: row.created_at || ts,
    updated_at: ts,
  };
  data.leads.push(restored);
  data.history.push({
    id: data.nextHistoryId++,
    lead_id: restored.id,
    from_stage: null,
    to_stage: restored.stage,
    description: 'Przywrócono z kosza',
    created_at: ts,
  });
  data.deleted_leads.splice(idx, 1);
  await saveData(data);
  return getLeadById(restored.id);
}

async function deleteDeletedLead(deletedId) {
  const data = await loadData();
  const before = (data.deleted_leads || []).length;
  data.deleted_leads = (data.deleted_leads || []).filter(
    (row) => row.deleted_id !== Number(deletedId)
  );
  if (data.deleted_leads.length === before) return false;
  await saveData(data);
  return true;
}

module.exports = {
  getAllLeads,
  getLeadById,
  getDeletedLeads,
  getStageCounts,
  insertLead,
  updateLeadStage,
  assignLeadToPipeline,
  assignAllInboxToPipeline,
  updateLeadFields,
  getAllTasks,
  insertTask,
  updateTask,
  deleteTask,
  deleteLead,
  deleteAllLeadsInStage,
  deleteDuplicateLeadsInStage,
  restoreDeletedLead,
  deleteDeletedLead,
};
