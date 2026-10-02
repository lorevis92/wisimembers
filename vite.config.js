import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Sourcemap anche in produzione: lo stack nel riquadro d'errore punta ai file veri.
  build: { sourcemap: true },
});
