/**
 * Dev dashboard seed data. Run against your dev deployment with:
 *   bun run convex:seed-dev
 * Optional counts: convex run devSeed:seedDashboard '{"sessionCount":150,"packageCount":50}'
 *
 * Uses internalMutation so it cannot be called from the client.
 */
import { v } from "convex/values";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { internalMutation } from "#convex/_generated/server";
import {
	buildBookingSearchBlob,
	buildPackageSearchBlob
} from "#convex/shared/lib/adminSearch/adminSearchBlob";

const SESSION_STATUSES_OTHER: Array<Doc<"bookings">["status"]> = [
	"pending_payment",
	"cancelled",
	"expired"
];

const PACKAGE_STATUSES_OTHER: Array<Doc<"packages">["status"]> = ["pending_payment", "expired"];

const SERVICES = ["Table Setup", "Armchair Setup", "Music Setup"] as const;

const DEFAULT_SESSION_COUNT = 150;

const DEFAULT_PACKAGE_COUNT = 50;

/** Extra synthetic contacts beyond SEED_PERSONAS for broader admin search. */
const GENERATED_PERSONA_COUNT = 46;

const FIRST_NAMES = [
	"Ava",
	"Blake",
	"Cameron",
	"Dakota",
	"Elliot",
	"Finn",
	"Georgia",
	"Hunter",
	"Ivy",
	"Jasper",
	"Kai",
	"Luna",
	"Mason",
	"Nora",
	"Oscar",
	"Piper",
	"Quinn",
	"Riley",
	"Sage",
	"Tessa"
] as const;

const LAST_NAMES = [
	"Anderson",
	"Baker",
	"Carter",
	"Dixon",
	"Edwards",
	"Fisher",
	"Graham",
	"Hayes",
	"Ingram",
	"Jensen",
	"Kerr",
	"Lambert",
	"Mason",
	"Nolan",
	"Owens",
	"Palmer",
	"Quinn",
	"Reed",
	"Shaw",
	"Tucker"
] as const;

const BUSINESS_SUFFIXES = ["Podcast", "Media", "Studio", "Audio", "Cast", "Talks"] as const;

const PACKAGE_SIZES = [4, 8, 12] as const;

type SeedPersona = {
	name: string;
	accountName: string;
	email: string;
	phone: string;
	instagramHandle?: string;
	abn?: string;
};

/** Distinct contacts for admin search (names, emails, phones, handles). */
const SEED_PERSONAS: SeedPersona[] = [
	{
		name: "Priya Sharma",
		accountName: "Brisbane Podcast Co",
		email: "priya@brispod.com.au",
		phone: "0412 345 678",
		instagramHandle: "@brisbane_podcast",
		abn: "51824753556"
	},
	{
		name: "Marcus Chen",
		accountName: "Moonlight Media",
		email: "marcus.chen@moonlight.media",
		phone: "0423 111 902",
		instagramHandle: "@moonlight_podcasts"
	},
	{
		name: "Alex Thompson",
		accountName: "Thompson & Wells",
		email: "alex@thompsonwells.com",
		phone: "0400 882 441",
		abn: "83110219627"
	},
	{
		name: "James O'Brien",
		accountName: "O'Brien Audio",
		email: "james.obrien@obrienaudio.net",
		phone: "0435 667 210"
	},
	{
		name: "James Ng",
		accountName: "Ng Creative",
		email: "j.ng@ngcreative.io",
		phone: "0411 203 998",
		instagramHandle: "@ngcreative",
		abn: "29679237913"
	},
	{
		name: "Sofia Martinez",
		accountName: "Voz Latina",
		email: "sofia@vozlatina.com",
		phone: "0456 778 301"
	},
	{
		name: "Liam Patterson",
		accountName: "Patterson Productions",
		email: "liam@pattersonprod.com.au",
		phone: "0428 990 112",
		abn: "67031345289"
	},
	{
		name: "Yuki Tanaka",
		accountName: "Tanaka Talks",
		email: "yuki.tanaka@gmail.com",
		phone: "0401 556 773",
		instagramHandle: "@tanaka_talks"
	},
	{
		name: "Emma Wilson",
		accountName: "Wilson Weekly",
		email: "emma.wilson@wilsonweekly.fm",
		phone: "0439 221 008"
	},
	{
		name: "Noah Williams",
		accountName: "Williams & Co",
		email: "noah@williamsandco.com",
		phone: "0417 334 556",
		abn: "12123123123"
	},
	{
		name: "Chloe Nguyen",
		accountName: "Nguyen Networks",
		email: "chloe@nguyennetworks.au",
		phone: "0422 887 190",
		instagramHandle: "@nguyen_networks"
	},
	{
		name: "Ethan Brooks",
		accountName: "Brooks Broadcasting",
		email: "ethan.brooks@brooksbc.com",
		phone: "0403 119 445"
	},
	{
		name: "Mia Johnson",
		accountName: "Johnson Media Group",
		email: "mia.johnson@jmg.studio",
		phone: "0451 602 337",
		abn: "53004085616"
	},
	{
		name: "Oliver Davies",
		accountName: "Davies Digital",
		email: "oliver@daviesdigital.com.au",
		phone: "0415 778 902"
	},
	{
		name: "Isabella Rossi",
		accountName: "Rossi Records",
		email: "isabella.rossi@rossirecords.it",
		phone: "0426 331 774",
		instagramHandle: "@rossi_records"
	},
	{
		name: "Henry Kim",
		accountName: "Kimcast",
		email: "henry@kimcast.io",
		phone: "0408 445 661",
		abn: "91432567890"
	},
	{
		name: "Charlotte Lee",
		accountName: "Lee Line Studios",
		email: "charlotte@leeline.studio",
		phone: "0433 902 118"
	},
	{
		name: "William Brown",
		accountName: "Brown Bag Podcast",
		email: "will.brown@brownbagpod.com",
		phone: "0419 556 203",
		instagramHandle: "@brownbagpod"
	},
	{
		name: "Amelia Taylor",
		accountName: "Taylor Talk",
		email: "amelia.taylor@taylortalk.fm",
		phone: "0420 667 891",
		abn: "11122233344"
	},
	{
		name: "Jack Morrison",
		accountName: "Morrison Mic",
		email: "jack@morrisonmic.com.au",
		phone: "0455 112 009"
	},
	{
		name: "Grace Campbell",
		accountName: "Campbell Content",
		email: "grace@campbellcontent.com",
		phone: "0402 889 334",
		instagramHandle: "@campbell_content"
	},
	{
		name: "Lucas Singh",
		accountName: "Singh Sound",
		email: "lucas.singh@singhsound.au",
		phone: "0413 778 556",
		abn: "99887766554"
	},
	{
		name: "Zoe Anderson",
		accountName: "Anderson Audio",
		email: "zoe@andersonaudio.net",
		phone: "0437 221 445"
	},
	{
		name: "Benjamin Wright",
		accountName: "Wright Wave",
		email: "ben.wright@wrightwave.com",
		phone: "0429 334 778",
		instagramHandle: "@wright_wave"
	},
	{
		name: "Harper Mitchell",
		accountName: "Mitchell Media",
		email: "harper@mitchellmedia.co",
		phone: "0416 902 331",
		abn: "22334455667"
	},
	{
		name: "Daniel Nguyen",
		accountName: "DN Podcasts",
		email: "daniel@dnpodcasts.com.au",
		phone: "0405 667 112"
	},
	{
		name: "Evelyn Scott",
		accountName: "Scott Stories",
		email: "evelyn.scott@scottstories.fm",
		phone: "0448 119 883",
		instagramHandle: "@scott_stories"
	},
	{
		name: "Matthew Hughes",
		accountName: "Hughes House",
		email: "matthew@hugheshouse.com",
		phone: "0410 556 902",
		abn: "44556677889"
	},
	{
		name: "Abigail Foster",
		accountName: "Foster Frequency",
		email: "abigail@fosterfreq.io",
		phone: "0424 778 119"
	},
	{
		name: "Samuel Clarke",
		accountName: "Clarke Casting",
		email: "sam.clarke@clarkecasting.com",
		phone: "0431 902 667",
		instagramHandle: "@clarke_casting"
	},
	{
		name: "Ella Murphy",
		accountName: "Murphy Mic Drop",
		email: "ella@murphymicdrop.com.au",
		phone: "0407 334 221",
		abn: "66778899001"
	},
	{
		name: "Ryan Cooper",
		accountName: "Cooper Commute",
		email: "ryan.cooper@coopercommute.net",
		phone: "0452 889 003"
	},
	{
		name: "Victoria Price",
		accountName: "Price Point Media",
		email: "victoria@pricepointmedia.com",
		phone: "0418 112 556",
		instagramHandle: "@pricepointmedia"
	},
	{
		name: "Nathan Reed",
		accountName: "Reed Room",
		email: "nathan.reed@reedroom.fm",
		phone: "0427 667 334",
		abn: "11223344556"
	},
	{
		name: "Hannah Green",
		accountName: "Green Room Guild",
		email: "hannah@greenroomguild.com",
		phone: "0409 221 778"
	}
];

type SeedDashboardResult = { bookingIds: Id<"bookings">[]; packageIds: Id<"packages">[] };

const SEED_PERSONA_POOL: SeedPersona[] = [
	...SEED_PERSONAS,
	...buildGeneratedPersonas(GENERATED_PERSONA_COUNT)
];

function buildGeneratedPersonas(count: number): SeedPersona[] {
	const personas: SeedPersona[] = [];

	for (let i = 0; i < count; i++) {
		const first = FIRST_NAMES[i % FIRST_NAMES.length] ?? "Ava";
		const last = LAST_NAMES[(i * 7 + 3) % LAST_NAMES.length] ?? "Anderson";
		const suffix = BUSINESS_SUFFIXES[(i * 11) % BUSINESS_SUFFIXES.length] ?? "Media";
		const slug = `${first}.${last}`.toLowerCase().replace(/'/g, "");
		const phonePart = String(10_000_000 + ((i * 13_371) % 90_000_000)).padStart(8, "0");

		const persona: SeedPersona = {
			name: `${first} ${last}`,
			accountName: `${last} ${suffix}`,
			email: `${slug}+seed${i}@seed-clients.example`,
			phone: `04${phonePart.slice(0, 2)} ${phonePart.slice(2, 5)} ${phonePart.slice(5, 8)}`
		};

		if (i % 4 === 0) {
			persona.instagramHandle = `@${slug.replace(".", "_")}`;
		}

		if (i % 5 === 0) {
			persona.abn = String(10_000_000_000 + i * 1_234_567).slice(0, 11);
		}

		personas.push(persona);
	}

	return personas;
}

/** Deterministic mix: frequent clients get most rows; others still appear for search breadth. */
function personaIndexForSeedRow(rowIndex: number, personaCount: number): number {
	const roll = mix32(rowIndex);
	const frequentClientCount = Math.min(18, personaCount);

	if (roll % 100 < 68) {
		return roll % frequentClientCount;
	}

	return frequentClientCount + (roll % (personaCount - frequentClientCount));
}

function mix32(value: number): number {
	let x = (value ^ 0x9e3779b9) >>> 0;
	x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
	x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;

	return (x ^ (x >>> 16)) >>> 0;
}

function seedSessionStatus(rowIndex: number): Doc<"bookings">["status"] {
	if (mix32(rowIndex + 1) % 100 < 90) {
		return "confirmed";
	}

	const other = SESSION_STATUSES_OTHER[mix32(rowIndex + 2) % SESSION_STATUSES_OTHER.length];

	return other ?? "confirmed";
}

function seedPackageStatus(rowIndex: number): Doc<"packages">["status"] {
	if (mix32(rowIndex + 3) % 100 < 88) {
		return "paid";
	}

	const other = PACKAGE_STATUSES_OTHER[mix32(rowIndex + 4) % PACKAGE_STATUSES_OTHER.length];

	return other ?? "paid";
}

export const seedDashboard = internalMutation({
	args: { sessionCount: v.optional(v.number()), packageCount: v.optional(v.number()) },
	handler: async (ctx, args): Promise<SeedDashboardResult> => {
		const sessionCount = args.sessionCount ?? DEFAULT_SESSION_COUNT;
		const packageCount = args.packageCount ?? DEFAULT_PACKAGE_COUNT;

		if (sessionCount < 0 || packageCount < 0) {
			throw new Error("sessionCount and packageCount must be non-negative");
		}

		const now = Date.now();
		const packageIds: Id<"packages">[] = [];
		const packageIdsByPersona = new Map<number, Id<"packages">[]>();

		const personaCount = SEED_PERSONA_POOL.length;

		await Promise.all(
			Array.from({ length: packageCount }, async (_, index) => {
				const personaIndex = personaIndexForSeedRow(index + 10_000, personaCount);
				const packageId = await insertSeedPackage(ctx, { index, now, personaIndex });
				packageIds.push(packageId);
				const existing = packageIdsByPersona.get(personaIndex) ?? [];
				existing.push(packageId);
				packageIdsByPersona.set(personaIndex, existing);
			})
		);

		const bookingIds: Id<"bookings">[] = [];

		await Promise.all(
			Array.from({ length: sessionCount }, async (_, index) => {
				const personaIndex = personaIndexForSeedRow(index, personaCount);
				const clientPackages = packageIdsByPersona.get(personaIndex);

				const packageId =
					clientPackages !== undefined && clientPackages.length > 0 && index % 3 === 0
						? clientPackages[Math.floor(index / 3) % clientPackages.length]
						: undefined;

				const bookingId = await insertSeedBooking(ctx, {
					index,
					now,
					personaIndex,
					packageId,
					sessionCount
				});

				bookingIds.push(bookingId);
			})
		);

		return { bookingIds, packageIds };
	}
});

async function insertSeedPackage(
	ctx: MutationCtx,
	args: { index: number; now: number; personaIndex: number }
): Promise<Id<"packages">> {
	const status = seedPackageStatus(args.index);
	const packageSize = PACKAGE_SIZES[args.index % PACKAGE_SIZES.length] ?? 8;
	const singleSessionAmount = 200;
	const packageSubtotalAmount = singleSessionAmount * packageSize;
	let discountPercent = 0;

	if (packageSize === 12) {
		discountPercent = 15;
	} else if (packageSize === 8) {
		discountPercent = 10;
	}

	const discountAmount = Math.round(packageSubtotalAmount * (discountPercent / 100));
	const totalDueAmount = packageSubtotalAmount - discountAmount;
	const createdAt = args.now - args.index * 3_600_000;

	const contact = seedContactFields(args.personaIndex);
	let receiptEmailStatus: "pending" | "sent" | undefined;

	if (status === "paid") {
		receiptEmailStatus = "sent";
	} else if (status === "pending_payment") {
		receiptEmailStatus = "pending";
	}

	const packageFields = {
		...contact,
		duration: "1h",
		// SAFETY: Seed packages start with no addons; empty array matches the table validator.
		addons: [] as Doc<"packages">["addons"],
		packageSize,
		singleSessionAmount,
		packageSubtotalAmount,
		discountPercent,
		discountAmount,
		totalDueAmount,
		status,
		archived: args.index % 11 === 0,
		createdAt,
		paidAt: status === "paid" ? createdAt + 60_000 : undefined,
		expiresAt: status === "paid" ? createdAt + 90 * 86_400_000 : undefined,
		receiptNumber:
			status === "paid"
				? `RCP-${contact.name.split(" ").pop()?.toUpperCase() ?? "PKG"}-${String(args.index).padStart(3, "0")}`
				: undefined,
		receiptEmailStatus,
		notes: args.index % 5 === 0 ? `Follow up with ${contact.name} about scheduling` : undefined
	};

	return ctx.db.insert("packages", {
		...packageFields,
		searchBlob: buildPackageSearchBlob(packageFields)
	});
}

async function insertSeedBooking(
	ctx: MutationCtx,
	args: {
		index: number;
		now: number;
		personaIndex: number;
		packageId?: Id<"packages">;
		sessionCount: number;
	}
): Promise<Id<"bookings">> {
	const status = seedSessionStatus(args.index);
	const dayOffset = args.index - Math.floor(args.sessionCount / 2);
	const sessionStartAt = args.now + dayOffset * 86_400_000;
	const sessionDate = new Date(sessionStartAt);
	const date = sessionDate.toISOString().slice(0, 10);
	const time = `${String(9 + (args.index % 8)).padStart(2, "0")}:00`;

	const contact = seedContactFields(args.personaIndex);
	const service = SERVICES[args.index % SERVICES.length] ?? "Table Setup";

	const bookingFields = {
		...contact,
		date,
		time,
		sessionStartAt,
		duration: "1h",
		service,
		// SAFETY: Seed bookings start with no addons; empty array matches the table validator.
		addons: [] as Doc<"bookings">["addons"],
		status,
		archived: args.index % 13 === 0,
		pendingPaymentCreatedAt: sessionStartAt - 3_600_000,
		paymentCompletedAt: status === "confirmed" ? sessionStartAt - 1_800_000 : undefined,
		receiptNumber:
			status === "confirmed"
				? `SES-${contact.accountName.replace(/\W+/g, "").slice(0, 6).toUpperCase()}-${String(args.index).padStart(3, "0")}`
				: undefined,
		bookingConfirmedAt: status === "confirmed" ? sessionStartAt - 1_800_000 : undefined,
		packageId: args.packageId,
		editStatus:
			status === "confirmed"
				? (["to_edit", "editing", "review", "completed"] as const)[args.index % 4]
				: undefined,
		googleEventId: status === "confirmed" ? `seed-event-${args.index}` : undefined,
		googleCalendarId: status === "confirmed" ? "seed-calendar" : undefined,
		notes: args.index % 7 === 0 ? `${contact.accountName} requested teleprompter` : undefined
	};

	return ctx.db.insert("bookings", {
		...bookingFields,
		searchBlob: buildBookingSearchBlob(bookingFields)
	});
}

function seedContactFields(personaIndex: number) {
	const fallback = SEED_PERSONAS[0];

	if (fallback === undefined) {
		throw new Error("SEED_PERSONAS must not be empty");
	}

	const persona = SEED_PERSONA_POOL[personaIndex % SEED_PERSONA_POOL.length] ?? fallback;

	return {
		name: persona.name,
		phone: persona.phone,
		accountName: persona.accountName,
		email: persona.email,
		instagramHandle: persona.instagramHandle,
		abn: persona.abn
	};
}
