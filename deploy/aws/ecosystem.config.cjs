module.exports = {
  apps: [
    {
      name: 'yaans-lk-api',
      cwd: './backend',
      script: 'src/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        USE_EXTERNAL_MONGO: 'true'
      }
    }
  ]
};
