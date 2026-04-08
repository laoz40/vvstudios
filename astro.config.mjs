import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { enhancedImages } from "@sveltejs/enhanced-img";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
	site: "https://vertigovisuals.com.au",

	vite: {
		envPrefix: ["PUBLIC_", "VITE_", "APP_"],
		plugins: [enhancedImages(), tailwindcss()],
	},

	integrations: [svelte(), sitemap()],
});
