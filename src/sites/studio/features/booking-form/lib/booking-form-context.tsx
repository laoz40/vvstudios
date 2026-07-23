import { createContext, useContext } from "react";
import type { ReactFormExtendedApi } from "@tanstack/react-form";
import {
	bookingSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

type BookingFormValidator = typeof bookingSchema;

export type BookingFormApi = ReactFormExtendedApi<
	BookingFormValues,
	undefined,
	undefined,
	undefined,
	BookingFormValidator,
	undefined,
	BookingFormValidator,
	undefined,
	undefined,
	undefined,
	undefined,
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
