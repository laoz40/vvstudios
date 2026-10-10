import { bookingDetailsFieldsValidator as bookingDetailsFieldsValidatorLib } from "#convex/booking/lib/bookingFormFields";
import {
	bookingAddonQuantitiesValidator as bookingAddonQuantitiesValidatorLib,
	bookingAddonsValidator as bookingAddonsValidatorLib
} from "#convex/booking/lib/bookingAddonQuantities";

export const bookingAddonQuantitiesValidator = bookingAddonQuantitiesValidatorLib;

export const bookingAddonsValidator = bookingAddonsValidatorLib;

export const bookingDetailsFieldsValidator = bookingDetailsFieldsValidatorLib;
