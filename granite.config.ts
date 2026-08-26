import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "todaydoit",
  brand: {
    displayName: "두잇",
    primaryColor: "#130537",
    icon: "public/assets/img-character.png",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite dev",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
});
