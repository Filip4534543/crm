const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { STAGES, STAGE_LABELS } = require('../constants');

const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'crm.db'));

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

function mapLeadRow(row) {
  if (!row) return null;
  const history = db
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
  return db
    .prepare('SELECT * FROM leads ORDER BY updated_at DESC')
    .all()
    .map(mapLeadRow);
}

function getLeadById(id) {
  return mapLeadRow(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
}

function getStageCounts() {
  const counts = Object.fromEntries(STAGES.map((s) => [s, 0]));
  const rows = db
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

function insertLead(data) {
  const result = db
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
      company_name: data.company_name ?? data.Company_Name ?? null,
      maps_url: data.maps_url ?? data.Maps_url ?? null,
      phone: data.phone ?? data.Phone ?? null,
      address: data.address ?? data.Adress ?? data.Address ?? null,
      website: data.website ?? data.Website ?? null,
      rating: parseFloat(data.rating ?? data.Rating) || null,
      rating_count:
        parseInt(data.rating_count ?? data.Rating_count, 10) || null,
      processed: data.processed ?? data.Processed ?? null,
      contact_name: data.contact_name ?? data.Contact_Name ?? null,
      prospect_name: data.prospect_name ?? data.Prospect_Name ?? null,
    });
  const leadId = result.lastInsertRowid;
  db.prepare(
    `INSERT INTO stage_history (lead_id, from_stage, to_stage, description)
     VALUES (?, NULL, 'not_contacted_yet', 'Nowy lead z n8n')`
  ).run(leadId);
  return getLeadById(leadId);
}

function updateLeadStage(id, toStage, description, agreedSum) {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id);
  if (!lead) return null;
  if (!STAGES.includes(toStage)) throw new Error('Invalid stage');

  const updates = { stage: toStage };
  if (agreedSum !== undefined && agreedSum !== null && agreedSum !== '') {
    updates.agreed_sum = parseFloat(agreedSum);
  }
  if (toStage === 'win' && lead.agreed_sum != null) {
    updates.earnings = lead.agreed_sum;
  }

  db.prepare(
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

  db.prepare(
    `INSERT INTO stage_history (lead_id, from_stage, to_stage, description)
     VALUES (?, ?, ?, ?)`
  ).run(id, lead.stage, toStage, description || null);

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
  db.prepare(`UPDATE leads SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getLeadById(id);
}

function getAllTasks() {
  const active = db
    .prepare(
      `SELECT * FROM tasks WHERE done = 0 ORDER BY stack_position DESC, id DESC`
    )
    .all()
    .map((t) => ({ ...t, done: Boolean(t.done) }));
  const done = db
    .prepare(`SELECT * FROM tasks WHERE done = 1 ORDER BY updated_at DESC`)
    .all()
    .map((t) => ({ ...t, done: Boolean(t.done) }));
  return { active, done };
}

function nextStackPosition() {
  const row = db
    .prepare('SELECT MAX(stack_position) as max FROM tasks WHERE done = 0')
    .get();
  return (row?.max ?? 0) + 1;
}

function insertTask({ title, notes }) {
  if (!title?.trim()) throw new Error('Title required');
  const pos = nextStackPosition();
  const result = db
    .prepare(
      `INSERT INTO tasks (title, notes, stack_position) VALUES (?, ?, ?)`
    )
    .run(title.trim(), notes?.trim() || null, pos);
  return getTaskById(result.lastInsertRowid);
}

function getTaskById(id) {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
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
    db.prepare(
      `UPDATE tasks SET done = ?, stack_position = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(done, stackPosition, id);
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
  if (sets.length === 0) return task;
  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getTaskById(id);
}

function deleteTask(id) {
  return db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;
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
};
