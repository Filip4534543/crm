process.env.NETLIFY = 'true';

const serverless = require('serverless-http');
const { connectLambda } = require('@netlify/blobs');
const { app } = require('../../server/app');

const sls = serverless(app);

function fixEventPath(event) {
  if (!event.path) return;
  let path = event.path;
  if (!path.startsWith('/')) path = `/${path}`;
  if (path.startsWith('/.netlify/functions/api')) {
    path = path.replace('/.netlify/functions/api', '') || '/';
  }
  if (!path.startsWith('/api/') && path !== '/api') {
    path = `/api${path}`;
  }
  event.path = path;
  if (event.rawUrl) {
    event.rawUrl = path + (event.rawQuery ? `?${event.rawQuery}` : '');
  }
}

/** Netlify Blobs w trybie Lambda (serverless-http) wymaga connectLambda */
function setupBlobs(event) {
  if (event?.blobs) {
    connectLambda(event);
  }
}

module.exports.handler = async (event, context) => {
  fixEventPath(event);
  setupBlobs(event);
  return sls(event, context);
};
