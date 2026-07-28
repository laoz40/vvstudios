import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 23:00 UTC is 09:00 AEST or 10:00 AEDT, keeping reminders in the Sydney morning.
crons.cron(
	"send due reminder emails",
	"0 23 * * *",
	internal.sessionReminders.sendDueReminders,
	{}
);

export default crons;
