const path = require("path");

module.exports = {
  entry: {
    iframe: "./src/iframe-app.jsx",
  },
  output: {
    path: path.resolve(__dirname, "./"),
    filename: "[name].js",
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: [
              ["@babel/preset-env", { targets: "defaults" }],
              ["@babel/preset-react", { runtime: "automatic" }],
            ],
          },
        },
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    extensions: [".js", ".jsx"],
    fallback: {
      "@react-native-async-storage/async-storage": false,
      "react-native": false,
      "react-native-randombytes": false,
      "react-native-webview": false,
      crypto: false,
      stream: false,
      http: false,
      https: false,
      zlib: false,
      url: false,
      assert: false,
    },
  },
  performance: {
    hints: false,
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  },
  optimization: {
    usedExports: true,
    minimize: true,
  },
  mode: "development",
};
