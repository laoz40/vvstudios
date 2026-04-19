import type { ReactFormExtendedApi } from "@tanstack/react-form";
import { createContext, useContext } from "react";
import type { FormAsyncValidateOrFn, FormValidateOrFn } from "@tanstack/form-core";
import { type BookingFormValues } from "#/features/booking-form/lib/form-shared";

type BookingFormValidator = FormValidateOrFn<BookingFormValues> | undefined;
type BookingFormAsyncValidator = FormAsyncValidateOrFn<BookingFormValues> | undefined;

export type BookingFormApi = ReactFormExtendedApi<
	BookingFormValues,
	BookingFormValidator,
	BookingFormValidator,
	BookingFormAsyncValidator,
	BookingFormValidator,
	BookingFormAsyncValidator,
	BookingFormValidator,
	BookingFormAsyncValidator,
	BookingFormValidator,
	BookingFormAsyncValidator,
	BookingFormAsyncValidator,
	unknown
>;

export const bookingFormContext = createContext<BookingFormApi | null>(null);

export function useBookingFormContext() {
	const formApi = useContext(bookingFormContext);

	if (!formApi) {
		throw new Error("useBookingFormContext must be used within bookingFormContext.Provider");
	}

	return formApi;
}
