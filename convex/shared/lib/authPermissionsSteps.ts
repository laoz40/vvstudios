import { ok } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import {
	isAdminIdentity,
	adminUserAccessFromEditor,
	editorUserAccessFromProfile
} from "#convex/shared/lib/auth";

import type { UserIdentity } from "convex/server";

export function accessForIdentity(identity: UserIdentity, editor: Doc<"editorProfiles"> | null) {
	return isAdminIdentity(identity)
		? ok(adminUserAccessFromEditor(editor))
		: editorUserAccessFromProfile(editor);
}
