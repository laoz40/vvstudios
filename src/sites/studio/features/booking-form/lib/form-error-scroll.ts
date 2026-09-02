import { BOOKING_ADDON_QUANTITY_FIELD_NAMES } from "#studio/features/booking-form/lib/booking-form-model";

const BOOKING_FORM_ERROR_FIELD_ORDER = [
	"bookingMode",
	"packageSize",
	"service",
	"duration",
	"addons",
	...BOOKING_ADDON_QUANTITY_FIELD_NAMES,
	"date",
	"time",
	"name",
	"phone",
	"accountName",
	"abn",
	"email",
	"notes"
];

type BookingFormRef = { current: HTMLFormElement | null };

export function scrollToFirstBookingFormError(formRef: BookingFormRef) {
	requestAnimationFrame(() => {
		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		for (const fieldName of BOOKING_FORM_ERROR_FIELD_ORDER) {
			const fieldContainer = formRef.current?.querySelector<HTMLElement>(
				`[data-field-name="${fieldName}"]`
			);
			const fieldError = fieldContainer?.querySelector<HTMLElement>('[data-slot="field-error"]');

			if (fieldContainer && fieldError) {
				fieldContainer.scrollIntoView({
					behavior: prefersReducedMotion ? "auto" : "smooth",
					block: "center"
				});
				return;
			}
		}
	});
}
