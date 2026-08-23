/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // GitHub Pages serves the app under /<repo>/ — the deploy workflow sets BASE_URL.
  base: process.env.BASE_URL || '/',
  plugins: [vue(), tailwindcss()],
  test: {
    environment: 'happy-dom',
  },
});
