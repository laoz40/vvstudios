import { createContext, useContext } from "react";
import type { ReactFormExtendedApi } from "@tanstack/react-form";
import {
	publicBookingSchema,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

type BookingFormValidator = typeof publicBookingSchema;

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

export const BookingFormContext = createContext<BookingFormApi | null>(null);

export function useBookingFormContext() {
	const formApi = useContext(BookingFormContext);

	if (!formApi) {
		throw new Error("useBookingFormContext must be used within BookingFormContext");
	}

	return formApi;
}
