import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import { studioSite } from "./src/config/sites";
import babel from "@rolldown/plugin-babel";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	server: { host: "127.0.0.1", allowedHosts: [".trycloudflare.com", "desktop.tail65a6c6.ts.net"] },
	plugins: [
		tailwindcss(),
		tanstackStart({
			prerender: {
				enabled: true,
				crawlLinks: false,
				filter: ({ path }) =>
					[
						studioSite.routes.home,
						studioSite.routes.pricing,
						studioSite.routes.gallery,
						studioSite.routes.contact
					].includes(path)
			},
			sitemap: { enabled: true, host: "https://vertigovisuals.au" }
		}),
		viteReact(),
		nitro(),
		babel({ presets: [reactCompilerPreset()] })
	]
});

export default config;
