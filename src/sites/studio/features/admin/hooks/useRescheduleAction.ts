import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { CreateAdminRescheduleLinkResult } from "#convex/bookingReschedule";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export function useRescheduleAction(booking: BookingRecord) {
	const createAdminRescheduleLink = useMutation(api.bookingReschedule.createAdminRescheduleLink);
	const [isRescheduleLinkDialogOpen, setIsRescheduleLinkDialogOpen] = useState(false);
	const [isGeneratingRescheduleLink, setIsGeneratingRescheduleLink] = useState(false);
	const [generatedRescheduleUrl, setGeneratedRescheduleUrl] = useState<string | null>(null);

	async function handleGenerateRescheduleLink() {
		setIsGeneratingRescheduleLink(true);

		const [error, result] = await tryCatch<CreateAdminRescheduleLinkResult>(
			createAdminRescheduleLink({ bookingId: booking._id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to create reschedule links.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;
				case "BOOKING_NOT_RESCHEDULABLE":
					toast.error("This booking cannot be rescheduled online.");
					break;
				case "RESCHEDULE_LINK_EXPIRED":
					toast.error("This booking is in the past, so a reschedule link cannot be created.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while creating the reschedule link.");
					break;
				default: {
					const _exhaustive: never = error;
					void _exhaustive;
					break;
				}
			}

			setIsGeneratingRescheduleLink(false);
			return;
		}

		setGeneratedRescheduleUrl(result.rescheduleUrl);
		void navigator.clipboard.writeText(result.rescheduleUrl);
		toast.success("Reschedule link created and copied.");
		setIsGeneratingRescheduleLink(false);
	}

	function openRescheduleLinkDialog() {
		setGeneratedRescheduleUrl(null);
		setIsRescheduleLinkDialogOpen(true);
	}

	function copyRescheduleLink() {
		if (!generatedRescheduleUrl) {
			return;
		}

		void navigator.clipboard.writeText(generatedRescheduleUrl);
		toast.success("Reschedule link copied.");
	}

	return {
		copyRescheduleLink,
		generatedRescheduleUrl,
		handleGenerateRescheduleLink,
		isGeneratingRescheduleLink,
		isRescheduleLinkDialogOpen,
		openRescheduleLinkDialog,
		setIsRescheduleLinkDialogOpen
	};
}
