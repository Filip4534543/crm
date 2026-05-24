process.env.NETLIFY = 'true';

const serverless = require('serverless-http');
const { app } = require('../../server/app');

const sls = serverless(app);

/** Naprawia ścieżkę z przekierowania Netlify przed Express */
module.exports.handler = async (event, context) => {
  if (event.path) {
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
  return sls(event, context);
};
