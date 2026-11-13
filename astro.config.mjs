// @ts-check

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sourceInfoIntegration from './src/plugins/source-info-integration.mjs';

// Enable source info in build when BUILD_DEV environment variable is set
const enableSourceInfo = process.env.BUILD_DEV === 'true';

// https://astro.build/config
const config = {
  integrations: [
      react(),
      sourceInfoIntegration({
          enabled: enableSourceInfo,
          hideToolbar: true
      })
  ],
  vite: {
      plugins: [tailwindcss()],
  },
  // Disable toolbar in dev mode when using build-dev
  devToolbar: {
      enabled: !enableSourceInfo
  }
};

// https://astro.build/config
export default defineConfig(config)
