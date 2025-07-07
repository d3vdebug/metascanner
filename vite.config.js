import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        auth: resolve(__dirname, 'auth.html'),
      },
    },
  },
  server: {
    // Optional: open the auth page by default if the user isn't logged in.
    // The app logic already handles redirection, so this is a convenience.
    open: '/auth.html'
  }
});
