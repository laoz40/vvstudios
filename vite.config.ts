import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import babel from "@rolldown/plugin-babel";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
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
		babel({ presets: [reactCompilerPreset()] }),
	],
});

export default config;
