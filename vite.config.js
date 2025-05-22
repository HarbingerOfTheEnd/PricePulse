import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { resolve } from "node:path";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        TanStackRouterVite({
            autoCodeSplitting: true,
            routesDirectory: resolve(__dirname, "src/routes"),
            generatedRouteTree: resolve(__dirname, "src/routeTree.gen.ts"),
        }),
        viteReact(),
        tailwindcss(),
    ],
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
    root: resolve(__dirname, ""),
    publicDir: resolve(__dirname, "public"),
    server: {
        port: 3000,
        strictPort: true,
        open: true,
    },
});
