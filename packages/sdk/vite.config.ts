import { exec } from "child_process";
import { resolve } from "path";
import { promisify } from "util";
import type { HmrContext } from "vite";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import tsconfigPaths from "vite-tsconfig-paths";

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
    async handleHotUpdate(ctx: HmrContext) {
      // ctx contains { file, timestamp, modules, read, server }
      // Check if the changed file is within the src directory
      if (ctx.file.includes("/src/")) {
        console.info(
          `[HMR] Change detected in ${ctx.file}. Rebuilding libraries...`,
        );

        try {
          // Build the main library
          await execAsync("npm run build:library");

          // Build the async loader
          await execAsync("npm run build:async-loader");

          // Return an empty array to indicate that we've handled this update
          // and Vite should not perform further HMR processing on these modules.
          return [];
        } catch (error) {
          console.error("[HMR] Error rebuilding libraries:", error);
          // Optionally, still trigger a full reload on error
          ctx.server.ws.send({
            type: "full-reload",
            path: "*",
          });
          return [];
        }
      }

      // For files not in /src/, or if we want Vite to attempt default HMR
      // for the modules affected by this change, return ctx.modules or undefined.
      // If we only care about /src/ changes for this plugin's specific actions,
      // and the change was not in /src/, returning undefined (implicitly) is fine.
      return undefined;
    },
  };
};

export default defineConfig(({ mode, command }) => {
  // Dev server configuration
  if (command === "serve") {
    return {
      publicDir: resolve(__dirname, "dist"),
      server: { port: 3000 },
      build: {
        outDir: resolve(__dirname, "dist"),
        emptyOutDir: false,
        watch: {
          include: ["src/**"],
        },
      },
      plugins: [
        tsconfigPaths(),
        dts({ rollupTypes: true }),
        buildLibrariesFirst(),
        watchAndRebuild(),
      ],
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
      plugins: [tsconfigPaths(), dts({ rollupTypes: true })],
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
      minify: true,
    },
    plugins: [tsconfigPaths(), dts({ rollupTypes: true })],
  };
});
