const dotenv = require('dotenv');

// Load .env.local first (higher priority for local dev/testing), then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV || 'development';
  const isProduction = appEnv === 'production';

  // Clone base plugins from app.json
  const plugins = [...(config.plugins || [])];

  const metaAppId = process.env.META_APP_ID || '1369488158633446';
  const metaClientToken = process.env.META_CLIENT_TOKEN || 'baa4ccd5f7520f7b478c91e706c11ba4';

  const fbPluginIndex = plugins.findIndex(
    (p) => (Array.isArray(p) ? p[0] : p) === 'react-native-fbsdk-next'
  );

  const fbConfig = {
    appID: metaAppId,
    clientToken: metaClientToken,
    displayName: 'LyfeOS',
    scheme: `fb${metaAppId}`,
    advertiserIDCollectionEnabled: true,
    autoLogAppEventsEnabled: true,
    isAutoInitEnabled: true,
  };

  if (fbPluginIndex !== -1) {
    plugins[fbPluginIndex] = ['react-native-fbsdk-next', fbConfig];
  } else {
    plugins.push(['react-native-fbsdk-next', fbConfig]);
  }

  // Ensure Facebook proguard rules are included
  const buildPropsIndex = plugins.findIndex(
    (p) => Array.isArray(p) && p[0] === 'expo-build-properties'
  );
  if (buildPropsIndex !== -1) {
    const buildPropsPlugin = plugins[buildPropsIndex];
    const existingConfig = buildPropsPlugin[1] || {};
    const androidConfig = existingConfig.android || {};
    const existingRules = androidConfig.extraProguardRules || '';
    const fbRules =
      '\n-keep class com.facebook.** { *; }\n-dontwarn com.facebook.**';
    if (!existingRules.includes('com.facebook.**')) {
      plugins[buildPropsIndex] = [
        'expo-build-properties',
        {
          ...existingConfig,
          android: {
            ...androidConfig,
            extraProguardRules: (existingRules + fbRules).trim(),
          },
        },
      ];
    }
  }

  return {
    ...config,
    extra: {
      ...config.extra,
      appEnv,
    },
    plugins,
  };
};
