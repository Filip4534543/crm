require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const {
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
} = require('./db');

const PORT = process.env.PORT || 3847;
const JWT_SECRET = process.env.JWT_SECRET || 'filips-crm-local-secret-change-me';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'Neo2552@';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password !== LOGIN_PASSWORD) {
    return res.status(401).json({ error: 'Nieprawidłowe hasło' });
  }
  const token = jwt.sign({ app: 'filips-crm' }, JWT_SECRET, { expiresIn: '30d' });
  res.json({ token });
});

app.get('/api/auth/check', authMiddleware, (req, res) => {
  res.json({ ok: true });
});

function checkWebhookSecret(req, res) {
  if (!WEBHOOK_SECRET) return true;
  const key = req.headers['x-webhook-secret'] || req.query.secret;
  if (key !== WEBHOOK_SECRET) {
    res.status(403).json({
      ok: false,
      error: 'Forbidden',
      hint: 'Ustaw nagłówek x-webhook-secret lub ?secret= w URL',
    });
    return false;
  }
  return true;
}

app.get('/api/webhook/test', (req, res) => {
  res.json({
    ok: true,
    service: "Filip's CRM",
    message: 'Serwer działa — webhook testowy dostępny',
    secretRequired: Boolean(WEBHOOK_SECRET),
    webhooks: {
      test: '/api/webhook/test',
      leads: '/api/webhook/leads',
      tasks: '/api/webhook/tasks',
    },
    time: new Date().toISOString(),
  });
});

app.post('/api/webhook/test', (req, res) => {
  if (!checkWebhookSecret(req, res)) return;
  res.json({
    ok: true,
    message: 'Test webhook OK — połączenie i autoryzacja działają',
    received: req.body ?? null,
    secretHeaderPresent: Boolean(req.headers['x-webhook-secret']),
    time: new Date().toISOString(),
  });
});

app.post('/api/webhook/tasks', (req, res) => {
  if (!checkWebhookSecret(req, res)) return;
  try {
    const task = insertTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/webhook/leads', (req, res) => {
  if (!checkWebhookSecret(req, res)) return;

  const body = req.body;
  const items = Array.isArray(body) ? body : body?.leads ? body.leads : [body];

  try {
    const created = items.map((item) => insertLead(item));
    res.status(201).json({ created: created.length, leads: created });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leads', authMiddleware, (req, res) => {
  res.json(getAllLeads());
});

app.get('/api/leads/:id', authMiddleware, (req, res) => {
  const lead = getLeadById(Number(req.params.id));
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});

app.patch('/api/leads/:id/stage', authMiddleware, (req, res) => {
  const { stage, description, agreed_sum } = req.body;
  try {
    const lead = updateLeadStage(
      Number(req.params.id),
      stage,
      description,
      agreed_sum
    );
    if (!lead) return res.status(404).json({ error: 'Not found' });
    res.json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/leads/:id', authMiddleware, (req, res) => {
  const lead = updateLeadFields(Number(req.params.id), req.body);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});

app.get('/api/stats', authMiddleware, (req, res) => {
  res.json(getStageCounts());
});

app.get('/api/tasks', authMiddleware, (req, res) => {
  res.json(getAllTasks());
});

app.post('/api/tasks', authMiddleware, (req, res) => {
  try {
    const task = insertTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', authMiddleware, (req, res) => {
  const task = updateTask(Number(req.params.id), req.body);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

app.delete('/api/tasks/:id', authMiddleware, (req, res) => {
  const ok = deleteTask(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).end();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Filip's CRM — http://localhost:${PORT}`);
  console.log(`Webhook n8n: POST http://localhost:${PORT}/api/webhook/leads`);
  console.log(`Tasks API: GET/POST http://localhost:${PORT}/api/tasks`);
  console.log(`Tasks webhook: POST http://localhost:${PORT}/api/webhook/tasks`);
  console.log(`Test webhook: GET/POST http://localhost:${PORT}/api/webhook/test`);
});
