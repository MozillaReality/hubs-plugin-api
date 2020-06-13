const path = require("path");
const HubsWebpackPlugin = require("./webpack/HubsWebpackPlugin");
const fs = require("fs");
const selfsigned = require("selfsigned");

function createHTTPSConfig() {
  // Generate certs for the local webpack-dev-server.
  if (fs.existsSync(path.join(__dirname, "certs"))) {
    const key = fs.readFileSync(path.join(__dirname, "certs", "key.pem"));
    const cert = fs.readFileSync(path.join(__dirname, "certs", "cert.pem"));

    return { key, cert };
  } else {
    const pems = selfsigned.generate(
      [
        {
          name: "commonName",
          value: "localhost"
        }
      ],
      {
        days: 365,
        keySize: 2048,
        algorithm: "sha256",
        extensions: [
          {
            name: "subjectAltName",
            altNames: [
              {
                type: 2,
                value: "localhost"
              },
              {
                type: 2,
                value: "hubs.local"
              }
            ]
          }
        ]
      }
    );

    fs.mkdirSync(path.join(__dirname, "certs"));
    fs.writeFileSync(path.join(__dirname, "certs", "cert.pem"), pems.cert);
    fs.writeFileSync(path.join(__dirname, "certs", "key.pem"), pems.private);

    return {
      key: pems.private,
      cert: pems.cert
    };
  }
}

const plugins = {
  "home-page": [
    {
      "type":"js",
      "url":"HomePage.plugin.js",
      "dependencies":["react","@hubs/home-page","react-intl","classnames","@hubs/media-browser","@hubs/react","@hubs/core"]
    }
  ]
};

module.exports = (env, args) => ({
  entry: {
    HomePage: "./pages/index.js"
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
    path: path.resolve(__dirname, "dist"),
    filename: "[name].plugin.js"
  },
  devServer: {
    hot: false,
    inline: false,
    https: createHTTPSConfig(),
    port: 8080,
    contentBase: path.join(__dirname, "dist"),
    headers: {
      "Access-Control-Allow-Origin": "*"
    },
    proxy: {
      "**": {
        target: 'https://localhost:8081',
        secure: false,
        ws: true,
        changeOrigin: true,
        selfHandleResponse: true,
        onProxyRes(proxyRes, _req, res) {
          let originalBody = Buffer.from("");
          
          proxyRes.on("data", (data) => {
            originalBody = Buffer.concat([originalBody, data]);
          });

          proxyRes.on("end", () => {
            let newBody = originalBody.toString();
            newBody = newBody.replace(
              "<!-- DO NOT REMOVE/EDIT THIS COMMENT - META_TAGS -->",
              `<!-- DO NOT REMOVE/EDIT THIS COMMENT - META_TAGS -->\n\n<script>window.APP_CONFIG = { ...window.APP_CONFIG, plugins: ${JSON.stringify(plugins)} }</script>`)
            res.end(newBody);
          });
        }
      }
    }
  },
  devtool: args.mode === "production" ? "source-map" : "eval-source-map",
  plugins: [
    new HubsWebpackPlugin({
      name: "my-plugin",
      version: "0.0.1",
      hooks: {
        "home-page": ["HomePage"]
      }
    })
  ]
});
