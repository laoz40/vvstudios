import type { Doc, Id } from "#convex/_generated/dataModel";

type PackageSessionSummary = {
	_id: Id<"bookings">;
	date: string;
	time: string;
	sessionStartAt: number;
	notes: string;
	service: string;
	addons: Doc<"bookings">["addons"];
	googleEventId?: string;
};

export function buildPackageTokenCustomerView(
	packageRecord: Doc<"packages">,
	sessions: Doc<"bookings">[]
) {
	return {
		_id: packageRecord._id,
		name: packageRecord.name,
		email: packageRecord.email,
		duration: packageRecord.duration,
		addons: packageRecord.addons,
		essentialEditQuantity: packageRecord.essentialEditQuantity,
		completeEditQuantity: packageRecord.completeEditQuantity,
		clipsPackageQuantity: packageRecord.clipsPackageQuantity,
		handcraftedClipsQuantity: packageRecord.handcraftedClipsQuantity,
		packageSize: packageRecord.packageSize,
		expiresAt: packageRecord.expiresAt,
		defaultSpace: packageRecord.defaultSpace,
		sessions: sessions.map((session) => {
			const mappedSession: PackageSessionSummary = {
				_id: session._id,
				date: session.date,
				time: session.time,
				sessionStartAt: session.sessionStartAt,
				notes: session.notes ?? "",
				service: session.service,
				addons: session.addons
			};

			if (!session.googleEventId) {
				return mappedSession;
			}

			mappedSession.googleEventId = session.googleEventId;

			return mappedSession;
		})
	};
}
