import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    svelte(),
    { name: "chiron-horizon-build-signal", closeBundle() { console.log("CHIRON_HORIZON_UI_BUILD_SUCCESS"); } },
  ],
  build: { outDir: "ui", emptyOutDir: true },
});
