import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative asset paths support repository subpaths on GitHub Pages and the Vercel root.
export default defineConfig({
  plugins: [react()],
  base: './',
});
