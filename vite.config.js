import { defineConfig } from 'vite'

export default defineConfig({
  base: './', // relative base works for any repo name
  server: { port: 5173, host: true }
})
