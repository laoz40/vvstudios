import { ok, safeTry } from "neverthrow";
import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { mutation, query } from "#convex/_generated/server";
import { requirePermission } from "#convex/shared/services/auth";
import {
	loadEditorActiveJobs,
	loadEmployeeRoster,
	saveEmployeeAccess,
	saveEmployeeDeliveryPermission,
	saveEmployeeNotes
} from "#convex/employees/services/employeeManagement";

export const listEmployees = query({
	args: { isActive: v.boolean(), paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const result = await loadEmployeeRoster(ctx, args);

		if (result.isErr()) throw new ConvexError(result.error);

		return result.value;
	}
});

export const listActiveJobs = query({
	args: { tokenIdentifier: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");
			const activeJobs = yield* loadEditorActiveJobs(ctx, args.tokenIdentifier);

			return ok(activeJobs);
		}).match(tupleOk, tupleErr)
});

export const updateEmployeeNotes = mutation({
	args: { tokenIdentifier: v.string(), notes: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");
			const notes = yield* saveEmployeeNotes(ctx, args.tokenIdentifier, args.notes);

			return ok(notes);
		}).match(tupleOk, tupleErr)
});

export const updateEmployeeAccess = mutation({
	args: { tokenIdentifier: v.string(), isActive: v.boolean() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");
			const access = yield* saveEmployeeAccess(ctx, args.tokenIdentifier, args.isActive);

			return ok(access);
		}).match(tupleOk, tupleErr)
});

export const updateEmployeeDeliveryPermission = mutation({
	args: { tokenIdentifier: v.string(), canSendDeliverables: v.boolean() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "update:editor-access");

			const result = yield* saveEmployeeDeliveryPermission(
				ctx,
				args.tokenIdentifier,
				args.canSendDeliverables
			);

			return ok(result);
		}).match(tupleOk, tupleErr)
});
