const lastUpdated = "17 May 2026";

const sections = [
	{
		title: "Information we collect",
		body: "When you make a booking or contact us, we may collect your name, phone number, email address, account or business name, ABN if provided, booking details, selected services, add-ons, and any notes you choose to send us.",
	},
	{
		title: "How we use your information",
		body: "We use your information to manage bookings, process payments, send invoices, confirmations and reminders, respond to enquiries, prevent misuse, and keep business, accounting and legal records.",
	},
	{
		title: "Payments",
		body: "Payments are processed by Stripe. We do not store full card details. We may keep payment references, such as Stripe session or payment IDs, for booking, support and record-keeping purposes.",
	},
	{
		title: "Service providers",
		body: "We use trusted third-party services where needed to operate the website and booking process, including Stripe for payments, Google Calendar for scheduling, Vercel for analytics and performance monitoring, and Google Search Console for search performance and indexing insights. These providers may process information only as needed to provide their services.",
	},
	{
		title: "Website data",
		body: "We may collect basic website usage and performance information through Vercel Analytics and Speed Insights. Google Search Console may provide us with aggregated search and indexing information, such as search queries, page impressions, clicks and technical indexing status. The booking page may also temporarily store your saved booking details in your browser local storage, such as contact details and selected booking options, so you do not need to re-enter them during the booking process. You can clear this browser storage if you want to remove saved booking details from your device.",
	},
	{
		title: "Sharing and retention",
		body: "We do not sell your personal information. Using analytics, performance monitoring, search console, payment, scheduling and hosting providers to operate this website is not a sale of personal information by us. We only share information with service providers, when required by law, or when needed to protect our business and customers. We keep booking and invoice records for as long as reasonably needed for bookings, support, accounting, tax and legal purposes.",
	},
	{
		title: "Your choices",
		body: "You can contact us to request access to, correction of, or deletion of your personal information where legally available. You can also clear this website's local storage through your browser settings to remove saved booking details from your own device.",
	},
	{
		title: "Security",
		body: "We take reasonable steps to protect personal information, but no website or online service can be guaranteed to be completely secure.",
	},
] as const;

export function PrivacyPolicyPage() {
	return (
		<main className="px-4 py-12 md:px-10 md:py-16">
			<div className="mx-auto max-w-4xl space-y-10">
				<h1 className="text-center text-4xl font-brand font-black tracking-tight md:text-6xl uppercase">
					Privacy Policy
				</h1>

				<div className="space-y-8">
					{sections.map((section) => (
						<section
							key={section.title}
							className="space-y-2">
							<h2 className="text-xl font-bold tracking-tight">{section.title}</h2>
							<p className="text-muted-foreground leading-relaxed">{section.body}</p>
						</section>
					))}
				</div>
				<p className="text-muted-foreground text-sm">Last updated: {lastUpdated}</p>
			</div>
		</main>
	);
}
