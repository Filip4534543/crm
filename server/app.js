require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET =
  process.env.JWT_SECRET || 'filips-crm-local-secret-change-me';
const LOGIN_PASSWORD = process.env.LOGIN_PASSWORD || 'Neo2552';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';
const PUBLIC_URL =
  process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://filipscrm.netlify.app';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

/* Netlify: ścieżka bywa auth/login lub api/auth/login — normalizuj do /api/... */
if (process.env.NETLIFY) {
  app.use((req, res, next) => {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    let path = req.url.split('?')[0];
    if (!path.startsWith('/')) path = `/${path}`;
    if (!path.startsWith('/api/') && path !== '/api') {
      path = `/api${path}`;
    }
    req.url = path + query;
    next();
  });
}

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

app.get('/api/webhook/test', (req, res) => {
  res.json({
    ok: true,
    service: "Filip's CRM",
    host: PUBLIC_URL,
    message: 'Serwer działa — webhook testowy dostępny',
    secretRequired: Boolean(WEBHOOK_SECRET),
    storage: process.env.NETLIFY ? 'netlify-blobs' : 'sqlite',
    webhooks: {
      test: `${PUBLIC_URL}/api/webhook/test`,
      leads: `${PUBLIC_URL}/api/webhook/leads`,
      tasks: `${PUBLIC_URL}/api/webhook/tasks`,
    },
    time: new Date().toISOString(),
  });
});

app.post('/api/webhook/test', (req, res) => {
  if (!checkWebhookSecret(req, res)) return;
  res.json({
    ok: true,
    message: 'Test webhook OK — połączenie i autoryzacja działają',
    host: PUBLIC_URL,
    received: req.body ?? null,
    secretHeaderPresent: Boolean(req.headers['x-webhook-secret']),
    time: new Date().toISOString(),
  });
});

app.post('/api/webhook/tasks', async (req, res) => {
  if (!checkWebhookSecret(req, res)) return;
  try {
    const task = await db.insertTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/webhook/leads', async (req, res) => {
  if (!checkWebhookSecret(req, res)) return;
  const body = req.body;
  const items = Array.isArray(body) ? body : body?.leads ? body.leads : [body];
  try {
    const created = [];
    for (const item of items) {
      created.push(await db.insertLead(item));
    }
    res.status(201).json({ created: created.length, leads: created });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/leads', authMiddleware, async (req, res) => {
  res.json(await db.getAllLeads());
});

app.get('/api/leads/:id', authMiddleware, async (req, res) => {
  const lead = await db.getLeadById(Number(req.params.id));
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});

app.patch('/api/leads/:id/stage', authMiddleware, async (req, res) => {
  const { stage, description, agreed_sum } = req.body;
  try {
    const lead = await db.updateLeadStage(
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

app.patch('/api/leads/:id', authMiddleware, async (req, res) => {
  const lead = await db.updateLeadFields(Number(req.params.id), req.body);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  res.json(lead);
});

app.delete('/api/leads/:id', authMiddleware, async (req, res) => {
  const ok = await db.deleteLead(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.delete(
  '/api/leads/stage/not_contacted_yet',
  authMiddleware,
  async (req, res) => {
    try {
      res.json(await db.deleteAllLeadsInStage('not_contacted_yet'));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.post(
  '/api/leads/stage/not_contacted_yet/dedupe',
  authMiddleware,
  async (req, res) => {
    try {
      res.json(await db.deleteDuplicateLeadsInStage('not_contacted_yet'));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

app.get('/api/stats', authMiddleware, async (req, res) => {
  res.json(await db.getStageCounts());
});

app.get('/api/tasks', authMiddleware, async (req, res) => {
  res.json(await db.getAllTasks());
});

app.post('/api/tasks', authMiddleware, async (req, res) => {
  try {
    const task = await db.insertTask(req.body);
    res.status(201).json(task);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', authMiddleware, async (req, res) => {
  const task = await db.updateTask(Number(req.params.id), req.body);
  if (!task) return res.status(404).json({ error: 'Not found' });
  res.json(task);
});

app.delete('/api/tasks/:id', authMiddleware, async (req, res) => {
  const ok = await db.deleteTask(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

module.exports = { app, PUBLIC_URL };
