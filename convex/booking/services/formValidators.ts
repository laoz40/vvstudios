import { bookingDetailsFieldsValidator as bookingDetailsFieldsValidatorLib } from "#convex/booking/lib/formFields";
import {
	bookingAddonQuantitiesValidator as bookingAddonQuantitiesValidatorLib,
	bookingAddonsValidator as bookingAddonsValidatorLib
} from "#convex/booking/lib/addonQuantities";

export const bookingAddonQuantitiesValidator = bookingAddonQuantitiesValidatorLib;

export const bookingAddonsValidator = bookingAddonsValidatorLib;

export const bookingDetailsFieldsValidator = bookingDetailsFieldsValidatorLib;
