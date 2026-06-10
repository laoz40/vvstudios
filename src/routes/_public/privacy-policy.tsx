import { createFileRoute } from "@tanstack/react-router";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { StudioLegalPage } from "#studio/components/StudioLegalPage";

const lastUpdated = "21 May 2026";

const sections = [
	{
		title: "Information we collect",
		body: "When you make a booking or contact us, we may collect your name, phone number, email address, account or business name, ABN if provided, booking details, selected services, add-ons, and any notes you choose to send us."
	},
	{
		title: "How we use information",
		body: "We use your information to manage bookings, process payments, send invoices, confirmations and reminders, respond to enquiries, prevent misuse, provide customer support, follow up on booking enquiries or incomplete bookings, and keep operational, accounting and legal records."
	},
	{
		title: "Payments and incomplete bookings",
		body: "Payments are processed by Stripe. We do not store full card details. We may keep payment references, including Stripe checkout session or payment IDs, for booking, customer support, operational records, fraud prevention, dispute resolution, analytics, accounting, tax and legal compliance purposes. We may also retain records of abandoned, expired or cancelled booking requests and related payment session information where a booking form has been submitted or a Stripe checkout session has been created."
	},
	{
		title: "Service providers and website data",
		body: "We use trusted third-party services where needed to operate the website and booking process, including Stripe for payments, Google Calendar for scheduling, Vercel for analytics and performance monitoring, and Google Search Console for search performance and indexing insights. These providers may process information only as needed to provide their services. Analytics and search performance information may include aggregated or technical usage data such as page visits, device and browser information, page performance metrics, search impressions and indexing status. The booking page may also temporarily store your saved booking details in your browser local storage, such as contact details and selected booking options, so you do not need to re-enter them during the booking process. You can clear this browser storage if you want to remove saved booking details from your device."
	},
	{
		title: "Sharing, retention and your choices",
		body: "We do not sell or rent your personal information. Using analytics, performance monitoring, search, payment, scheduling and hosting providers to operate this website is not a sale of personal information by us. We only share information with service providers, when required by law, or when needed to protect our business and customers. We retain information only for as long as reasonably necessary for bookings, customer support, operational records, legal compliance, accounting, tax and dispute resolution purposes. You can contact us to request access to, correction of, or deletion of your personal information where legally available. You can also clear this website's local storage through your browser settings to remove saved booking details from your own device."
	},
	{
		title: "Security",
		body: "While we take reasonable technical and organisational measures to protect information, no method of electronic storage or transmission over the internet can be guaranteed completely secure."
	}
] as const;

export const Route = createFileRoute("/_public/privacy-policy")({
	head: () => buildSeoHead(seoMetadata.privacyPolicy),
	component: PrivacyPolicyPage
});

function PrivacyPolicyPage() {
	return (
		<StudioLegalPage
			title="Privacy Policy"
			sections={sections}
			lastUpdated={lastUpdated}
		/>
	);
}
