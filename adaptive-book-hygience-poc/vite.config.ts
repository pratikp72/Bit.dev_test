import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "/",
  define: {
    // Ensure environment variables are properly defined
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development",
    ),
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          clerk: ["@clerk/clerk-react"],
          supabase: ["@supabase/supabase-js"],
          icons: ["@radix-ui/react-icons"],
        },
      },
      treeshake: {
        preset: "recommended",
        manualPureFunctions: ["console.log", "console.debug", "console.trace"],
      },
    },
    target: "es2020",
    minify: "esbuild",
    cssCodeSplit: true,
    // Add error handling for build failures
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom", "@clerk/clerk-react"],
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // Proxy requests from /proxy to the target server
      "/proxy": {
        target: "https://local-proxy-quickbooks.onrender.com",
        changeOrigin: true, // Needed for virtual hosted sites
        secure: true, // Use true if the target has a valid SSL certificate
        configure: (proxy, _options) => {
          proxy.on("error", (err, _req, _res) => {
            console.log("Vite Proxy Error:", err);
          });
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log("Sending Request to Target:", req.method, req.url);
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log(
              "Received Response from Target:",
              proxyRes.statusCode,
              req.url,
            );
          });
        },
      },
    },
  },
  preview: {
    port: 3000,
    host: true,
  },
});
