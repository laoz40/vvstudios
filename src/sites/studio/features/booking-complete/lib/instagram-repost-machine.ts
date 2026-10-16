type InstagramRepostState = { kind: "editing" | "saving" | "submitted"; instagramHandle: string };

type InstagramRepostEvent =
	| { type: "handleChanged"; instagramHandle: string }
	| { type: "saveStarted" }
	| { type: "saveSucceeded" }
	| { type: "saveFailed" };

export const initialInstagramRepostState: InstagramRepostState = {
	kind: "editing",
	instagramHandle: ""
};

export function reduceInstagramRepost(
	state: InstagramRepostState,
	event: InstagramRepostEvent
): InstagramRepostState {
	switch (event.type) {
		case "handleChanged":
			return { ...state, instagramHandle: event.instagramHandle };
		case "saveStarted":
			return { ...state, kind: "saving" };
		case "saveSucceeded":
			return { ...state, kind: "submitted" };
		case "saveFailed":
			return { ...state, kind: "editing" };
		default: {
			const exhaustive: never = event;

			return exhaustive;
		}
	}
}
