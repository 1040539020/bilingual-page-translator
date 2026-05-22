const fs = require("fs");
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");

const targetBrowser = process.env.TARGET_BROWSER || "chrome";
const extensionVersion = process.env.EXTENSION_VERSION || require("./package.json").version;

module.exports = {
  entry: {
    background: path.resolve(__dirname, "src/background.ts"),
    content: path.resolve(__dirname, "content/content.js"),
    "popup/popup": path.resolve(__dirname, "src/popup/popup.tsx"),
    "options/options": path.resolve(__dirname, "src/options/options.tsx")
  },
  output: {
    path: path.resolve(__dirname, "dist", targetBrowser),
    filename: "[name].js",
    clean: true
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, "css-loader"]
      }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      __TARGET_BROWSER__: JSON.stringify(targetBrowser),
      __EXTENSION_VERSION__: JSON.stringify(extensionVersion),
      __API_BASE_URL__: JSON.stringify(process.env.API_BASE_URL || ""),
      __REMOTE_CONFIG_URL__: JSON.stringify(process.env.REMOTE_CONFIG_URL || "")
    }),
    new MiniCssExtractPlugin({
      filename: "[name].css"
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: "manifest.json",
          to: "manifest.json",
          transform(content) {
            return JSON.stringify(createManifest(JSON.parse(content.toString()), targetBrowser, extensionVersion), null, 2);
          }
        },
        { from: "icons", to: "icons" },
        { from: "services", to: "services" },
        { from: "security", to: "security" },
        { from: "utils", to: "utils" },
        {
          from: "popup/popup.css",
          to: "popup/popup.css",
          transform: minifyCss
        },
        {
          from: "options/options.css",
          to: "options/options.css",
          transform: minifyCss
        }
      ]
    }),
    new HtmlWebpackPlugin({
      template: "popup/popup.html",
      filename: "popup/popup.html",
      chunks: ["popup/popup"],
      inject: "body",
      scriptLoading: "defer",
      minify: true
    }),
    new HtmlWebpackPlugin({
      template: "options/options.html",
      filename: "options/options.html",
      chunks: ["options/options"],
      inject: "body",
      scriptLoading: "defer",
      minify: true
    })
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: process.env.KEEP_CONSOLE !== "true",
            passes: 2
          },
          mangle: true,
          format: {
            comments: false
          }
        },
        extractComments: false
      }),
      new CssMinimizerPlugin()
    ],
    splitChunks: false,
    runtimeChunk: false
  },
  performance: {
    hints: false
  },
  devtool: process.env.SOURCE_MAPS === "true" ? "source-map" : false
};

function createManifest(baseManifest, browser, version) {
  const manifest = {
    ...baseManifest,
    version,
    description:
      "Bilingual page translator. Permissions are used to translate active pages, store user preferences, and provide context-menu actions."
  };

  manifest.content_security_policy = {
    extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'; frame-ancestors 'none';"
  };

  if (browser === "firefox") {
    manifest.manifest_version = 2;
    manifest.permissions = Array.from(new Set([...(manifest.permissions || []), "<all_urls>"]));
    delete manifest.host_permissions;
    delete manifest.minimum_chrome_version;
    delete manifest.content_security_policy;
    manifest.content_security_policy = "script-src 'self'; object-src 'self';";
    manifest.background = {
      scripts: ["background.js"],
      persistent: false
    };
    manifest.browser_action = manifest.action;
    delete manifest.action;
    manifest.options_ui = {
      page: "options/options.html",
      open_in_tab: true
    };
    delete manifest.options_page;
    manifest.browser_specific_settings = {
      gecko: {
        id: process.env.FIREFOX_EXTENSION_ID || "bilingual-page-translator@example.com",
        strict_min_version: "109.0"
      }
    };
  }

  if (browser === "edge") {
    manifest.name = "Bilingual Page Translator for Edge";
  }

  return manifest;
}

function minifyCss(content) {
  return content
    .toString()
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,])\s*/g, "$1")
    .trim();
}
