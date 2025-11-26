const nativeWind = require("nativewind/babel");

module.exports = function (api) {
  api.cache(true);
  const nativeWindConfig = nativeWind(api);
  const nativeWindPlugins = nativeWindConfig?.plugins ?? [];
  const filteredPlugins = nativeWindPlugins.filter((plugin) => {
    const entry = Array.isArray(plugin) ? plugin[0] : plugin;
    if (typeof entry !== "string") {
      return true;
    }
    return entry !== "react-native-reanimated/plugin" && entry !== "react-native-worklets/plugin";
  });
  return {
    presets: ["babel-preset-expo"],
    plugins: [...filteredPlugins, require("react-native-reanimated/plugin")],
  };
};
