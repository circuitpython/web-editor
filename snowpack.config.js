export default {
  exclude: ["**/Makefile", "**/.git/**/*"],
  mount: {},
  plugins: [
    [
      "@snowpack/plugin-run-script",
      {
        cmd: "cp -rf node_modules/@fortawesome/fontawesome-free/webfonts assets/css"
      }
    ],
    [
      "@snowpack/plugin-run-script",
      {
        cmd: "sass assets/sass/fontawesome.scss assets/css/fontawesome.css --style compressed -I node_modules/@fortawesome/fontawesome-free"
      }
    ],
    [
      "@snowpack/plugin-run-script",
      {
        cmd: "sass assets/sass/main.scss assets/css/style.css --style compressed",
        watch: "$1 --watch",
        output: "stream"
      }
    ]
  ],
  packageOptions: {
    external: ["fs"]
  },
  devOptions: {},
  buildOptions: {},
  optimize: {
    bundle: true,
    minify: true,
    target: "es2018"
  }
};
