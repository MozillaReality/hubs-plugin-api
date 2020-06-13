const path = require("path");
const HubsWebpackPlugin = require("./HubsSDKWebpackPlugin");

module.exports = (hubsConfigPath, _env, args) => {
  const { name, version, hooks } = require(hubsConfigPath);
  const projectPath = path.dirname(hubsConfigPath);

  const hubsPluginConfig = {
    name,
    version,
    hooks: {}
  };

  const entry = {};

  for (const hookName in hooks) {
    const pluginHooks = [];

    for (const file of hooks[hookName]) {
      const { name: entryPointName } = path.parse(file);
      entry[entryPointName] = path.resolve(projectPath, file);
      pluginHooks.push(entryPointName);
    }

    hubsPluginConfig.hooks[hookName] = pluginHooks;
  }

  return {
    mode: args && args.mode,
    entry,
    module: {
      rules: [
        {
          test: /\.(js)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader"
          }
        },
        {
          test: /\.css$/i,
          use: [
            "style-loader",
            {
              loader: "css-loader",
              options: {
                modules: true
              }
            }
          ]
        }
      ]
    },
    output: {
      path: path.resolve(projectPath, "dist"),
      filename: "[name].plugin.js",
      publicPath: "/" + name
    },
    devtool: args && args.mode === "production" ? "source-map" : "eval-source-map",
    plugins: [new HubsWebpackPlugin(hubsPluginConfig)]
  };
};
