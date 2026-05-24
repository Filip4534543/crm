function useBlobStore() {
  if (process.env.CRM_STORAGE === 'sqlite') return false;
  if (process.env.CRM_STORAGE === 'blobs') return true;
  return Boolean(
    process.env.NETLIFY === 'true' ||
      process.env.NETLIFY === '1' ||
      process.env.AWS_LAMBDA_FUNCTION_NAME
  );
}

module.exports = useBlobStore() ? require('./blobs') : require('./sqlite');
