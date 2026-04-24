import { bookingStepTwoContent } from "./booking";

export type PricingSession = {
	label: string;
	price: string;
	baseRatePrice: string;
	savings?: string;
	description: string;
	isMostPopular?: boolean;
};

export type PricingAddOn = {
	label: string;
	price: string;
	description: string;
};

const bookingDurationDescriptions = Object.fromEntries(
	bookingStepTwoContent.durationOptions.map((option) => [option.label, option.description]),
);

const bookingAddOnDescriptions = Object.fromEntries(
	bookingStepTwoContent.addOnOptions.map((option) => [option.label, option.description]),
);

export const pricingPageContent = {
	title: "Studio session pricing",
	lead: "Pricing is based on session duration. You can choose either the table setup or armchair setup.",
	sessions: [
		{
			label: "1 Hour",
			price: "$200",
			baseRatePrice: "$200",
			description: `${bookingDurationDescriptions["1 Hour"]}. Best for solo episodes or short interviews.`,
		},
		{
			label: "2 Hours",
			price: "$299",
			baseRatePrice: "$400",
			savings: "Save $101",
			description: `${bookingDurationDescriptions["2 Hours"]}. Great for interviews and longer conversations.`,
			isMostPopular: true,
		},
		{
			label: "3 Hours",
			price: "$399",
			baseRatePrice: "$600",
			savings: "Save $201",
			description: `${bookingDurationDescriptions["3 Hours"]}. Ideal for deeper sessions or content batching.`,
		},
	] satisfies PricingSession[],
	addOnsTitle: "Production add-ons",
	addOnsLead: "Each session includes a fully prepared space with three 4K Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting.",
	addOns: [
		{
			label: "4K UHD recording",
			price: "$49",
			description: bookingAddOnDescriptions["4K UHD Recording"],
		},
		{
			label: "Essential Edit",
			price: "$99",
			description: bookingAddOnDescriptions["Essential Edit"],
		},
		{
			label: "Clips Package",
			price: "$79",
			description: bookingAddOnDescriptions["Clips Package"],
		},
	] satisfies PricingAddOn[],
};
