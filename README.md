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

Plugins are exposed as ES2015 javascript modules that are dynamically loaded at predefined places in the Hubs client. Modules are broken up based on the page/feature they are intended to be used with. This keeps the amount of javascript loaded to a minimum and improves page load time. You may use the `registerPlugin` function to expose React Components and more to the Hubs client.

```jsx
import Hubs from "@hubs/core";
import React from "react";

function HomePage() {
  return <div>Hello World!</div>;
}

Hubs.registerPlugin("home-page", HomePage);
```

Plugins are defined in the Hubs `APP_CONFIG` global object that is included in the `<head>` tag of each page.

```js
window.APP_CONFIG = {
  plugins: {
    "home-page": [
      {
        type: "js",
        url: "/index.plugin.js",
        dependencies: ["react", "prop-types", "@hubs/core", "@hubs/home-page"]
      }
    ]
  }
};
```

Currently this configuration is injected into each page by the `HubsDevServer`, in production the Hubs backend server (Reticulum) injects the `APP_CONFIG` into the page.

You register plugins in the `hubs.config.js` file. This is consumed in the `HubsDevServer` to generate the `APP_CONFIG` and in webpack to generate the entry points.

```js
module.exports = {
  name: "my-plugin",
  version: "0.0.1",
  hooks: {
    "home-page": ["./pages/index.js"]
  }
};
```

## Hubs SDK

The current Hubs SDK is focused on extending the home page so it is extremely limited in scope. At this point we are looking to hear from developers on what components they need from us to build their home page experience.

The Hubs SDK is exposed as a global variable when your plugin is loaded into the page.

```js
window.Hubs.core
```

Our webpack config also lets you use ES2015 imports, these will be swapped out with references to global variables at build time.

```js
import Hubs from "@hubs/core";
```

## Hubs SDK Packages

The Hubs SDK is broken into packages that 

- Hubs.core / @hubs/core - Core API methods
- Hubs.react / @hubs/react - Common React components and styles.
- Hubs.homePage / @hubs/home-page - Components and Hooks used on the home page.
- Hubs.mediaBrowser / @hubs/media-browser - Components and styles for the media browser.

### Hubs.core / @Hubs/core

  #### .isAuthenticated(): boolean

  Returns true if the user has an authentication token stored in local storage.

  ##### Example:

  ```js
    Hub.core.isAuthenticated() === true
  ```

  #### .getAuthToken(): string | undefined

  Return the authentication token for the user. Returns `undefined` if the user is not logged in.

  ##### Example:

  ```js
    Hubs.core.getAuthToken() === "super-secret-token"
  ```

  #### .postJSON(path, payload, options?): Promise\<Object\>

  Make a POST request with a json body to Reticulum. `options` are the same options passed to the fetch API. Returns the json parsed response.

  ##### Example:

  ```js
    const response = await Hubs.core.postJSON("/api/v1/hubs", {
      hub: {
        name: "My Room"
      }
    });
  ```

  #### .postJSONAuthenticated(path, payload, options?): Promise\<Object\>

  Make an authenticated POST request with a json body to Reticulum. `options` are the same options passed to the fetch API. Returns the json parsed response. Throws an error if the user is not currently logged in.

  ##### Example:

  ```js
    const response = await Hubs.core.postJSONAuthenticated("/api/v1/hubs", {
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

  ##### Response:
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
    const response = await Hubs.core.createRoom({
      name: "My Room",
      scene_id: "123abc"
    });
  ```

  #### .config.feature(featureName): boolean | string | undefined

  Check if a feature is enabled by the current app config. Features are defined in the Hubs [schema.toml](https://github.com/mozilla/hubs/blob/master/src/schema.toml) file and correspond to configuration in the admin panel.

  ##### Example:

  ```js
    Hubs.core.config.feature("disable_room_creation") === false
  ```
  
  #### .config.image(imageName, cssUrl?): string | undefined

  Get an image url from the current app config. Images are defined in the Hubs [schema.toml](https://github.com/mozilla/hubs/blob/master/src/schema.toml) file and correspond to configuration in the admin panel.

  ##### Example:

  ```js
    Hubs.config.image("logo") === "https://my-hubs-cloud.com/logo.png";

    // cssUrl = true
    Hubs.config.image("logo", true) === "url(https://my-hubs-cloud.com/logo.png)";
  ```

  #### .config.link(linkName, defaultValue?) string | undefined

  Get a url from the current app config. Links are defined in the Hubs [schema.toml](https://github.com/mozilla/hubs/blob/master/src/schema.toml) file and correspond to configuration in the admin panel.

  ##### Example:

  ```js
    Hubs.config.link("docs", "https://hubs.mozilla.com/docs") === "https://hubs.mozilla.com/docs";
  ```

### Hubs.react / @hubs/react
  To Do

### Hubs.homePage / @hubs/home-page
  To Do

### Hubs.mediaBrowser / @hubs/media-browser
  To Do

