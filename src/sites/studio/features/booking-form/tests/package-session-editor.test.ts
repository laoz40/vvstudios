/**
 * Package scheduling draft integrity.
 *
 * 1. Date changes invalidate the previous time
 *    A time chosen for one day cannot remain selected for a different day.
 *
 * 2. Recording space changes remove incompatible add-ons
 *    Remote Podcast remains selected for supported spaces and clears for Music Setup.
 *
 * 3. Switching sessions replaces the draft
 *    The next session cannot inherit the previous session's time, notes, or add-ons.
 */
import { expect, test } from "vitest";
import {
	initialPackageSessionEditorState,
	reducePackageSessionEditor
} from "#studio/features/booking-form/lib/package-session-editor-machine";

test("changing the booking date requires choosing a time again", () => {
	const editing = reducePackageSessionEditor(initialPackageSessionEditorState, {
		type: "sessionChosen",
		sessionKey: "session-1",
		draft: {
			selectedDateValue: "2026-11-02",
			selectedTime: "10:00",
			selectedService: "Table Setup",
			selectedNotes: "Two guests",
			selectedRemotePodcast: false
		}
	});

	const changed = reducePackageSessionEditor(editing, {
		type: "dateChanged",
		dateValue: "2026-11-03"
	});

	const reselected = reducePackageSessionEditor(changed, { type: "timeChanged", time: "14:00" });

	expect(changed.selectedDateValue).toBe("2026-11-03");
	expect(changed.selectedTime).toBe("");
	expect(reselected.selectedDateValue).toBe("2026-11-03");
	expect(reselected.selectedTime).toBe("14:00");
});

test("switching to Music Setup removes Remote Podcast", () => {
	const editing = reducePackageSessionEditor(initialPackageSessionEditorState, {
		type: "sessionChosen",
		sessionKey: "session-1",
		draft: {
			selectedDateValue: "2026-11-02",
			selectedTime: "10:00",
			selectedService: "Table Setup",
			selectedNotes: "",
			selectedRemotePodcast: true
		}
	});

	const supported = reducePackageSessionEditor(editing, {
		type: "serviceChanged",
		service: "Armchair Setup"
	});

	const music = reducePackageSessionEditor(supported, {
		type: "serviceChanged",
		service: "Music Setup"
	});

	expect(supported.selectedService).toBe("Armchair Setup");
	expect(supported.selectedRemotePodcast).toBe(true);
	expect(music.selectedService).toBe("Music Setup");
	expect(music.selectedRemotePodcast).toBe(false);
});

test("switching sessions replaces the previous booking draft", () => {
	const first = reducePackageSessionEditor(initialPackageSessionEditorState, {
		type: "sessionChosen",
		sessionKey: "session-1",
		draft: {
			selectedDateValue: "2026-11-02",
			selectedTime: "10:00",
			selectedService: "Table Setup",
			selectedNotes: "Two guests",
			selectedRemotePodcast: true
		}
	});

	const closed = reducePackageSessionEditor(first, { type: "editorClosed" });

	const second = reducePackageSessionEditor(closed, {
		type: "sessionChosen",
		sessionKey: "session-2",
		draft: {
			selectedDateValue: "",
			selectedTime: "",
			selectedService: "Music Setup",
			selectedNotes: "Solo recording",
			selectedRemotePodcast: false
		}
	});

	expect(closed.kind).toBe("closed");
	expect(closed.activeSessionKey).toBe(null);
	expect(closed.selectedNotes).toBe("Two guests");
	expect(second).toEqual({
		kind: "editing",
		activeSessionKey: "session-2",
		selectedDateValue: "",
		selectedTime: "",
		selectedService: "Music Setup",
		selectedNotes: "Solo recording",
		selectedRemotePodcast: false
	});
});
