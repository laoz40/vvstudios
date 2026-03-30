export type FreeTourContent = {
	ctaLabel: string;
	url: string;
	modalDialogLabel: string;
	modalCloseLabel: string;
	modalIframeTitle: string;
};

const freeTourUrl = import.meta.env.PUBLIC_FREE_TOUR_URL;

if (!freeTourUrl)
	throw new Error("Missing required env var: PUBLIC_FREE_TOUR_URL");

export const freeTourContent: FreeTourContent = {
	ctaLabel: "Take free tour",
	url: freeTourUrl,
	modalDialogLabel: "Take a free tour",
	modalCloseLabel: "Close",
	modalIframeTitle: "Free studio tour booking",
};
