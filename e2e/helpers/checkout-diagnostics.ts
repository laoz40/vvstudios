import type { ConsoleMessage, Page } from "@playwright/test";
import { expectPaymentModal } from "./booking-form";

const diagnosticKinds = [
	"checkout-start-failed",
	"booking-slot-unavailable",
	"booking-rate-limited",
	"convex-return-serialization-error",
	"convex-error",
	"network-error",
	"javascript-error",
	"visible-checkout-error",
	"visible-booking-error",
	"visible-notification"
] as const;

type CheckoutDiagnosticKind = (typeof diagnosticKinds)[number];

type CheckoutObserver = { entries: string[]; observer: MutationObserver };

declare global {
	interface Window {
		checkoutFailureObserver?: CheckoutObserver;
	}
}

/** Maps untrusted browser text to fixed labels so reports never include payloads or customer data. */
export function classifyCheckoutDiagnostic(text: string): CheckoutDiagnosticKind {
	const normalized = text.toLowerCase();

	if (normalized.includes("time was just taken") || normalized.includes("time unavailable")) {
		return "booking-slot-unavailable";
	}

	if (normalized.includes("too many booking attempts") || normalized.includes("rate limit")) {
		return "booking-rate-limited";
	}

	if (normalized.includes("starting checkout") || normalized.includes("start checkout")) {
		return "checkout-start-failed";
	}

	if (normalized.includes("is not a supported convex type")) {
		return "convex-return-serialization-error";
	}

	if (normalized.includes("convex") || normalized.includes("server error")) {
		return "convex-error";
	}

	if (normalized.includes("network") || normalized.includes("fetch failed")) {
		return "network-error";
	}

	return "visible-notification";
}

function classifyConsoleError(message: ConsoleMessage): CheckoutDiagnosticKind {
	const text = message.text();
	const category = classifyCheckoutDiagnostic(text);

	return category === "visible-notification" ? "javascript-error" : category;
}

export async function captureCheckoutDiagnostics(page: Page) {
	const diagnostics = new Set<CheckoutDiagnosticKind>();

	const onConsole = (message: ConsoleMessage) => {
		if (message.type() === "error") {
			diagnostics.add(classifyConsoleError(message));
		}
	};

	const onPageError = () => diagnostics.add("javascript-error");

	page.on("console", onConsole);
	page.on("pageerror", onPageError);

	await page.evaluate(() => {
		const observed = new WeakSet<Element>();
		const entries: string[] = [];

		const record = (element: Element) => {
			if (
				!element.matches('[role="alert"], [data-sonner-toast][data-type="error"]') ||
				observed.has(element)
			) {
				return;
			}

			const text = element.textContent.toLowerCase();

			if (!text.trim()) return;

			observed.add(element);

			const category =
				text.includes("time was just taken") || text.includes("time unavailable")
					? "visible-booking-error"
					: text.includes("starting checkout") || text.includes("start checkout")
						? "visible-checkout-error"
						: "visible-notification";

			entries.push(category);
		};

		const observer = new MutationObserver((records) => {
			for (const mutation of records) {
				const target =
					mutation.target instanceof Element ? mutation.target : mutation.target.parentElement;

				const notification = target?.closest(
					'[role="alert"], [data-sonner-toast][data-type="error"]'
				);

				if (notification) record(notification);

				for (const node of mutation.addedNodes) {
					if (!(node instanceof Element)) continue;

					if (node.matches('[role="alert"], [data-sonner-toast][data-type="error"]')) record(node);

					for (const child of node.querySelectorAll(
						'[role="alert"], [data-sonner-toast][data-type="error"]'
					)) {
						record(child);
					}
				}
			}
		});

		window.checkoutFailureObserver = { entries, observer };
		observer.observe(document.documentElement, {
			childList: true,
			subtree: true,
			characterData: true
		});
	});

	let captured: readonly CheckoutDiagnosticKind[] | undefined;

	return {
		async dispose() {
			if (captured !== undefined) return captured;
			page.off("console", onConsole);
			page.off("pageerror", onPageError);

			const visibleDiagnostics = await page.evaluate(() => {
				const capture = window.checkoutFailureObserver;
				capture?.observer.disconnect();
				delete window.checkoutFailureObserver;

				return capture?.entries ?? [];
			});

			for (const diagnostic of visibleDiagnostics) {
				switch (diagnostic) {
					case "visible-booking-error":
					case "visible-checkout-error":
					case "visible-notification":
						diagnostics.add(diagnostic);
						break;
					default:
						break;
				}
			}

			captured = [...diagnostics];

			return captured;
		},
		format(values: readonly CheckoutDiagnosticKind[]) {
			return values.length === 0
				? "No browser console errors or visible failure notifications were captured."
				: `Browser diagnostics (safe categories only): ${values.join(", ")}.`;
		}
	};
}

export async function expectPaymentModalWithDiagnostics(
	page: Page,
	capture: Awaited<ReturnType<typeof captureCheckoutDiagnostics>>,
	checkoutAction: () => Promise<void>
) {
	try {
		await checkoutAction();
		await expectPaymentModal(page);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Payment modal did not open.";
		const values = await capture.dispose();
		throw new Error(`${message}\n${capture.format(values)}`, { cause: error });
	}
}
