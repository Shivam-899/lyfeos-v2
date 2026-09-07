const dotenv = require('dotenv');

// Load .env.local first (higher priority for local dev/testing), then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

module.exports = ({ config }) => {
  const appEnv = process.env.APP_ENV || 'development';
  const isProduction = appEnv === 'production';

  // Clone base plugins from app.json
  const plugins = [...(config.plugins || [])];

  if (isProduction) {
    const metaAppId = process.env.META_APP_ID;
    const metaClientToken = process.env.META_CLIENT_TOKEN;

    if (metaAppId && metaClientToken) {
      plugins.push([
        'react-native-fbsdk-next',
        {
          appID: metaAppId,
          clientToken: metaClientToken,
          displayName: 'LyfeOS',
          scheme: `fb${metaAppId}`,
          advertiserIDCollectionEnabled: true,
          autoLogAppEventsEnabled: true,
          isAutoInitEnabled: true,
        },
      ]);

      // Ensure Facebook proguard rules are included for production builds
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
    } else {
      console.warn(
        '[app.config.js] Warning: APP_ENV is "production" but META_APP_ID or META_CLIENT_TOKEN is not defined in environment variables.'
      );
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
