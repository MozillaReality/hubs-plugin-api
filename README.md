# hubs-plugin-api

Example project to showcase Hubs plugin development with Webpack and evaluate the plugin API.

**This API is experimental and will change**

Please give us feedback on the API in the #extensibility channel on our [Discord server](https://discord.gg/vgxfMpr).

## Getting Started

Run the following commands:

```bash
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

You register plugins in the `hubs.config.js` file. This is consumed in the `HubsDevServer` to generate the `APP_CONFIG` and in webpack to generate the entry points.

```js
module.exports = {
  plugins: {
    "home-page": [
      {
        name: "HomePage",
        path: "./pages/index.js"
      }
    ]
  }
};
```

We make use of Webpack's externals to load third party code that is already in the page from global variables. This reduces bundle size and page load times.

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

- [Hubs](#hubs) - Core API methods
- [Hubs.config](#hubsconfig) - App Config Utilities
- [Hubs.React](#hubsreact) - React Components, Hooks, and Styles
  - [Hubs.React.Common](#hubsreactcommon) - Components and styles available on all pages.
    - [Hubs.React.Common.PageStyles](#hubsreactcommonpagestyles) - CSS module containing styles used across all pages (typography, CSS reset, etc.).
    - [Hubs.React.Common.Page](#hubsreactcommonpage) - React Component for wrapping a page. Includes the page styles, header, and footer.
    - [Hubs.React.Common.IfFeature](#hubsreactcommoniffeature) - Conditionally render children if a feature is enabled in the server's app config.
    - [Hubs.React.Common.AuthContext](#hubsreactcommonauthcontext) - React context for all user authentication methods and variables.
  - [Hubs.React.Media](#hubsreactmedia) - Components and styles available where we display items from the media API (images, videos, models, rooms, scenes, etc.)
    - [Hubs.React.Common.Tiles](#hubsreactcommontiles) - Media Grid React component
    - [Hubs.React.Common.Styles](#hubsreactcommonstyles) - CSS module for styles related to the media grid
  - [Hubs.React.HomePage](#hubsreacthomepage) - Components and Hooks available on the home page.
    - [Hubs.React.HomePage.PWAButton](#hubsreacthomepagepwabutton) - Button for installing the Hubs Progressive Web App
    - [Hubs.React.HomePage.CreateRoomButton](#hubsreacthomepagecreateroombutton) - Button for creating and redirecting to a Hubs Room
    - [Hubs.React.HomePage.useFeaturedRooms](#hubsreacthomepageusefeaturedrooms) - Hook for loading public/favorited rooms
    - [Hubs.React.HomePage.useHomePageRedirect](#hubsreacthomepageusehomepageredirect) - Hook for redirecting to verification page when clicking on the magic link in the login email.
    - [Hubs.React.HomePage.Styles](#hubsreacthomepagestyles) - CSS module for all the base home page styles
    - [Hubs.React.HomePage.discordLogoSmall](#hubsreacthomepagediscordlogosmall) - url for the Discord logo to be used for the discord bot message

### Hubs

  #### .isAuthenticated(): boolean

  Returns true if the user has an authentication token stored in local storage.

  ##### Example:

  ```js
    Hubs.isAuthenticated() === true
  ```

  #### .getAuthToken(): string | undefined

  Return the authentication token for the user. Returns `undefined` if the user is not logged in.

  ##### Example:

  ```js
    Hubs.getAuthToken() === "super-secret-token"
  ```

  #### .postJSON(path, payload, options?): Promise\<Object\>

  Make a POST request with a json body to Reticulum. `options` are the same options passed to the fetch API. Returns the json parsed response.

  ##### Example:

  ```js
    const response = await Hubs.postJSON("/api/v1/hubs", {
      hub: {
        name: "My Room"
      }
    });
  ```

  #### .postJSONAuthenticated(path, payload, options?): Promise\<Object\>

  Make an authenticated POST request with a json body to Reticulum. `options` are the same options passed to the fetch API. Returns the json parsed response. Throws an error if the user is not currently logged in.

  ##### Example:

  ```js
    const response = await Hubs.postJSONAuthenticated("/api/v1/hubs", {
      hub: {
        name: "My Room"
      }
    });
  ```

  #### .createRoom(params?): Promise\<Object\>

  Create a room for the current user. If the user is not logged in the room will be created anonymously.

  ##### Request:
  ```ts
  {
    name?: string
    description?: string
    scene_id?: string
    room_size?: number
    user_data?: {}
  }

  ```

  ##### Example Response:
  ```ts
    {
      creator_assignment_token: string
      embed_token: string
      hub_id: string
      status: string
      url: string
    }
  ```

  ##### Example:

  ```js
    const response = await Hubs.createRoom({
      name: "My Room",
      scene_id: "123abc"
    });
  ```

### Hubs.config

  #### .feature(featureName): boolean | string | undefined

  Check if a feature is enabled by the current app config. Features are defined in the Hubs [schema.toml](https://github.com/mozilla/hubs/blob/master/src/schema.toml) file and correspond to configuration in the admin panel.

  ##### Example:

  ```js
    Hubs.config.feature("disable_room_creation") === false
  ```
  
  #### .image(imageName, cssUrl?): string | undefined

  Get an image url from the current app config. Images are defined in the Hubs [schema.toml](https://github.com/mozilla/hubs/blob/master/src/schema.toml) file and correspond to configuration in the admin panel.

  ##### Example:

  ```js
    Hubs.config.image("logo") === "https://my-hubs-cloud.com/logo.png";

    // cssUrl = true
    Hubs.config.image("logo", true) === "url(https://my-hubs-cloud.com/logo.png)";
  ```

  #### .link(linkName, defaultValue?) string | undefined

  Get a url from the current app config. Links are defined in the Hubs [schema.toml](https://github.com/mozilla/hubs/blob/master/src/schema.toml) file and correspond to configuration in the admin panel.

  ##### Example:

  ```js
    Hubs.config.link("docs", "https://hubs.mozilla.com/docs") === "https://hubs.mozilla.com/docs";
  ```

### Hubs.React
  To Do

### Hubs.React.Common
  To Do

### Hubs.React.Common.PageStyles
  To Do

### Hubs.React.Common.Page
  To Do

### Hubs.React.Common.IfFeature
  To Do

### Hubs.React.Common.AuthContext
  To Do

### Hubs.React.Media
  To Do

### Hubs.React.Common.Tiles
  To Do

### Hubs.React.Common.Styles
  To Do

### Hubs.React.HomePage
  To Do

### Hubs.React.HomePage.PWAButton
  To Do

### Hubs.React.HomePage.CreateRoomButton
  To Do

### Hubs.React.HomePage.useFeaturedRooms
  To Do

### Hubs.React.HomePage.useHomePageRedirect
  To Do

### Hubs.React.HomePage.Styles
  To Do

### Hubs.React.HomePage.discordLogoSmall
  To Do
