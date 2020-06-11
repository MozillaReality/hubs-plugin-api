# hubs-plugin-api

Example project to showcase Hubs plugin development with Webpack and evaluate the plugin API.

**This API is experimental and will change**

Please give us feedback on the API in the #extensibility channel on our [Discord server](https://discord.gg/vgxfMpr).

## Getting Started

Run the following commands:

```
git clone https://github.com/MozillaReality/hubs-plugin-api.git
cd hubs-plugin-api
npm install
npm start
```

Open https://localhost:8080

Modify `pages/index.js` to modify the landing page.

You can also run `npm run build` to see what a production build of your plugin would look like.

At this time there is no way to use the plugin with your Hubs Cloud instance, this project is only intended for evaluation of the API.

## Hubs Plugin System

When you run your own Hubs Cloud instance the Hubs client and the rest of the stack will receive automatic updates with the latest features of Hubs. In order to maintain the ability to automatically update your Hubs client we have designed a plugin system which loads plugin scripts at runtime. The APIs exposed to you will be versioned and maintained in a way that will avoid breakage when your Hubs Cloud packages are updated.

Plugins are exposed as ES2015 javascript modules that are dynamically loaded at predefined places in the Hubs client. Modules are broken up based on the page/feature they are intended to be used with. This keeps the amount of javascript loaded to a minimum and improves page load time. You may export named members from the module to expose React Components and more to the Hubs client.

```jsx
import React from "react";

export function HomePage() {
  return <div>Hello World!</div>;
}
```

This project builds with Webpack which currently cannot export ES2015 modules. To get around this limitation and open up plugin development to additional tools we also allow plugins to expose methods on a global variable. Plugins can then be bundled as umd modules in webpack.

Plugins are defined in the Hubs `APP_CONFIG` global object that is included in the `<head>` tag of each page.

```js
window.APP_CONFIG = {
  plugins: {
    "home-page": [
      {
        type: "js",
        url: "/index.plugin.js",
        options: { 
          globalVar: "MY_PLUGIN"
        }
      }
    ]
  }
};
```

Currently this configuration is injected into each page by the `HubsDevServer`, in production the Hubs backend server (Reticulum) injects the `APP_CONFIG` into the page.

In `webpack.config.js` you can see how we register our `home-page` plugin:

```js
const globalVar = "MY_PLUGIN";

hubsDevServer.registerPlugin("home-page", "js", "/index.plugin.js", { globalVar });
```

```ts
function registerPlugin(key: string, type: string, url: string, options?: { globalVar?: string })
```

You will also see that we make use of Webpack's externals to load third party code that is already in the page from global variables:

```js
{
  ...
  externals: {
    react: "React",
    "react-dom": "ReactDOM",
    "react-intl": "ReactIntl",
    "prop-types": "PropTypes",
    "classnames": "ClassNames",
    hubs: "Hubs"
  }
}
```

The Hubs API is also accessed in this way.

## Hubs API

The current Hubs API is focused on extending the home page so it is extremely limited in scope. At this point we are looking to hear from developers on what components they need from us to build their home page experience.

The Hubs API is exposed as a global variable when your plugin is loaded into the page.

```js
window.Hubs
```

Our webpack config also lets you use ES2015 imports because of the externals configuration.

```js
import Hubs from "hubs";
```

At this time these are the following exported members:

```js
window.Hubs = {
  configs,
  PhoenixUtils,
  React: {
    Common: {
      PageStyles,
      Page,
      IfFeature,
      AuthContext
    },
    Media: {
      Tiles
      Styles
    },
    HomePage: {
      PWAButton,
      CreateRoomButton,
      useFeaturedRooms,
      useHomePageRedirect,
      Styles
      discordLogoSmall
    }
  }
};
```

- `Hubs.configs` - App Config Utilities
- `Hubs.PhoenixUtils` - Phoenix Utilities
- `Hubs.React` - React Components, Hooks, and Styles
  - `Hubs.React.Common` - Components and styles available on all pages.
    - `Hubs.React.Common.PageStyles` - CSS module containing styles used across all pages (typography, CSS reset, etc.).
    - `Hubs.React.Common.Page` - React Component for wrapping a page. Includes the page styles, header, and footer.
    - `Hubs.React.Common.IfFeature` - Conditionally render children if a feature is enabled in the server's app config.
    - `Hubs.React.Common.AuthContext` - React context for all user authentication methods and variables.
  - `Hubs.React.Media` - Components and styles available where we display items from the media API (images, videos, models, rooms, scenes, etc.)
    - `Hubs.React.Common.Tiles` - Media Grid React component
    - `Hubs.React.Common.Styles` - CSS module for styles related to the media grid
  - `Hubs.React.HomePage` - Components and Hooks available on the home page.
    - `Hubs.React.HomePage.PWAButton` - Button for installing the Hubs Progressive Web App
    - `Hubs.React.HomePage.CreateRoomButton` - Button for creating and redirecting to a Hubs Room
    - `Hubs.React.HomePage.useFeaturedRooms` - Hook for loading public/favorited rooms
    - `Hubs.React.HomePage.useHomePageRedirect` - Hook for redirecting to verification page when clicking on the magic link in the login email.
    - `Hubs.React.HomePage.Styles` - CSS module for all the base home page styles
    - `Hubs.React.HomePage.discordLogoSmall` - url for the Discord logo to be used for the discord bot message
