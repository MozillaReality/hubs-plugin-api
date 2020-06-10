const path = require("path");
const HubsDevServer = require("./HubsDevServer");

module.exports = async (env, args) => {
  const hubsDevServer = new HubsDevServer();

  const globalVar = "MY_PLUGIN";

  hubsDevServer.registerPlugin("home-page", "js", "/index.plugin.js", { globalVar });

  await hubsDevServer.init();
  const https = await hubsDevServer.createHTTPSConfig();
  
  return {
    entry: {
      index: "./pages/index.js"
    },
    module: {
      rules: [
        {
          test: /\.(js)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader"
          }
        }
      ]
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].plugin.js",
      library: globalVar,
      libraryTarget: "umd"
    },
    devServer: {
      https,
      contentBase: path.join(__dirname, "dist"),
      before: (app) => {
        hubsDevServer.setupMiddleware(app);
      }
    },
    devtool: args.mode === "production" ? "source-map" : "eval-source-map",
    externals: {
      react: "React"
    }
  };
};
