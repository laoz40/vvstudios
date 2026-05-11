const studioBasePath = "";
const parentBasePath = "/";

function withBasePath(basePath: string, path: string) {
	if (path === "/") {
		return basePath || "/";
	}

	return `${basePath}${path}`;
}

export const studioRoutes = {
	home: withBasePath(studioBasePath, "/"),
	book: withBasePath(studioBasePath, "/book"),
	bookingComplete: withBasePath(studioBasePath, "/booking-complete"),
	bookingExpired: withBasePath(studioBasePath, "/booking-expired"),
	contact: withBasePath(studioBasePath, "/contact"),
	gallery: withBasePath(studioBasePath, "/gallery"),
	login: withBasePath(studioBasePath, "/login"),
	admin: withBasePath(studioBasePath, "/admin"),
	pricing: withBasePath(studioBasePath, "/pricing"),
	privacyPolicy: withBasePath(studioBasePath, "/privacy-policy"),
} as const;

export const parentSite = {
	basePath: parentBasePath,
	name: "Vertigo Visuals",
	applicationName: "Vertigo Visuals",
	appleMobileWebAppTitle: "Vertigo Visuals",
	themeColor: "#1a1a1a",
	icons: {
		icon32: "/icons/parent/favicon-32x32.png",
		icon16: "/icons/parent/favicon-16x16.png",
		shortcut: "/icons/parent/favicon.ico",
		appleTouch: "/icons/parent/apple-touch-icon.png",
		manifest: "/parent.webmanifest",
	},
} as const;

export const studioSite = {
	basePath: studioBasePath,
	name: "VV Studios",
	applicationName: "VV Studios",
	appleMobileWebAppTitle: "VV Studios",
	themeColor: "#1a1a1a",
	routes: studioRoutes,
	icons: {
		icon32: "/icons/studio/favicon-32x32.png",
		icon16: "/icons/studio/favicon-16x16.png",
		shortcut: "/icons/studio/favicon.ico",
		appleTouch: "/icons/studio/apple-touch-icon.png",
		manifest: "/studio.webmanifest",
	},
} as const;
