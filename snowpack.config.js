// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */
module.exports = {
  exclude: ['**/Makefile', '**/lib/google-libapps/**'],
  mount: {
    /* ... */
  },
  plugins: [
    [
      '@snowpack/plugin-run-script',
      {
        cmd: 'sass assets/sass/main.scss assets/css/style.css', 
        watch: '$1 --watch',
        output: 'stream',
      },
    ],
  ],
  packageOptions: {
    /* ... */
  },
  devOptions: {
    /* ... */
  },
  buildOptions: {
    /* ... */
  },
  optimize: {
    // bundle: true,
    // minify: true,
    // target: 'es2018',
  },
};
