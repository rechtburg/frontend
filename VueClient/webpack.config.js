const path = require('path');
const { VueLoaderPlugin } = require("vue-loader");
 
module.exports = {
  entry: './src/index.js',
  output: {
    path: path.join(__dirname, 'www'),
    filename: 'bundle.js'
  },
  devServer: {
    contentBase: 'www',
    port: 4000,
    inline: true
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader',
      },
      {
        test: /\.css$/,
        use: ['vue-style-loader', 'css-loader', 'style-loader'],
      },
      {
        test: /\.(sass|scss)$/,
        use: ['style-loader', 'css-loader', 'sass-loader'],
      },
      {
        test: /\.(jpg|png|json|svg)$/,
        loaders: 'url-loader',
      },
      {
        test: /\.vue$/,
        loader: 'vue-loader',
        options: {
          loaders: {
            scss: 'vue-style-loader!css-loader!sass-loader'
          }
        },
      },
    ]
  },
  plugins: [new VueLoaderPlugin()],
  resolve: {
    extensions: ['.js', '.vue', 'json'],
    alias: {
      'vue$': 'vue/dist/vue.esm.js'
    }
  }
};
