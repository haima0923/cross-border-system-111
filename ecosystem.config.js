module.exports = {
  apps: [{
    name: 'xborder',
    script: 'api-server/dist/index.mjs',
    cwd: process.env.XBORDER_CWD || '/var/www/xborder',
    env_production: {
      DATABASE_URL: process.env.DATABASE_URL,
      PORT: process.env.PORT || '5000',
      JWT_SECRET: process.env.JWT_SECRET,
      DEFAULT_OBJECT_STORAGE_BUCKET_ID: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID,
      UPLOAD_ROOT: process.env.UPLOAD_ROOT,
      NODE_ENV: 'production'
    },
    env_development: {
      DATABASE_URL: process.env.DATABASE_URL,
      PORT: process.env.PORT || '5000',
      JWT_SECRET: process.env.JWT_SECRET,
      DEFAULT_OBJECT_STORAGE_BUCKET_ID: process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID,
      UPLOAD_ROOT: process.env.UPLOAD_ROOT,
      NODE_ENV: 'development'
    }
  }]
};
