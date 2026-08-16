export const PERMISSIONS = [
	"view:sessions",
	"view:packages",
	"view:sensitive-booking-data",
	"update:deliverables",
	"send:deliverables-email",
	"assign:session-editor",
	"update:editor-access",
	"edit:sessions",
	"archive:sessions",
	"delete:sessions",
	"create:reschedule-links",
	"update:payment-status",
	"create:invoices",
	"send:invoice-emails",
	"update:availability"
] as const;

export type Permission = (typeof PERMISSIONS)[number];
export type Role = "admin" | "editor";

export const ROLE_PERMISSIONS = {
	admin: PERMISSIONS,
	editor: ["view:sessions", "update:deliverables"]
} as const satisfies Record<Role, readonly Permission[]>;

export function hasPermission(permissions: readonly Permission[], permission: Permission): boolean {
	return permissions.includes(permission);
}
