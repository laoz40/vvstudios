import { describe, expect, test } from "vitest";
import { shouldConfirmSessionArchive } from "#studio/features/admin/lib/admin-sessions";

describe("shouldConfirmSessionArchive", () => {
	test("skips confirm when no editor is assigned", () => {
		expect(
			shouldConfirmSessionArchive({
				assignedEditorTokenIdentifier: undefined,
				editStatus: "editing"
			})
		).toBe(false);
	});

	test("skips confirm when deliverables are sent", () => {
		expect(
			shouldConfirmSessionArchive({
				assignedEditorTokenIdentifier: "editor|token",
				editStatus: "completed"
			})
		).toBe(false);
	});

	test("requires confirm when an editor is assigned and deliverables are not sent", () => {
		expect(
			shouldConfirmSessionArchive({
				assignedEditorTokenIdentifier: "editor|token",
				editStatus: "editing"
			})
		).toBe(true);
	});
});
