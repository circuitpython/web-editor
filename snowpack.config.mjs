// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */

//import fs from 'fs';
//const cert = await fs.promises.readFile('localhost.cert');
//const key = await fs.promises.readFile('localhost.key');

export default {
  exclude: ['**/Makefile'],
  mount: {
    /* ... */
  },
  plugins: [
    [
      '@snowpack/plugin-run-script',
        {
          cmd: 'sass assets/sass/fontawesome.scss assets/css/fontawesome.css --style compressed -I node_modules/@fortawesome/fontawesome-free',
          watch: '$1 --watch',
          output: 'stream',
        },
    ],
    [
      '@snowpack/plugin-run-script',
      {
        cmd: 'sass assets/sass/main.scss assets/css/style.css --style compressed',
        watch: '$1 --watch',
        output: 'stream',
      },
    ],
  ],
  packageOptions: {
    "external": ["fs"]
  },
  devOptions: {
    //secure: {cert, key},
  },
  buildOptions: {
    /* ... */
  },
  optimize: {
    bundle: true,
    minify: true,
    target: 'es2018',
  },
};

// snowpack.config.mjs