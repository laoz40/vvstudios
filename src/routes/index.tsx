import { PlaceholderPage } from "#/components/PlaceholderPage";
import { createFileRoute } from "@tanstack/react-router";
import { LandingFaq } from "#/components/landing/LandingFaq";
import { LandingGallery } from "#/components/landing/LandingGallery";
import { LandingHero } from "#/components/landing/LandingHero";
import { Separator } from "#/components/ui/separator";

export const Route = createFileRoute("/")({
	head: () => ({
		meta: [
			{
				title: "Podcast Studio Hire in South West Sydney | VV Podcast Studio",
			},
			{
				name: "description",
				content:
					"Hire a professional podcast studio in South West Sydney. VV Podcast Studio helps business owners, creators, and entrepreneurs record polished podcast and video content in Macquarie Fields.",
			},
		],
	}),
	component: HomePage,
});

function HomePage() {
	return (
		<main className="-mt-28 md:-mt-32">
			<LandingHero />
			<LandingGallery />
			<Separator className="mx-auto my-4 max-w-6xl" />
			<LandingFaq />
		</main>
	);
}
