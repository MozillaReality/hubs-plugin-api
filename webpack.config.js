const path = require("path");
const HubsDevServer = require("./server/HubsDevServer");

module.exports = async (env, args) => {
  const port = args.port || 8080;
  const hubsDevServer = new HubsDevServer({ port });

  await hubsDevServer.init();
  const https = await hubsDevServer.createHTTPSConfig();
  
  return {
    entry: {
      ...hubsDevServer.pluginEntries
    },
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
            'style-loader',
            {
              loader: 'css-loader',
              options: {
                modules: true
              }
            }
          ]
        }
      ]
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].plugin.js",
      library: "HubsPlugin[name]",
      libraryTarget: "umd",
      sourceMapFilename: "[name].plugin.js.map"
    },
    devServer: {
      port,
      https,
      contentBase: path.join(__dirname, "dist"),
      before: (app) => {
        hubsDevServer.setupMiddleware(app);
      }
    },
    devtool: args.mode === "production" ? "source-map" : "eval-source-map",
    externals: {
      react: "React",
      "react-dom": "ReactDOM",
      "react-intl": "ReactIntl",
      "prop-types": "PropTypes",
      "classnames": "ClassNames",
      hubs: "Hubs"
    }
  };
};