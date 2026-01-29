import {defineConfig} from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig(({command}) => {
  const isDev = command === "serve";

  return {
    plugins: [
      isDev &&
      monkey({
        entry: 'src/main.js',
        userscript: {
          icon: 'https://vitejs.dev/logo.svg',
          namespace: 'npm/vite-plugin-monkey',
          match: ['https://www.coral.ru/monkey/'],
        },
      }),
    ].filter(Boolean),
  }
});
