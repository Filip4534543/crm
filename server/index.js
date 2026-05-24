const path = require('path');
const { app } = require('./app');

const PORT = process.env.PORT || 3847;

if (process.env.NODE_ENV === 'production' && !process.env.NETLIFY) {
  const express = require('express');
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).end();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Filip's CRM — http://localhost:${PORT}`);
    console.log(`Webhook: POST http://localhost:${PORT}/api/webhook/leads`);
  });
}
