/**
 * Editor dashboard tests:
 *
 * 1. Editor session PII redaction
 *    The restricted editor sessions query returns useful row fields without phone, email,
 *    payment, or calendar identifiers.
 */
import type { UserIdentity } from "convex/server";
import { makeFunctionReference } from "convex/server";
import { describe, expect, test } from "vitest";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingAddon } from "#studio/features/booking-form/lib/booking-form-model";
import { createConvexTest } from "#convex/test.setup";

type TestClient = ReturnType<typeof createConvexTest>;
type AssignSessionEditorArgs = {
	bookingId: Id<"bookings">;
	editorTokenIdentifier: string | null;
	adminNotes: string;
};
type AssignmentResult = [{ reason: string } | null, null];
type EditorSessionProjection = {
	_id: Id<"bookings">;
	name: string;
	accountName: string;
	notes?: string;
	adminNotes?: string;
	editorNotes?: string;
	deliverablesClientNotes?: string;
	deliverablesDriveLink?: string;
	date: string;
	time: string;
	duration: string;
	service: string;
	addons: BookingAddon[];
	essentialEditQuantity?: string;
	completeEditQuantity?: string;
	clipsPackageQuantity?: string;
	handcraftedClipsQuantity?: string;
	editStatus?: "to_edit" | "editing" | "review" | "completed";
	driveFolders: null;
};
type EditorSessionsResult = {
	page: EditorSessionProjection[];
	isDone: boolean;
	continueCursor: string;
};

const assignSessionEditor = makeFunctionReference<
	"mutation",
	AssignSessionEditorArgs,
	AssignmentResult
>("sessions:assignSessionEditor");
const listEditorSessions = makeFunctionReference<
	"query",
	{ paginationOpts: { cursor: string | null; numItems: number } },
	EditorSessionsResult
>("sessions:listEditorSessions");
const paginationOpts = { cursor: null, numItems: 20 };

const adminIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|admin",
	subject: "admin",
	issuer: "https://clerk.example",
	publicMetadata: { role: "admin" }
};
const editorIdentity: UserIdentity = {
	tokenIdentifier: "https://clerk.example|editor-one",
	subject: "editor-one",
	issuer: "https://clerk.example",
	publicMetadata: { role: "editor" }
};

async function seedEditorProfile(t: TestClient, identity: UserIdentity): Promise<void> {
	await t.run(async (ctx) => {
		await ctx.db.insert("editorProfiles", {
			tokenIdentifier: identity.tokenIdentifier,
			displayName: identity.name ?? identity.subject,
			email: identity.email ?? `${identity.subject}@example.com`,
			isActive: true,
			lastAssignedAt: null,
			totalEdits: 0
		});
	});
}

async function seedBooking(t: TestClient, name: string): Promise<Id<"bookings">> {
	return await t.run(async (ctx) =>
		ctx.db.insert("bookings", {
			name,
			phone: "0400 000 000",
			accountName: `${name} Pty Ltd`,
			abn: "12 345 678 901",
			email: `${name.toLowerCase().replaceAll(" ", ".")}@example.com`,
			instagramHandle: `@${name.toLowerCase().replaceAll(" ", "")}`,
			date: "2030-02-03",
			time: "10:30",
			sessionStartAt: Date.parse("2030-02-02T23:30:00.000Z"),
			duration: "1 hour",
			service: "Remote Podcast",
			addons: [
				"Essential Edit",
				"Clip Volume Pack",
				"Teleprompter",
				"4K UHD Recording",
				"Remote Podcast"
			],
			essentialEditQuantity: "2",
			completeEditQuantity: "3",
			clipsPackageQuantity: "3",
			handcraftedClipsQuantity: "4",
			notes: `${name} production notes`,
			status: "confirmed",
			pendingPaymentCreatedAt: Date.parse("2030-01-01T00:00:00.000Z"),
			paidRemainingBalance: false,
			remainingBalanceAmount: 150,
			editStatus: "editing",
			stripeSessionId: `stripe-${name}`,
			stripePaymentIntentId: `payment-${name}`,
			googleEventId: `event-${name}`,
			googleCalendarId: `calendar-${name}`
		})
	);
}

async function assignBooking(t: TestClient, bookingId: Id<"bookings">): Promise<AssignmentResult> {
	return await t
		.withIdentity(adminIdentity)
		.mutation(assignSessionEditor, {
			bookingId,
			editorTokenIdentifier: editorIdentity.tokenIdentifier,
			adminNotes: "Use the wide camera angle"
		});
}

describe("restricted editor session query", () => {
	test("returns useful row fields without restricted booking data", async () => {
		const t = createConvexTest();
		await seedEditorProfile(t, editorIdentity);
		const bookingId = await seedBooking(t, "Safe Projection Customer");
		await assignBooking(t, bookingId);
		await t.run((ctx) =>
			ctx.db.patch(bookingId, {
				editorNotes: "Editor-only context",
				deliverablesClientNotes: "Client delivery context",
				deliverablesDriveLink: "https://drive.google.com/drive/folders/test"
			})
		);

		const result = await t
			.withIdentity(editorIdentity)
			.query(listEditorSessions, { paginationOpts });
		expect(result).toMatchObject({
			page: [
				{
					_id: bookingId,
					name: "Safe Projection Customer",
					accountName: "Safe Projection Customer Pty Ltd",
					notes: "Safe Projection Customer production notes",
					adminNotes: "Use the wide camera angle",
					editorNotes: "Editor-only context",
					deliverablesClientNotes: "Client delivery context",
					deliverablesDriveLink: "https://drive.google.com/drive/folders/test",
					date: "2030-02-03",
					time: "10:30",
					duration: "1 hour",
					service: "Remote Podcast",
					addons: [
						"Essential Edit",
						"Clip Volume Pack",
						"Teleprompter",
						"4K UHD Recording",
						"Remote Podcast"
					],
					essentialEditQuantity: "2",
					completeEditQuantity: "3",
					clipsPackageQuantity: "3",
					handcraftedClipsQuantity: "4",
					driveFolders: null,
					editStatus: "editing"
				}
			]
		});
		expect(result.page).toHaveLength(1);
		const session = result.page.at(0);
		if (session === undefined) throw new Error("Expected one editor session");
		expect(Object.keys(session).toSorted()).toEqual(
			[
				"_id",
				"accountName",
				"addons",
				"adminNotes",
				"clipsPackageQuantity",
				"completeEditQuantity",
				"date",
				"deliverablesClientNotes",
				"deliverablesDriveLink",
				"driveFolders",
				"duration",
				"editStatus",
				"editorNotes",
				"essentialEditQuantity",
				"handcraftedClipsQuantity",
				"name",
				"notes",
				"service",
				"time"
			].toSorted()
		);

		const serializedResult = JSON.stringify(result);
		for (const restrictedValue of [
			"0400 000 000",
			"12 345 678 901",
			"safe.projection.customer@example.com",
			"@safeprojectioncustomer",
			"stripe-Safe Projection Customer",
			"payment-Safe Projection Customer",
			"event-Safe Projection Customer",
			"calendar-Safe Projection Customer",
			"remainingBalanceAmount",
			"paidRemainingBalance",
			"packageId"
		]) {
			expect(serializedResult).not.toContain(restrictedValue);
		}
	});
});
