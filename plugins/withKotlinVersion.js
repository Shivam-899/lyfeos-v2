const { withProjectBuildGradle, withGradleProperties } = require("expo/config-plugins");

const withKotlinVersion = (config, { kotlinVersion = "2.1.20" } = {}) => {
  config = withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => item.type !== "property" || item.key !== "android.kotlinVersion"
    );
    config.modResults.push({
      type: "property",
      key: "android.kotlinVersion",
      value: kotlinVersion,
    });
    return config;
  });

  config = withProjectBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      let contents = config.modResults.contents;

      // 1. Define ext.kotlinVersion at top of buildscript block
      if (!contents.includes("ext.kotlinVersion")) {
        contents = contents.replace(
          /buildscript\s*\{/,
          `buildscript {\n    ext.kotlinVersion = '${kotlinVersion}'`
        );
      } else {
        contents = contents.replace(
          /ext\.kotlinVersion\s*=\s*['"].*['"]/,
          `ext.kotlinVersion = '${kotlinVersion}'`
        );
      }

      // 2. Explicitly pin kotlin-gradle-plugin version
      contents = contents.replace(
        /classpath\(["']org\.jetbrains\.kotlin:kotlin-gradle-plugin.*["']\)/,
        `classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:${kotlinVersion}")`
      );

      config.modResults.contents = contents;
    }
    return config;
  });

  return config;
};

module.exports = withKotlinVersion;
