import { defineConfig } from "vite";
import { resolve } from "path";
import fs from "fs";

// Log file sizes after build
const logFileSizes = () => {
  return {
    name: "log-file-sizes",
    closeBundle: () => {
      console.log("\nOutput files:");
      [
        "newspassid.js",
        "newspassid.esm.js",
        "newspassid.min.js",
        "newspassid-async.js",
        "newspassid-async.min.js",
      ].forEach((file) => {
        try {
          const size = (fs.statSync(`dist/${file}`).size / 1024).toFixed(1);
          console.log(`- dist/${file} (${size}KB)`);
        } catch (e) {
          // Skip files that don't exist yet
        }
      });
    },
  };
};

export default defineConfig(({ mode }) => {
  // Determine build configuration based on mode
  if (mode === "async") {
    return {
      build: {
        sourcemap: true,
        lib: {
          entry: resolve(__dirname, "src/loaders/async-loader.ts"),
          formats: ["iife"],
          fileName: () => "newspassid-async.js",
          name: "NewsPassID",
        },
        outDir: "dist",
        emptyOutDir: false, // Don't clean the output directory
        minify: true,
      },
      plugins: [logFileSizes()],
    };
  }

  // Default mode: main library
  return {
    build: {
      sourcemap: true,
      lib: {
        entry: resolve(__dirname, "src/core/newspassid.ts"),
        name: "NewsPassID",
        formats: ["umd", "es"],
        fileName: (format) =>
          format === "umd" ? "newspassid.js" : "newspassid.esm.js",
      },
      outDir: "dist",
      emptyOutDir: true, // Clean the output directory
    },
    plugins: [logFileSizes()],
  };
});
