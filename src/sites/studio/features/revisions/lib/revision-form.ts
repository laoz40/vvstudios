import {
	validateRevisionFeedbackField,
	type RevisionFeedbackRowFieldErrors
} from "#/domain/revisions/rules";
import { exhaustiveCheck } from "#/lib/result";

interface DraftRow {
	id: number;
	timestamp: string;
	note: string;
	clipNumber: string;
}

export interface RevisionFormState {
	nextRowId: number;
	rows: DraftRow[];
	rowErrors: RevisionFeedbackRowFieldErrors[];
	formError: string | null;
	submissionStatus: "editing" | "submitting";
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
	| { type: "start_submit" }
	| { type: "submit_failed" }
	| { type: "reset" };

export function createInitialRevisionFormState(): RevisionFormState {
	return {
		nextRowId: 2,
		rows: [{ id: 1, timestamp: "", note: "", clipNumber: "" }],
		rowErrors: [{}],
		formError: null,
		submissionStatus: "editing"
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
				submissionStatus: "editing"
			};

		case "start_submit":
			return {
				...state,
				formError: null,
				rowErrors: state.rows.map(() => ({})),
				submissionStatus: "submitting"
			};

		case "submit_failed":
			return { ...state, submissionStatus: "editing" };

		case "reset":
			return createInitialRevisionFormState();

		default:
			return exhaustiveCheck(action);
	}
}
