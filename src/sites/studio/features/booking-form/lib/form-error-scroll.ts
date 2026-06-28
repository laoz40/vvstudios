const BOOKING_FORM_ERROR_FIELD_ORDER = [
	"bookingMode",
	"packageSize",
	"service",
	"duration",
	"addons",
	"essentialEditQuantity",
	"clipsPackageQuantity",
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
		for (const fieldName of BOOKING_FORM_ERROR_FIELD_ORDER) {
			const fieldContainer = formRef.current?.querySelector<HTMLElement>(
				`[data-field-name="${fieldName}"]`
			);
			const fieldError = fieldContainer?.querySelector<HTMLElement>('[data-slot="field-error"]');

			if (fieldContainer && fieldError) {
				fieldContainer.scrollIntoView({ behavior: "smooth", block: "center" });
				return;
			}
		}
	});
}
