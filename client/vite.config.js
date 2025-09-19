import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  build: {
    // Esbuild elimina console/debugger del bundle de PRODUCCIÓN:
    // (Sólo se aplica en build)
    // Nota: si prefieres Terser, mira alternativa abajo.
  },
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
}))