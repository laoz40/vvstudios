import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import svelte from "@astrojs/svelte";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
	site: "https://vertigovisuals.com.au",

	vite: {
		envPrefix: ["PUBLIC_", "VITE_", "APP_"],
		plugins: [tailwindcss()],
	},

	integrations: [svelte(), sitemap()],
});
