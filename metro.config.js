// Metro config exists solely to make expo-sqlite work on web. Without it, the web
// bundle fails to resolve expo-sqlite's wa-sqlite.wasm and the app won't load at all.
// Native (iOS/Android) uses the platform's own SQLite and needs none of this.
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build imports wa-sqlite.wasm directly; Metro doesn't treat .wasm
// as an asset by default, so the import fails to resolve.
config.resolver.assetExts.push("wasm");

// wa-sqlite talks to its worker over SharedArrayBuffer, which browsers only expose to
// cross-origin-isolated documents. Without these two headers the bundle resolves but
// SharedArrayBuffer is undefined at runtime, so the database fails to open.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
    return middleware(req, res, next);
  };
};

module.exports = config;
