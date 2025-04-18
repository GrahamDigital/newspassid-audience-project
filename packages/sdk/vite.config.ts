import { defineConfig } from "vite";
import { resolve } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { ViteDevServer } from "vite";

const execAsync = promisify(exec);

// Plugin to build both libraries before starting the dev server
const buildLibrariesFirst = () => {
  return {
    name: "build-libraries-first",
    configureServer: async () => {
      // Build both libraries before starting the server
      console.info("Building libraries before starting dev server...");

      // Build the main library
      const { build } = await import("vite");
      await build({
        configFile: resolve(__dirname, "vite.config.ts"),
        mode: "development",
      });

      // Build the async loader
      await build({
        configFile: resolve(__dirname, "vite.config.ts"),
        mode: "async",
      });

      console.info("Libraries built successfully. Starting dev server...");
    },
  };
};

// Plugin to watch for changes and rebuild libraries
const watchAndRebuild = () => {
  return {
    name: "watch-and-rebuild",
    configureServer: (server: ViteDevServer) => {
      // Watch for changes in the src directory
      const watcher = server.watcher;

      // Add a watch on the src directory
      watcher.add(resolve(__dirname, "src"));

      // Listen for changes
      watcher.on("change", (path: string) => {
        // Only rebuild if the change is in the src directory
        if (path.includes("/src/")) {
          console.info(`Change detected in ${path}. Rebuilding libraries...`);

          // Use void to handle the Promise
          void (async () => {
            try {
              // Build the main library
              await execAsync("npm run build:library");

              // Build the async loader
              await execAsync("npm run build:async-loader");

              console.info("Libraries rebuilt successfully.");

              // Notify the client to reload
              server.ws.send({
                type: "full-reload",
                path: "*",
              });
            } catch (error) {
              console.error("Error rebuilding libraries:", error);
            }
          })();
        }
      });
    },
  };
};

export default defineConfig(({ mode, command }) => {
  // Dev server configuration
  if (command === "serve") {
    return {
      root: resolve(__dirname, "examples/basic"),
      publicDir: resolve(__dirname, "dist"),
      server: {
        port: 3000,
        open: true,
      },
      build: {
        outDir: resolve(__dirname, "dist"),
        emptyOutDir: false,
        watch: {
          include: ["src/**"],
        },
      },
      plugins: [buildLibrariesFirst(), watchAndRebuild()],
    };
  }

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
  };
});
