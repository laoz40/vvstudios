import { Link } from "@tanstack/react-router";
import { studioSite } from "#/config/sites";
import type { ADDON_SECTIONS } from "#studio/features/booking-form/lib/booking-form-model";

type BookingAddonSectionTitle = (typeof ADDON_SECTIONS)[number]["title"];

const sectionDescriptions = {
	"Production Add-ons": "Enhance your recording session.",
	"Editing Services":
		"Choose long-form editing services for your content.",
	"Clip Services":
		"Choose short-form clip services for your social media content."
} as const satisfies Record<BookingAddonSectionTitle, string>;

type BookingAddonSectionDescriptionProps = { sectionTitle: BookingAddonSectionTitle };

export function BookingAddonSectionDescription({
	sectionTitle
}: BookingAddonSectionDescriptionProps) {
	const description = sectionDescriptions[sectionTitle];

	if (sectionTitle === "Production Add-ons") {
		return description;
	}

	return (
		<>
			{description}{" "}
			<Link
				to={studioSite.routes.pricing}
				hash="editing-services"
				className="accent-link"
				rel="noreferrer"
				target="_blank">
				Learn more
			</Link>
			.
		</>
	);
}
