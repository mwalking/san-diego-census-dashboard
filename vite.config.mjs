import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const PROJECT_PAGES_BASE = '/san-diego-census-dashboard/';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? PROJECT_PAGES_BASE : '/',
  plugins: [react()],
}));
