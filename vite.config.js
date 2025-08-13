import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // ใส่ path ของ GitHub Pages ให้ตรงกับชื่อรีโป
  base: '/hr-app-new/',
  plugins: [react()],
  server: { port: 5173, host: true }
})
