import { useState } from "react";
import { Button } from "#/components/ui/button";
import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import { Modal } from "#studio/components/Modal";
import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";

interface PackageSessionDetailsModalProps {
	packageData: NonNullable<FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]>;
}

export function PackageSessionDetailsModal({ packageData }: PackageSessionDetailsModalProps) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<>
			<Button
				type="button"
				variant="outline"
				size="sm"
				className="border-foreground/15 bg-background/30 py-1! text-xs! tracking-wider text-foreground/85 uppercase shadow-md hover:bg-background/30 hover:text-primary"
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
				<dl className="grid gap-2 text-sm">
					<div className="flex gap-8">
						<dt className="shrink-0 text-muted-foreground">Session duration</dt>
						<dd className="font-medium">{packageData.duration}</dd>
					</div>
					<div className="flex gap-8">
						<dt className="shrink-0 text-muted-foreground">Recording space</dt>
						<dd className="font-medium">Choose a space for each session.</dd>
					</div>
					{packageData.addons.length > 0 ? (
						<div className="flex gap-8">
							<dt className="shrink-0 text-muted-foreground">Add-ons</dt>
							<dd className="font-medium">
								{formatEditingAddonList(packageData.addons, packageData)}
							</dd>
						</div>
					) : null}
				</dl>
			</Modal>
		</>
	);
}
