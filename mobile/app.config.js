const fs = require('node:fs');

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(fs.existsSync('./google-services.json')
      ? { googleServicesFile: './google-services.json' }
      : {}),
  },
});
