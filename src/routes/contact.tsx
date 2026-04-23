import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "#/components/contact/ContactPage";

export const Route = createFileRoute("/contact")({
	head: () => ({
		meta: [
			{
				title: "Contact VV Podcast Studio | VV Podcast Studio",
			},
			{
				name: "description",
				content:
					"Contact VV Podcast Studio to plan your next podcast or video session. Reach out for studio details, bookings, and production support in South West Sydney.",
			},
		],
	}),
	component: ContactPage,
});
