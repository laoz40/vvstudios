import { useState } from "react";
import { Button } from "#/components/ui/button";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import { Modal } from "#studio/components/Modal";
import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";
import { selectablePillButtonClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import { cn } from "#/lib/utils";

interface PackageSessionDetailsModalProps {
	packageData: NonNullable<FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]>;
}

export function PackageSessionDetailsModal({ packageData }: PackageSessionDetailsModalProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className={cn(selectablePillButtonClassName, "py-1! text-sm!")}
				onClick={() => {
					setIsOpen(true);
				}}>
				See Details
			</Button>
			<Modal
				open={isOpen}
				onOpenChange={setIsOpen}
				title="Your Package session details"
				closeLabel="Close package session details">
				<dl className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-2 text-sm">
					<dt className="text-muted-foreground">Session duration</dt>
					<dd className="font-medium">{packageData.duration}</dd>
					<dt className="text-muted-foreground">Recording space</dt>
					<dd className="font-medium">Choose a space for each session.</dd>
					{packageData.addons.length > 0 ? (
						<>
							<dt className="text-muted-foreground">Add-ons</dt>
							<dd className="font-medium">
								{formatEditingAddonList(packageData.addons, packageData)}
							</dd>
						</>
					) : null}
				</dl>
			</Modal>
		</>
	);
}
