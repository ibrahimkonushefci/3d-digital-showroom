import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: [
        "brands/**/*",
        "shared/**/*",
        "icon.svg",
        "icon-192.png",
        "icon-512.png",
      ],
      manifest: {
        name: "Digital Showroom Designer",
        short_name: "Showroom",
        description: "Your personal digital showroom",
        theme_color: "#25483e",
        background_color: "#f7f5ef",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        globPatterns: [
          "**/*.{js,css,html,json,svg,png,jpg,webp,woff,woff2,ttf,hdr,glb,gltf,bin,ktx2,wasm,txt}",
        ],
        maximumFileSizeToCacheInBytes: 6000000,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/qa\.html$/],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: Object.fromEntries(
      ["html2canvas", "dompurify", "canvg"].map((name) => [
        name,
        fileURLToPath(new URL("./src/documents/pdfOptional.ts", import.meta.url)),
      ]),
    ),
  },
  preview: {
    allowedHosts: true,
  },
  server: {
    allowedHosts: true,
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          pdf: ["jspdf", "jszip"],
        },
      },
    },
  },
});
