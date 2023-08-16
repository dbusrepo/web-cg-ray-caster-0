// https://gist.github.com/rupeshtiwari/e7235addd5f52dc3e449672c4d8b88d5
// see https://webpack.js.org/configuration/configuration-languages/#typescript
// https://survivejs.com/webpack/building/source-maps/
// const HtmlWebpackPlugin = require('html-webpack-plugin');
// const path = require('path');
import * as os from 'os'
import path from 'path';
import * as webpack from 'webpack'; // TODO
import { CleanWebpackPlugin } from 'clean-webpack-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { ProvidePlugin } from 'webpack';
import Dotenv from 'dotenv-webpack';
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin')
const ESLintPlugin = require('eslint-webpack-plugin')
// import MiniCssExtractPlugin from "mini-css-extract-plugin";
// import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
// import TerserPlugin from "terser-webpack-plugin";
// in case you run into any typescript error when configuring `devServer`
import 'webpack-dev-server';
import { argv } from 'process';

let env = process.env['NODE_ENV'];

// const isProduction = process.env.NODE_ENV == 'production';
let isProduction =
    (env && env.match(/production/)) ||
    argv.reduce((prev, cur) => prev || cur === '--production', false);

let numCyclesDetected = 0;

const config: webpack.Configuration = {
  entry: './src/main.ts',
  mode: 'development',
  target: 'web',

  // devtool: 'eval',
  // devtool: 'source-map',
  // devtool: 'inline-source-map',
  // devtool: 'hidden-source-map',
  devtool: 'eval-source-map',

  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
      progress: false,
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    compress: true,
    port: 9091,
    hot: true,
    watchFiles: ['src/**/*', 'dist/**/*'],
  },
  // cache: false,
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].[contenthash].js',
    // filename: 'bundle.js',
    clean: true,
    // filename: (pathData) => `${pathData.chunk!.name}.${process.env.npm_package_version}.js`,
  },
  resolve: {
    // Add `.ts` and `.tsx` as a resolvable extension.
    extensions: [
        '.js',
        '.jsx',
        '.ts',
        '.tsx',
        '.css',
        '.json',
        // '.mjs',
    ],
    alias: {
      images: path.resolve(__dirname, 'src/asset/images/'),
      react: 'preact/compat',
      'react-dom/test-utils': 'preact/test-utils',
      'react-dom': 'preact/compat', // Must be below test-utils
      'react/jsx-runtime': 'preact/jsx-runtime',
    },
    fallback: {
      stream: require.resolve('stream-browserify')
    }
  },
  performance: {
      hints: false,
      maxEntrypointSize: 51200,
      maxAssetSize: 51200
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
            // https://stackoverflow.com/questions/73499449/webpack-dev-server-not-reloading
            options: {
              transpileOnly: true,
            },
          },
        ],
      },
      {
        test: /\.?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env', '@babel/preset-react'],
          },
        },
      },
      // {
      //   test: /\.([jt]sx?)?$/,
      //   use: "swc-loader",
      //   exclude: /node_modules/,
      // },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: ['style-loader', 'css-loader'],
      },
      // {
      //     test: /\.css$/,
      //     sideEffects: true,
      //     use: [
      //         MiniCssExtractPlugin.loader,
      //         'css-loader'
      //     ],
      //     exclude: /node_modules/,
      // },
      {
        test: /\.wasm$/,
        exclude: /node_modules/,
        loader: 'wasm-loader',
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'images/[hash][ext][query]',
        },
      },
      // {
      //   test: /\.res$/i,
      //   type: 'asset/resource',
      // },
      // {
      //   test: /\.wasm$/,
      //   type: 'asset/resource',
      // },
      // {
      //   test: /\.wasm$/,
      //   exclude: /node_modules/,
      //   loader: 'file-loader',
      // },
      {
        test: /.txt$/i,
        type: 'asset/source',
      },
    ],
  },
  plugins: [
    new Dotenv(),
    new HtmlWebpackPlugin({
      template: './src/index.html',
    }),
    new CleanWebpackPlugin(),
    new ProvidePlugin({
      process: 'process/browser',
    }),
    // new MiniCssExtractPlugin(),
    // to use file-type I add this and the 'fallback' above. See here:
    // https://stackoverflow.com/questions/72133210/react-unhandledschemeerror-nodebuffer-is-not-handled-by-plugins
    // see also https://gist.github.com/ef4/d2cf5672a93cf241fd47c020b9b3066a
    new webpack.NormalModuleReplacementPlugin(/node:/, (resource) => {
      resource.request = resource.request.replace(/^node:/, "");
    }),
    // https://github.com/TypeStrong/ts-loader#transpileonly
    new ForkTsCheckerWebpackPlugin({
      async: false,
      typescript: {
        diagnosticOptions: {
          semantic: true,
          syntactic: true,
        },
        build: true,
        mode: 'write-references',
      },
    }),
    // https://stackoverflow.com/questions/64461635/adding-eslint-webpack-plugin-into-project-to-provide-typescript-linting
    // new ESLintPlugin({
    //   extensions: ['ts']
    // }),
    // new CircularDependencyPlugin({
    //   failOnError: false,
    //   allowAsyncCycles: false,
    //   cwd: process.cwd(),
    //   exclude: /node_modules/,
    //   // `onStart` is called before the cycle detection starts
    //   // @ts-ignore
    //   onStart({ compilation }) {
    //     numCyclesDetected = 0;
    //     console.log('start detecting webpack modules cycles');
    //   },
    //   // `onDetected` is called for each module that is cyclical
    //   // @ts-ignore
    //   onDetected({ module: webpackModuleRecord, paths, compilation }) {
    //     numCyclesDetected++;
    //     // `paths` will be an Array of the relative module paths that make up the cycle
    //     // `module` will be the module record generated by webpack that caused the cycle
    //     console.log('cycle detected:', paths.join(' -> '));
    //     // compilation.errors.push(new Error(paths.join(' -> ')))
    //     compilation.warnings.push(new Error(paths.join(' -> ')));
    //   },
    //   // `onEnd` is called before the cycle detection ends
    //   // @ts-ignore
    //   onEnd({ compilation }) {
    //     console.log('number of cycles detected:', numCyclesDetected);
    //     console.log('end detecting webpack modules cycles');
    //   },
    // })
  ],
  optimization: {
      moduleIds: 'deterministic',
      runtimeChunk: 'single',
      minimize: isProduction ? true : false,
      // minimizer: [
      //     new TerserPlugin({ test: /\.js(\?.*)?$/i }),
      //     new CssMinimizerPlugin({})
      // ]
      splitChunks: {
        // include all types of chunks
        chunks: 'all',
      },
  },
  watchOptions: {
    // for some systems, watching many files can result in a lot of CPU or memory usage
    // https://webpack.js.org/configuration/watch/#watchoptionsignored
    // don't use this pattern, if you have a monorepo with linked packages
    // https://github.com/TypeStrong/ts-loader#usage-with-webpack-watch
    ignored: ['**/node_modules', '**/*.d.ts'], // '**/*.js'
  },
};

export default config;
