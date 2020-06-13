const { ExternalsPlugin } = require("webpack");
const { RawSource } = require("webpack-sources");

const HUBS_NAMESPACE = "@hubs/";

function camelCaseDash(string) {
  return string.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function defaultRequestToExternal(request) {
  switch (request) {
    case "three":
      return "THREE";
    case "react":
      return "React";
    case "react-dom":
      return "ReactDOM";
    case "react-intl":
      return "ReactIntl";
    case "prop-types":
      return "PropTypes";
    case "classnames":
      return "ClassNames";
  }

  if (request.startsWith(HUBS_NAMESPACE)) {
    return ["Hubs", camelCaseDash(request.substring(HUBS_NAMESPACE.length))];
  }
}

class HubsWebpackPlugin {
  constructor(config) {
    this.config = config;
    this.externalizedDeps = new Set();
    this.externalsPlugin = new ExternalsPlugin("window", this.externalizeHubsDeps.bind(this));
  }

  externalizeHubsDeps(_context, request, callback) {
    const externalRequest = defaultRequestToExternal(request);

    if (externalRequest) {
      this.externalizedDeps.add(request);
      return callback(null, externalRequest);
    }

    return callback();
  }

  apply(compiler) {
    this.externalsPlugin.apply(compiler);

    const outputFilename = compiler.options.output.filename;
    const config = this.config;

    compiler.hooks.emit.tap(this.constructor.name, compilation => {
      const hooks = {};

      for (const hookName in this.config.hooks) {
        hooks[hookName] = [];
      }

      for (const [entryPointName, entryPoint] of compilation.entrypoints.entries()) {
        for (const chunk of entryPoint.chunks) {
          const entryDependencies = new Set();

          for (const { userRequest } of chunk.modulesIterable) {
            if (this.externalizedDeps.has(userRequest)) {
              entryDependencies.add(userRequest);
            }
          }

          const dependencies = Array.from(entryDependencies);

          const url = compilation.getPath(outputFilename, {
            chunk
          });

          for (const hookName in config.hooks) {
            for (const hookEntryPointName of config.hooks[hookName]) {
              if (hookEntryPointName === entryPointName) {
                hooks[hookName].push({
                  type: "js",
                  url,
                  dependencies
                });
              }
            }
          }
        }
      }

      const pluginManifest = {
        name: this.config.name,
        version: this.config.version,
        hooks
      };

      compilation.assets["plugin-manifest.json"] = new RawSource(JSON.stringify(pluginManifest));
    });
  }
}

module.exports = HubsWebpackPlugin;
