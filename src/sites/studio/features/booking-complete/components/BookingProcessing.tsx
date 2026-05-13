import type { ReactNode } from "react";

export function BookingProcessing(): ReactNode {
	return (
		<section className="flex flex-col items-center justify-center gap-4 py-20 text-center">
			<div
				className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary"
				aria-hidden="true"
			/>
			<span className="text-2xl font-semibold">Checking booking status</span>
		</section>
	);
}
