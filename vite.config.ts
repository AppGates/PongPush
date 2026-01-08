import { defineConfig, Plugin } from 'vite';
import { resolve } from 'path';
import { execSync } from 'child_process';

// Plugin to inject git commit SHA into HTML
function injectCommitSha(): Plugin {
  return {
    name: 'inject-commit-sha',
    transformIndexHtml(html) {
      let commitSha = 'dev-local';
      try {
        // Get the current git commit SHA
        commitSha = execSync('git rev-parse HEAD').toString().trim();
      } catch (error) {
        console.warn('Unable to get git commit SHA, using "dev-local"');
      }
      // Replace the placeholder with the actual commit SHA
      return html.replace('__COMMIT_SHA__', commitSha);
    },
  };
}

export default defineConfig({
  base: '/PongPush/',
  plugins: [injectCommitSha()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
