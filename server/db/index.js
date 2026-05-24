const useNetlifyStore =
  process.env.NETLIFY === 'true' || process.env.NETLIFY === '1';

module.exports = useNetlifyStore
  ? require('./blobs')
  : require('./sqlite');
