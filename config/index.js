/* This file is a config, that exposes various
   meaningful values to the rest of the application.
   This is done using the module.exports function,
   which sets them when require('./thisfile') is run. */

module.exports = {
  service: {
      name: process.env.MAKI_SERVICE_NAME || 'decentral.fm'
    , namespace: process.env.MAKI_SERVICE_NAMESPACE || 'decentral.fm'
    , mission: process.env.MAKI_SERVICE_MISSION || 'decentralize _all_ the things.'
  },
  dns: {
    name: process.env.MAKI_DNS_NAME || 'decentral.fm'
  },
  services: {
    http: {
        port: process.env.MAKI_HTTP_PORT || 15005
      , host: process.env.MAKI_HTTP_HOST || 'localhost'
    },
    spdy: {
        host: process.env.MAKI_HTTP_HOST || 'localhost'
      , port: process.env.MAKI_SPDY_PORT || 9643
    }
  },
  database: {
    name: process.env.MAKI_DATABASE_NAME   || 'maki',
    masters: (process.env.MAKI_DATABASE_MASTERS)
      ? JSON.parse(process.env.MAKI_DATABASE_MASTERS)
      : [ 'localhost' ]
  },
  sessions: {
      enabled: process.env.MAKI_SESSIONS_ENABLE || true
    , secret:  process.env.MAKI_SESSIONS_SECRET || 'this can be any random string, you can even use this one. :)'
  },
  redis: {
      host: process.env.MAKI_REDIS_HOST || 'localhost'
    , port: process.env.MAKI_REDIS_PORT || 6379
  },
  sockets: {
      timeout: process.env.MAKI_SOCKETS_TIMEOUT || 30000
  },
  auth: {
    local: {
      enabled: true
    }
  },
  views: {
    plugins: {
      'moment': require('moment')
    },
    client: {
      render: process.env.MAKI_VIEWS_CLIENT_RENDER || false
    }
  }
};
