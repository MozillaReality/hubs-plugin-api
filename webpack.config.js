const path = require("path");
const HubsDevServer = require("./HubsDevServer");

module.exports = async (env, args) => {
  const hubsDevServer = new HubsDevServer();
  await hubsDevServer.init();
  const https = await hubsDevServer.createHTTPSConfig();
  
  return {
    entry: {
      index: "./pages/index.js"
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].plugin.js",
      library: "HUBS_PLUGIN",
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
      three: "THREE"
    }
  };
};
