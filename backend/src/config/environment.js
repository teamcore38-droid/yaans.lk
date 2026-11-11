export function databaseName(env = process.env) {
  const name = env.MONGODB_DB_NAME || 'yaans_lk';
  if (env.APP_ENV === 'staging' && name !== 'yaans_staging_lk') throw new Error('Staging must use the isolated yaans_staging_lk database.');
  if (env.VERCEL_ENV === 'preview' && env.MAINTENANCE_READ_ONLY !== 'true' && (env.APP_ENV !== 'staging' || name !== 'yaans_staging_lk')) {
    throw new Error('Writable previews require the isolated staging environment.');
  }
  return name;
}
