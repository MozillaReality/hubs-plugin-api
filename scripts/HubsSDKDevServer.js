const path = require("path");
const serveStatic = require("serve-static");
const cors = require("cors");
const request = require("request");
const selfsigned = require("selfsigned");
const fs = require("fs");
const promisify = require("util").promisify;
const generateSelfsignedAsync = promisify(selfsigned.generate);
const TOML = require("@iarna/toml");
const fetch = require("node-fetch");
const express = require("express");
const https = require("https");

async function createHTTPSConfig(certsPath) {
  const privKeyPath = path.join(certsPath, "key.pem");
  const pubKeyPath = path.join(certsPath, "cert.pem");

  if (fs.existsSync(certsPath)) {
    const key = await fs.promises.readFile(privKeyPath);
    const cert = await fs.promises.readFile(pubKeyPath);

    return { key, cert };
  }

  const pems = await generateSelfsignedAsync(
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
            }
          ]
        }
      ]
    }
  );

  await fs.promises.mkdir(certsPath, { recursive: true });
  await fs.promises.writeFile(pubKeyPath, pems.cert);
  await fs.promises.writeFile(privKeyPath, pems.private);

  return {
    key: pems.private,
    cert: pems.cert
  };
}

async function createDefaultConfig(hubsPath, port) {
  const schemaPath = path.join(hubsPath, "schema.toml");
  const schemaString = (await fs.promises.readFile(schemaPath)).toString();

  let appConfigSchema;

  try {
    appConfigSchema = await TOML.parse.async(schemaString);
  } catch (e) {
    console.error("Error parsing schema.toml on line " + e.line + ", column " + e.column + ": " + e.message);
    throw e;
  }

  const appConfig = {};

  for (const [categoryName, category] of Object.entries(appConfigSchema)) {
    appConfig[categoryName] = {};

    // Enable all features with a boolean type
    if (categoryName === "features") {
      for (const [key, schema] of Object.entries(category)) {
        if (key === "require_account_for_join" || key === "disable_room_creation") {
          appConfig[categoryName][key] = false;
        } else {
          appConfig[categoryName][key] = schema.type === "boolean" ? true : null;
        }
      }
    }
  }

  appConfig.translations = {
    en: {
      "app-name": "Hubs",
      "editor-name": "Spoke"
    }
  };

  const env = {
    HUBS_SERVER:`localhost:${port}`,
    RETICULUM_SERVER: "dev.reticulum.io",
    SHORTLINK_DOMAIN: "hubs.link",
    CORS_PROXY_SERVER: `localhost:${port}/cors-proxy`,
    THUMBNAIL_SERVER: "nearspark-dev.reticulum.io",
    NON_CORS_PROXY_DOMAINS: "localhost",
    IS_MOZ: "false"
  };

  return { appConfig, env };
}

async function loadRemoteConfig(credentialsPath, port) {
  const { host, token } = JSON.parse(await fs.promises.readFile(credentialsPath));

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  // Load the Hubs Cloud instance's app config in development
  const appConfigsResponse = await fetch(`https://${host}/api/v1/app_configs`, { headers });

  if (!appConfigsResponse.ok) {
    throw new Error(`Error fetching Hubs Cloud config "${appConfigsResponse.statusText}"`);
  }

  const appConfig = await appConfigsResponse.json();

  const hubsConfigsResponse = await fetch(`https://${host}/api/ita/configs/hubs`, { headers });

  const hubsConfigs = await hubsConfigsResponse.json();

  if (!hubsConfigsResponse.ok) {
    throw new Error(`Error fetching Hubs Cloud config "${hubsConfigsResponse.statusText}"`);
  }

  const { shortlink_domain, thumbnail_server } = hubsConfigs.general;

  const env = {
    HUBS_SERVER:`localhost:${port}`,
    IS_MOZ: "false",
    RETICULUM_SERVER: host,
    SHORTLINK_DOMAIN: shortlink_domain,
    CORS_PROXY_SERVER: `localhost:${port}/cors-proxy`,
    THUMBNAIL_SERVER: thumbnail_server,
    NON_CORS_PROXY_DOMAINS: "localhost"
  };

  return { appConfig, env };
}

class HubsSDKDevServer {
  constructor(options) {
    const projectPath = options.projectPath || process.cwd();

    this.options = Object.assign({
      port: 8081,
      appConfig: undefined,
      projectPath,
      hubsCacheDir: path.join(projectPath, ".hubs"),
      hubsPath: path.join(projectPath, "node_modules", "hubs-client", "dist"),
      spokePath: path.join(projectPath, "node_modules", "spoke-client", "dist"),
    }, options);
  }

  async init() {
    const credentialsPath = path.join(this.options.hubsCacheDir, ".hubs-cloud-credentials");

    let config;

    if (fs.existsSync(credentialsPath)) {
      config = await loadRemoteConfig(credentialsPath, this.options.port);
    } else {
      config = await createDefaultConfig(this.options.hubsPath, this.options.port);
    }

    config.appConfig.pluginManifests = ["/plugin-manifest.json"];

    const { appConfig, env } = config;

    const metaTags = [];

    for (let key in env) {
      metaTags.push(`<meta name="env:${key.toLowerCase()}" content="${env[key]}">`);
    }

    const metaTagHeader = metaTags.join("\n");

    const appConfigheader = `<script>window.APP_CONFIG = JSON.parse('${JSON.stringify(appConfig)}');</script>`;

    const translations = appConfig.translations.en;

    const spokeHeader = `
      ${metaTagHeader}
      <meta name="env:base_assets_path" content="https://localhost:${this.options.port}/spoke/">
      <title>${translations["editor-name"]}</title>
      ${appConfigheader}`;

    const hubsHeader = `
      ${metaTagHeader}
      <meta name="env:base_assets_path" content="https://localhost:${this.options.port}/">
      <title>${translations["app-name"]}</title>
      ${appConfigheader}`;

    const app = this.app = express();

    app.use(cors());

    app.use((req, res, next) => {
      if (req.method === "HEAD") {
        res.append("Date", new Date().toGMTString());
      }
      next();
    });

    app.all("/cors-proxy/*", (req, res) => {
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.header("Access-Control-Allow-Headers", "Range");
      res.header(
        "Access-Control-Expose-Headers",
        "Accept-Ranges, Content-Encoding, Content-Length, Content-Range, Hub-Name, Hub-Entity-Type"
      );
      res.header("Vary", "Origin");
      res.header("X-Content-Type-Options", "nosniff");
  
      const redirectLocation = req.header("location");
  
      if (redirectLocation) {
        res.header("Location", `https://localhost:${this.options.port}/cors-proxy/` + redirectLocation);
      }
  
      if (req.method === "OPTIONS") {
        res.send();
      } else {
        const url = req.path.replace("/cors-proxy/", "");
        request({ url, method: req.method }, error => {
          if (error) {
            console.error(`cors-proxy: error fetching "${url}"\n`, error);
            return;
          }
        }).pipe(res);
      }
    });

    const pageHandler = (filePath, header) => async (req, res) => {
      const data = await fs.promises.readFile(filePath);
      let html = data.toString();
      html = html.replace("<!-- DO NOT REMOVE/EDIT THIS COMMENT - META_TAGS -->", header);
      res.send(html);
    };

    if (this.options.spokePath) {
      const spokePageHandler = pageHandler(path.join(this.options.spokePath, "index.html"), spokeHeader);
      app.get("/spoke/?", spokePageHandler);
      app.use("/spoke", serveStatic(this.options.spokePath));
      app.use("/spoke/*", (req, res, next) => {
        if ((req.method === "GET" || req.method === "HEAD") && req.accepts("html")) {
          return spokePageHandler(req, res);
        } else {
          return next();
        }
      });
    }

    if (this.options.hubsPath) {
      const addHubHeaders = (type) => (req, res, next) => {
        res.header("hub-name", appConfig.translations.en["app-name"]);
        res.header("hub-entity-type", type);
        next();
      };

      app.get("/", addHubHeaders("hub"), pageHandler(path.join(this.options.hubsPath, "index.html"), hubsHeader));
      app.get("/whats-new", pageHandler(path.join(this.options.hubsPath, "whats-new.html"), hubsHeader));
      app.get("/signin", pageHandler(path.join(this.options.hubsPath, "signin.html"), hubsHeader));
      app.get("/verify", pageHandler(path.join(this.options.hubsPath, "verify.html"), hubsHeader));
      app.get("/cloud", pageHandler(path.join(this.options.hubsPath, "cloud.html"), hubsHeader));
      app.get("/discord", pageHandler(path.join(this.options.hubsPath, "discord.html"), hubsHeader));
      app.get("/link/?*", pageHandler(path.join(this.options.hubsPath, "link.html"), hubsHeader));
      app.get("/scene/?*", addHubHeaders("scene"), pageHandler(path.join(this.options.hubsPath, "scene.html"), hubsHeader));
      app.get("/avatar/?*", addHubHeaders("avatar"), pageHandler(path.join(this.options.hubsPath, "avatar.html"), hubsHeader));
      app.use(serveStatic(this.options.hubsPath));

      const hubPageHandler = pageHandler(path.join(this.options.hubsPath, "hub.html"), hubsHeader);
      app.get("/hub.html*", addHubHeaders("room"), hubPageHandler);
      app.get(/^\/([a-zA-Z0-9]{7})$/, addHubHeaders("room"), hubPageHandler);
      app.get(/^\/([a-zA-Z0-9]{7}\/.*)/, addHubHeaders("room"), hubPageHandler);
    }
  }

  async listen(...args) {
    const certsPath = path.join(this.options.hubsCacheDir, "certs");
    const httpsConfig = await createHTTPSConfig(certsPath);
    const server = https.createServer(httpsConfig, this.app);
    server.listen(...args);
  }
}

module.exports = HubsSDKDevServer;