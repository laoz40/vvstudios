import { Check } from "lucide-react";
import { cn } from "#/lib/utils";

interface BookingSelectionCheckProps {
	className?: string;
}

export function BookingSelectionCheck({ className }: BookingSelectionCheckProps) {
	return (
		<Check
			aria-hidden="true"
			className={cn("size-5 shrink-0 text-primary", className)}
		/>
	);
}
