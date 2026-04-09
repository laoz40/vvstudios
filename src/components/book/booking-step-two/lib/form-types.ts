import { z } from "zod";
import { BookingSchema } from "./zod";

export type BookingFormData = z.infer<typeof BookingSchema>;
export type BookingField = keyof BookingFormData;
export type BookingErrors = Partial<Record<BookingField, string>>;

export type PersistedBookingData = {
	selectedAddOns: string[];
	selectedVideoFormat: string;
	questionsOrRequests: string;
	fullName: string;
	phone: string;
	accountName: string;
	abn: string;
	email: string;
};

export type PersistedBookingEnvelope = {
	version: 1;
	updatedAt: string;
	data: PersistedBookingData;
};

export type SummaryItem = {
	label: string;
	value: string;
};

export type SummarySection = {
	title: string;
	items: SummaryItem[];
};

export type BookingSummaryData = {
	date: string;
	duration: string;
	videoFormatLabel: string;
	addOnLabels: string[];
	questionsOrRequests: string;
	fullName: string;
	phone: string;
	accountName: string;
	abn: string;
	email: string;
};

export type PricingLineItem = {
	label: string;
	amount: string;
	isAddOn?: boolean;
	isTotal?: boolean;
};
