import { bookingDetailsFieldsValidator as bookingDetailsFieldsValidatorLib } from "#convex/lib/booking/bookingFormFields";
import {
	bookingAddonQuantitiesValidator as bookingAddonQuantitiesValidatorLib,
	bookingAddonsValidator as bookingAddonsValidatorLib
} from "#convex/lib/booking/bookingAddonQuantities";

export const bookingAddonQuantitiesValidator = bookingAddonQuantitiesValidatorLib;

export const bookingAddonsValidator = bookingAddonsValidatorLib;

export const bookingDetailsFieldsValidator = bookingDetailsFieldsValidatorLib;
