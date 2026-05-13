const path = require('path');

module.exports = {
  apps: [{
    name: 'xborder',
    script: 'api-server/dist/index.mjs',
    cwd: '/var/www/xborder',
    env_production: {
      DATABASE_URL: 'postgresql://xborder:xborder2024@127.0.0.1:5432/xborder',
      PORT: '5000',
      JWT_SECRET: 'xborder-jwt-secret-2024',
      NODE_ENV: 'production'
    },
    env_development: {
      DATABASE_URL: 'postgresql://postgres:xborder2024@localhost:5432/xborder',
      PORT: '5000',
      JWT_SECRET: 'xborder-jwt-secret-2024',
      NODE_ENV: 'development'
    }
  }]
};
