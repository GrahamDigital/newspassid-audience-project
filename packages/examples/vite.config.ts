import { resolve } from "path";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

const watchSdkDistAndReload = (): Plugin => {
  return {
    name: "watch-sdk-dist-and-reload",
    configureServer(server) {
      const sdkDistPath = resolve(__dirname, "../sdk/dist");

      const reloadPage = (pathChanged: string) => {
        // Ensure the change is within the monitored directory
        if (
          pathChanged.startsWith(sdkDistPath) &&
          pathChanged.endsWith("newspassid.js")
        ) {
          console.info(
            `[HMR] SDK newspassid.js change detected: ${pathChanged}. Reloading example page...`,
          );
          server.ws.send({
            type: "full-reload",
            path: "*",
          });
        }
      };

      // Add the sdk/dist directory to Vite's watcher
      server.watcher.add(sdkDistPath);

      // Listen for 'add' and 'change' events in the watched directory
      server.watcher.on("add", reloadPage);
      server.watcher.on("change", reloadPage);
    },
  };
};

export default defineConfig({
  base: "/examples",
  build: {
    outDir: "dist",
  },
  server: {
    // You can specify a port for the examples dev server if needed,
    // e.g., port: 5173, to avoid conflict with the SDK dev server (default 3000 for SDK).
    // If not specified, Vite will automatically pick an available port.
  },
  plugins: [watchSdkDistAndReload(), tailwindcss()],
});
