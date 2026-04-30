import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
	"send booking reminder emails",
	{ hours: 1 },
	internal.reminders.sendDueBookingReminderEmails,
	{},
);

export default crons;
