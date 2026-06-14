module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      // MUST be listed last: react-native-reanimated/plugin
      "react-native-reanimated/plugin",
    ],
  };
};
