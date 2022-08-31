import fs from "fs";
export default {
  exclude: ["**/Makefile", "**/lib/google-libapps/**"],
  mount: {},
  plugins: [
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
  optimize: {}
};
