// vite.config.js | https://vitejs.dev/config/
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
    build: {
        assetsInlineLimit: 0,
        chunkSizeWarningLimit: 1500,
        rollupOptions: {
            output: {
                entryFileNames: `assets/js/[name].js`,
                chunkFileNames: `assets/js/[name].js`,
                assetFileNames: assetInfo => {
                    if (/(\.png)|(\.gif)|(\.webp)|(\.ico)$/.test(assetInfo.name)) {
                      return 'assets/images/[name].[ext]'
                    }
                    if (/(\.ttf)|(\.woff2)$/.test(assetInfo.name)) {
                      return 'assets/fonts/[name].[ext]'
                    }
                    return 'assets/[name].[ext]'
                  }
            }
        }
    },
    plugins: [ mkcert() ]
})
