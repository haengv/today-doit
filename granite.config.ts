import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "today-pudding",
  brand: {
    displayName: "오늘의 푸딩",
    primaryColor: "#F4A23A",
    icon: "",
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
