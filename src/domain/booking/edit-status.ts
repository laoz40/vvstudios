export const EDIT_IN_PROGRESS_STATUSES = ["downloading", "editing", "uploading"] as const;

export const EDIT_WORK_STATUSES = ["not_started", ...EDIT_IN_PROGRESS_STATUSES] as const;

export type EditWorkStatus = (typeof EDIT_WORK_STATUSES)[number];
