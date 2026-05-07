import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	server: {
		allowedHosts: [".trycloudflare.com"],
	},
	plugins: [
		tailwindcss(),
		tanstackStart({
			prerender: {
				enabled: true,
				crawlLinks: false,
				filter: ({ path }) => ["/", "/pricing", "/gallery", "/contact"].includes(path),
			},
			sitemap: {
				enabled: true,
				host: "https://vertigovisuals.com.au",
			},
		}),
		viteReact(),
		nitro(),
		babel({ presets: [reactCompilerPreset()] }),
	],
});

export default config;
