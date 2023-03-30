// Snowpack Configuration File
// See all supported options: https://www.snowpack.dev/reference/configuration

/** @type {import("snowpack").SnowpackUserConfig } */

//import fs from 'fs';
//const cert = await fs.promises.readFile('localhost.cert');
//const key = await fs.promises.readFile('localhost.key');

export default {
  exclude: ['**/Makefile', '**/.git/**/*'],
  mount: {
    'node_modules/@fortawesome/fontawesome-free/webfonts': {url: '/assets/css/webfonts', static: true, resolve:false},
    '.': '/',
  },
  plugins: [
    [
      '@snowpack/plugin-run-script', {
        // Compile Font Awesome using the correct node package as a location
        cmd: 'sass assets/sass/fontawesome.scss assets/css/fontawesome.css --style compressed -I node_modules/@fortawesome/fontawesome-free',
      },
    ],
    [
      '@snowpack/plugin-run-script', {
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
