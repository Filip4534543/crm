const path = require('path');
const fs = require('fs');
const { STAGES, STAGE_LABELS } = require('../constants');
const { sortActiveTasks } = require('./sortTasks');
const { BULK_STAGE, duplicateIdsToRemove, assertBulkStage } = require('./leadUtils');

let db;

function getDb() {
  if (db) return db;
  const Database = require('better-sqlite3');
  const dataDir = path.join(__dirname, '..', '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  db = new Database(path.join(dataDir, 'crm.db'));
  db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name TEXT,
    maps_url TEXT,
    phone TEXT,
    address TEXT,
    website TEXT,
    rating REAL,
    rating_count INTEGER,
    processed TEXT,
    contact_name TEXT,
    prospect_name TEXT,
    stage TEXT NOT NULL DEFAULT 'not_contacted_yet',
    agreed_sum REAL,
    earnings REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS stage_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id INTEGER NOT NULL,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    notes TEXT,
    stack_position INTEGER NOT NULL DEFAULT 0,
    done INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
  CREATE INDEX IF NOT EXISTS idx_history_lead ON stage_history(lead_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_stack ON tasks(done, stack_position);
`);
  migrateSchema(db);
  return db;
}

function migrateSchema(database) {
  const cols = database.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);
  if (!cols.includes('due_date')) {
    database.exec('ALTER TABLE tasks ADD COLUMN due_date TEXT');
  }
  if (!cols.includes('lead_id')) {
    database.exec('ALTER TABLE tasks ADD COLUMN lead_id INTEGER');
  }
}

function mapLeadRow(row) {
  if (!row) return null;
  const history = getDb()
    .prepare(
      `SELECT id, from_stage, to_stage, description, created_at
       FROM stage_history WHERE lead_id = ? ORDER BY created_at DESC`
    )
    .all(row.id);
  const lastDescription =
    history.find((h) => h.description)?.description ?? null;
  return {
    ...row,
    stage_label: STAGE_LABELS[row.stage] || row.stage,
    last_description: lastDescription,
    history,
  };
}

function getAllLeads() {
  return getDb()
    .prepare('SELECT * FROM leads ORDER BY updated_at DESC')
    .all()
    .map(mapLeadRow);
}

function getLeadById(id) {
  return mapLeadRow(getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id));
}

function getStageCounts() {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  const rows = getDb()
    .prepare('SELECT stage, COUNT(*) as count FROM leads GROUP BY stage')
    .all();
  for (const { stage, count } of rows) {
    if (counts[stage] !== undefined) counts[stage] = count;
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

function normalizeLeadInput(data = {}) {
  const lead = {
    company_name: pickText(data.company_name, data.Company_Name),
    maps_url: pickText(data.maps_url, data.Maps_url),
    phone: pickText(data.phone, data.Phone),
    address: pickText(data.address, data.Adress, data.Address),
    website: pickText(data.website, data.Website),
    rating: pickNumber(data.rating, data.Rating),
    rating_count: pickNumber(data.rating_count, data.Rating_count),
    processed: pickText(data.processed, data.Processed),
    contact_name: pickText(data.contact_name, data.Contact_Name),
    prospect_name: pickText(data.prospect_name, data.Prospect_Name),
    initial_description: pickText(
      data.initial_description,
      data.description,
      data.note
    ),
  };

  if (!lead.company_name && !lead.prospect_name) {
    throw new Error('Podaj nazwę firmy lub prospecta');
  }

  return lead;
}

function insertLead(data, options = {}) {
  const lead = normalizeLeadInput(data);
  const initialDescription =
    lead.initial_description ||
    (options.source === 'manual' ? 'Lead dodany ręcznie' : 'Nowy lead z n8n');
  const result = getDb()
    .prepare(
      `INSERT INTO leads (
      company_name, maps_url, phone, address, website,
      rating, rating_count, processed, contact_name, prospect_name, stage
    ) VALUES (
      @company_name, @maps_url, @phone, @address, @website,
      @rating, @rating_count, @processed, @contact_name, @prospect_name, 'not_contacted_yet'
    )`
    )
    .run({
      company_name: lead.company_name,
      maps_url: lead.maps_url,
      phone: lead.phone,
      address: lead.address,
      website: lead.website,
      rating: lead.rating,
      rating_count: lead.rating_count,
      processed: lead.processed,
      contact_name: lead.contact_name,
      prospect_name: lead.prospect_name,
    });
  const leadId = result.lastInsertRowid;
  getDb()
    .prepare(
      `INSERT INTO stage_history (lead_id, from_stage, to_stage, description)
     VALUES (?, NULL, 'not_contacted_yet', ?)`
    )
    .run(leadId, initialDescription);
  return getLeadById(leadId);
}

function updateLeadStage(id, toStage, description, agreedSum) {
  const lead = getDb().prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) return null;
  if (!STAGES.includes(toStage)) throw new Error('Invalid stage');

  const updates = { stage: toStage };
  if (agreedSum !== undefined && agreedSum !== null && agreedSum !== '') {
    updates.agreed_sum = parseFloat(agreedSum);
  }
  if (toStage === 'win' && lead.agreed_sum != null) {
    updates.earnings = lead.agreed_sum;
  }

  getDb()
    .prepare(
    `UPDATE leads SET stage = @stage,
     agreed_sum = COALESCE(@agreed_sum, agreed_sum),
     earnings = COALESCE(@earnings, earnings),
     updated_at = datetime('now')
     WHERE id = @id`
  ).run({
    id,
    stage: updates.stage,
    agreed_sum: updates.agreed_sum ?? null,
    earnings: updates.earnings ?? null,
  });

  getDb()
    .prepare(
      `INSERT INTO stage_history (lead_id, from_stage, to_stage, description)
     VALUES (?, ?, ?, ?)`
    )
    .run(id, lead.stage, toStage, description || null);

  return getLeadById(id);
}

function updateLeadFields(id, fields) {
  const allowed = [
    'agreed_sum',
    'earnings',
    'contact_name',
    'prospect_name',
    'phone',
  ];
  const sets = [];
  const params = { id };
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      sets.push(`${key} = @${key}`);
      params[key] = fields[key];
    }
  }
  if (sets.length === 0) return getLeadById(id);
  sets.push("updated_at = datetime('now')");
  getDb().prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getLeadById(id);
}

function getAllTasks() {
  const activeRows = getDb()
    .prepare('SELECT * FROM tasks WHERE done = 0')
    .all()
    .map((t) => ({ ...t, done: Boolean(t.done) }));
  const active = sortActiveTasks(activeRows);
  const done = getDb()
    .prepare(`SELECT * FROM tasks WHERE done = 1 ORDER BY updated_at DESC`)
    .all()
    .map((t) => ({ ...t, done: Boolean(t.done) }));
  return { active, done };
}

function nextStackPosition() {
  const row = getDb()
    .prepare('SELECT MAX(stack_position) as max FROM tasks WHERE done = 0')
    .get();
  return (row?.max ?? 0) + 1;
}

function insertTask({ title, notes, due_date, lead_id }) {
  if (!title?.trim()) throw new Error('Title required');
  const pos = nextStackPosition();
  const result = getDb()
    .prepare(
      `INSERT INTO tasks (title, notes, stack_position, due_date, lead_id) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      title.trim(),
      notes?.trim() || null,
      pos,
      due_date?.trim() || null,
      lead_id != null ? Number(lead_id) : null
    );
  return getTaskById(result.lastInsertRowid);
}

function getTaskById(id) {
  const row = getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  if (!row) return null;
  return { ...row, done: Boolean(row.done) };
}

function updateTask(id, fields) {
  const task = getTaskById(id);
  if (!task) return null;
  if (fields.done !== undefined) {
    const done = fields.done ? 1 : 0;
    let stackPosition = task.stack_position;
    if (done === 0) stackPosition = nextStackPosition();
    getDb()
      .prepare(
        `UPDATE tasks SET done = ?, stack_position = ?, updated_at = datetime('now') WHERE id = ?`
      )
      .run(done, stackPosition, id);
    return getTaskById(id);
  }
  const sets = [];
  const params = { id };
  if (fields.title !== undefined) {
    sets.push('title = @title');
    params.title = fields.title.trim();
  }
  if (fields.notes !== undefined) {
    sets.push('notes = @notes');
    params.notes = fields.notes?.trim() || null;
  }
  if (fields.due_date !== undefined) {
    sets.push('due_date = @due_date');
    params.due_date = fields.due_date?.trim() || null;
  }
  if (sets.length === 0) return task;
  sets.push("updated_at = datetime('now')");
  getDb().prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getTaskById(id);
}

function deleteTask(id) {
  return getDb().prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
}

function deleteLead(id) {
  return deleteLeadIds([id]) > 0;
}

function deleteLeadIds(ids) {
  const uniqueIds = [...new Set(ids.map(Number).filter(Number.isFinite))];
  if (!uniqueIds.length) return 0;
  const d = getDb();
  const placeholders = uniqueIds.map(() => '?').join(', ');
  return d.transaction((leadIds) => {
    d.prepare(`DELETE FROM tasks WHERE lead_id IN (${placeholders})`).run(...leadIds);
    d.prepare(`DELETE FROM stage_history WHERE lead_id IN (${placeholders})`).run(...leadIds);
    return d.prepare(`DELETE FROM leads WHERE id IN (${placeholders})`).run(...leadIds)
      .changes;
  })(uniqueIds);
}

function deleteAllLeadsInStage(stage) {
  assertBulkStage(stage);
  const ids = getDb()
    .prepare('SELECT id FROM leads WHERE stage = ?')
    .all(stage)
    .map((r) => r.id);
  const deleted = deleteLeadIds(ids);
  return { deleted, stage };
}

function deleteDuplicateLeadsInStage(stage) {
  assertBulkStage(stage);
  const leads = getDb().prepare('SELECT * FROM leads WHERE stage = ?').all(stage);
  const ids = duplicateIdsToRemove(leads);
  const deleted = deleteLeadIds(ids);
  return { deleted, stage, groupsAffected: ids.length };
}

const wrap =
  (fn) =>
  (...args) =>
    Promise.resolve(fn(...args));

module.exports = {
  getAllLeads: wrap(getAllLeads),
  getLeadById: wrap(getLeadById),
  getStageCounts: wrap(getStageCounts),
  insertLead: wrap(insertLead),
  updateLeadStage: wrap(updateLeadStage),
  updateLeadFields: wrap(updateLeadFields),
  getAllTasks: wrap(getAllTasks),
  insertTask: wrap(insertTask),
  updateTask: wrap(updateTask),
  deleteTask: wrap(deleteTask),
  deleteLead: wrap(deleteLead),
  deleteAllLeadsInStage: wrap(deleteAllLeadsInStage),
  deleteDuplicateLeadsInStage: wrap(deleteDuplicateLeadsInStage),
};
