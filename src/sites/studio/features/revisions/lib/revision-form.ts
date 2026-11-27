import {
	validateRevisionFeedbackField,
	type RevisionFeedbackRowFieldErrors,
	type RevisionFeedbackRowInput
} from "#/domain/revisions/rules";
import { exhaustiveCheck } from "#/lib/result";

interface DraftRow {
	id: number;
	timestamp: string;
	note: string;
	clipNumber: string;
}

type FormSubmissionState =
	| { kind: "editing" }
	| { kind: "confirming"; validatedRows: RevisionFeedbackRowInput[] }
	| { kind: "submitting"; validatedRows: RevisionFeedbackRowInput[] };

export interface RevisionFormState {
	nextRowId: number;
	rows: DraftRow[];
	rowErrors: RevisionFeedbackRowFieldErrors[];
	formError: string | null;
	submission: FormSubmissionState;
}

export type RevisionFormAction =
	| { type: "add_row" }
	| { type: "remove_row"; id: number }
	| { type: "update_field"; id: number; field: "timestamp" | "note" | "clipNumber"; value: string }
	| {
			type: "blur_field";
			id: number;
			field: "timestamp" | "note" | "clipNumber";
			requiresClipNumber: boolean;
	  }
	| {
			type: "validation_failed";
			formError: string | null;
			rowErrors: RevisionFeedbackRowFieldErrors[];
	  }
	| { type: "open_confirm"; validatedRows: RevisionFeedbackRowInput[] }
	| { type: "close_confirm" }
	| { type: "start_submit" }
	| { type: "submit_failed" }
	| { type: "reset" };

export function createInitialRevisionFormState(): RevisionFormState {
	return {
		nextRowId: 2,
		rows: [{ id: 1, timestamp: "", note: "", clipNumber: "" }],
		rowErrors: [{}],
		formError: null,
		submission: { kind: "editing" }
	};
}

function removeDraftRow(state: RevisionFormState, id: number): RevisionFormState {
	if (state.rows.length <= 1) return state;

	const index = state.rows.findIndex((row) => row.id === id);

	if (index === -1) return state;

	return {
		...state,
		rows: state.rows.filter((_, idx) => idx !== index),
		rowErrors: state.rowErrors.filter((_, idx) => idx !== index),
		formError: null
	};
}

function updateDraftRowField(
	state: RevisionFormState,
	action: Extract<RevisionFormAction, { type: "update_field" }>
): RevisionFormState {
	const index = state.rows.findIndex((row) => row.id === action.id);

	if (index === -1) return state;

	return {
		...state,
		rows: state.rows.map((row, idx) =>
			idx === index ? { ...row, [action.field]: action.value } : row
		),
		rowErrors: state.rowErrors.map((rowError, idx) =>
			idx === index ? { ...rowError, [action.field]: undefined } : rowError
		),
		formError: null
	};
}

function validateBlurredRowField(
	state: RevisionFormState,
	action: Extract<RevisionFormAction, { type: "blur_field" }>
): RevisionFormState {
	const index = state.rows.findIndex((row) => row.id === action.id);

	if (index === -1) return state;

	const row = state.rows[index];

	if (row === undefined) return state;

	const fieldError = validateRevisionFeedbackField(
		action.field,
		row[action.field],
		action.requiresClipNumber
	);

	return {
		...state,
		rowErrors: state.rowErrors.map((rowError, idx) =>
			idx === index ? { ...rowError, [action.field]: fieldError } : rowError
		)
	};
}

function transitionSubmission(
	state: RevisionFormState,
	from: FormSubmissionState["kind"],
	to: FormSubmissionState["kind"]
): RevisionFormState {
	if (state.submission.kind !== from) return state;

	if (to === "editing") {
		return { ...state, submission: { kind: "editing" } };
	}

	if (state.submission.kind === "editing") return state;

	return { ...state, submission: { kind: to, validatedRows: state.submission.validatedRows } };
}

export function revisionFormReducer(
	state: RevisionFormState,
	action: RevisionFormAction
): RevisionFormState {
	switch (action.type) {
		case "add_row":
			return {
				...state,
				nextRowId: state.nextRowId + 1,
				rows: [...state.rows, { id: state.nextRowId, timestamp: "", note: "", clipNumber: "" }],
				rowErrors: [...state.rowErrors, {}],
				formError: null
			};

		case "remove_row":
			return removeDraftRow(state, action.id);

		case "update_field":
			return updateDraftRowField(state, action);

		case "blur_field":
			return validateBlurredRowField(state, action);

		case "validation_failed":
			return {
				...state,
				formError: action.formError,
				rowErrors: action.rowErrors,
				submission: { kind: "editing" }
			};

		case "open_confirm":
			return {
				...state,
				formError: null,
				rowErrors: state.rows.map(() => ({})),
				submission: { kind: "confirming", validatedRows: action.validatedRows }
			};

		case "close_confirm":
			return transitionSubmission(state, "confirming", "editing");

		case "start_submit":
			return transitionSubmission(state, "confirming", "submitting");

		case "submit_failed":
			return transitionSubmission(state, "submitting", "confirming");

		case "reset":
			return createInitialRevisionFormState();

		default:
			return exhaustiveCheck(action);
	}
}
