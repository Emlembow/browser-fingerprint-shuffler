const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  const browser = env?.browser || 'chrome';

  return {
    mode: argv.mode || 'development',
    devtool: isProduction ? 'source-map' : 'inline-source-map',

    entry: {
      // Core modules
      'core/config': './src/core/config.ts',
      'core/hash': './src/core/hash.ts',
      'core/prng': './src/core/prng.ts',
      'core/timing': './src/core/timing.ts',
      'core/stealth': './src/core/stealth.ts',
      'core/salts': './src/core/salts.ts',

      // Content scripts
      'content/bootstrap': './src/content/bootstrap.ts',
      'content/test_fingerprint': './src/content/test_fingerprint.ts',
      'content/hooks_canvas': './src/content/hooks_canvas.ts',
      'content/hooks_webgl': './src/content/hooks_webgl.ts',
      'content/hooks_audio': './src/content/hooks_audio.ts',
      'content/hooks_navigator': './src/content/hooks_navigator.ts',
      'content/hooks_webrtc': './src/content/hooks_webrtc.ts',
      'content/hooks_screen': './src/content/hooks_screen.ts',
      'content/hooks_fonts': './src/content/hooks_fonts.ts',
      'content/hooks_timezone': './src/content/hooks_timezone.ts',
      'content/hooks_sensors': './src/content/hooks_sensors.ts',
      'content/content_main': './src/content/content_main.ts',

      // Page context scripts
      'content/webgl_page_patch': './src/content/webgl_page_patch.ts',
      'content/test_fingerprint_page': './src/content/test_fingerprint_page.ts'
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },

    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@core': path.resolve(__dirname, 'src/core'),
        '@content': path.resolve(__dirname, 'src/content'),
        '@types': path.resolve(__dirname, 'src/types')
      }
    },

    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/
        }
      ]
    },

    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: browser === 'firefox' ? 'manifest.firefox.json' : 'manifest.json',
            to: 'manifest.json'
          },
          {
            from: 'images',
            to: 'images'
          },
          {
            from: 'README.md',
            to: 'README.md'
          }
        ]
      })
    ],

    optimization: {
      minimize: isProduction,
      splitChunks: false // Don't split chunks for extension
    }
  };
};
