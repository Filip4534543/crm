/* Wymuś Blobs — build env nie zawsze trafia do runtime funkcji */
process.env.NETLIFY = 'true';

const serverless = require('serverless-http');
const { app } = require('../../server/app');

module.exports.handler = serverless(app, {
  basePath: '/',
});
