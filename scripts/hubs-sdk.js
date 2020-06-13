const Commander = require("commander");
const chalk = require("chalk");
const webpack = require("webpack");
const hubsSDKWebpackConfig = require("./hubs-sdk-webpack-config");
const packageJson = require("../package.json");
const HubsSDKDevServer = require("./HubsSDKDevServer");
const path = require("path");
const webpackDevMiddleware = require("webpack-dev-middleware");
const webpackHotMiddleware = require("webpack-hot-middleware");
const promisify = require("util").promisify;
const rimraf = require("rimraf");
const rimrafAsync = promisify(rimraf);

const program = new Commander.Command("hubs-sdk")
  .version(packageJson.version);

program
  .command("serve [project-path]")
  .option("-p --port <port>", "The port to serve on.", 8080)
  .description("Serve the project for plugin development.")
  .action(async (projectPathArg, cmd) => {
    console.log(`Starting dev server at https://localhost:${cmd.port}`);

    const projectPath = resolveProjectPath(projectPathArg);
    const hubsConfigPath = path.resolve(projectPath, "hubs.config.js");
    const devServer = new HubsSDKDevServer({ port: cmd.port, projectPath });
    await devServer.init();
    const webpackConfig = hubsSDKWebpackConfig(hubsConfigPath, undefined, { mode: "development" });

    for (let entryName in webpackConfig.entry) {
      if (Array.isArray(webpackConfig.entry[entryName])) {
        webpackConfig.entry[entryName].push("webpack-hot-middleware/client?reload=true");
      } else {
        webpackConfig.entry[entryName] = [webpackConfig.entry[entryName], "webpack-hot-middleware/client?reload=true"];
      }
    }

    webpackConfig.plugins.push(new webpack.HotModuleReplacementPlugin());
    const compiler = webpack(webpackConfig);
    devServer.app.use(webpackDevMiddleware(compiler));
    devServer.app.use(webpackHotMiddleware(compiler));
    await devServer.listen(cmd.port);
  });

program
  .command("build [project-path]")
  .description("Build the plugin project.")
  .action(async (projectPathArg) => {
    const projectPath = resolveProjectPath(projectPathArg);

    await rimrafAsync(path.join(projectPath, "dist"));

    const hubsConfigPath = path.resolve(projectPath, "hubs.config.js");
    const webpackConfig = hubsSDKWebpackConfig(hubsConfigPath, undefined, { mode: "production" });
    
    console.log("Building plugins...");
    webpack(webpackConfig, (err, stats) => {
      if (err) {
        console.error(err.stack || err);
        if (err.details) {
          console.error(err.details);
        }
        return;
      }
    
      const info = stats.toJson();
    
      if (stats.hasErrors()) {
        console.error(info.errors);
      }
    
      if (stats.hasWarnings()) {
        console.warn(info.warnings);
      }

      console.log("Plugins built. See the dist/ folder for the output.");
    });
  });

async function main() {
  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.error(chalk.red("Error running command:"));
  console.error("  " + chalk.red(error));
  process.exit(1)
});

function resolveProjectPath(projectPathArg) {
  return projectPathArg ? path.resolve(process.cwd(), projectPathArg) : process.cwd();
}