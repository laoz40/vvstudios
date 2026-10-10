import { cronJobs } from "convex/server";
import { internal } from "#convex/_generated/api";

const crons = cronJobs();

// 23:00 UTC is 09:00 AEST or 10:00 AEDT, keeping reminders in the Sydney morning.
crons.daily(
	"send due reminder emails",
	{ hourUTC: 23 },
	internal.sessions.sessionReminders.sendDueReminders,
	{}
);

export default crons;
