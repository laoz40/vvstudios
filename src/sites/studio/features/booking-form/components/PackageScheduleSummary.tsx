import type { GetPackageByTokenResult } from "#convex/packageScheduling";
import { formatEditingAddonList } from "#studio/features/booking-form/lib/editing-addon-quantities";

interface PackageScheduleSummaryProps {
	packageData: NonNullable<GetPackageByTokenResult[1]>;
}

export function PackageScheduleSummary({ packageData }: PackageScheduleSummaryProps) {
	return (
		<section className="mt-10 text-sm text-card-foreground">
			<h2 className="text-xs! font-semibold text-primary uppercase md:text-sm!">
				Package session details
			</h2>
			<dl className="mt-4 grid gap-2">
				<div className="flex gap-8">
					<dt className="shrink-0 text-muted-foreground">Session</dt>
					<dd className="font-medium">
						{packageData.service} ({packageData.duration})
					</dd>
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
		</section>
	);
}
