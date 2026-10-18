import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

// Embed public/favicon.svg in index.html as a data URI so the tab icon never
// depends on a separate request (or a browser's cached failure of one).
function inlineSvgFavicon(): Plugin {
  return {
    name: 'inline-svg-favicon',
    transformIndexHtml(html) {
      const svg = fs.readFileSync(path.resolve(__dirname, 'public/favicon.svg'), 'utf8');
      const dataUri = `data:image/svg+xml,${encodeURIComponent(svg.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim())}`;
      return html.replace(/href="\.\/favicon\.svg(\?[^"]*)?"/, `href="${dataUri}"`);
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), inlineSvgFavicon()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
