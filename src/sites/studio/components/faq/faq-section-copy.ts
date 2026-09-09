type ContactFaqAnswerPart = { heading?: string; value: string };

type ContactFaqItem = { question: string; answerParts: readonly ContactFaqAnswerPart[] };

type FaqSectionCopy = { readonly title: string; readonly items: readonly ContactFaqItem[] };

export const faqSectionCopy: FaqSectionCopy = {
	title: "FAQs",
	items: [
		{
			question: "Can I film content other than podcasts?",
			answerParts: [
				{
					value:
						"Yes. The studio is suitable for podcasts, marketing content, voiceovers and music recordings. If you have a specific idea in mind, the setup can be adjusted to suit your creative needs."
				}
			]
		},
		{
			question: "Can I record remote podcasts here?",
			answerParts: [
				{
					value:
						"Yes! We use an industry-standard program Riverside.fm for remote podcast sessions, allowing you to professionally record guests from anywhere in the world while capturing studio-quality audio and video locally."
				},
				{
					value:
						"You’ll be able to speak with your guest live from the studio, see them on-screen via webcam, and record using professional studio microphones and cameras with high-quality separate recordings for easier editing."
				}
			]
		},
		{
			question: "What’s included when I book a session?",
			answerParts: [
				{
					value:
						"Each session includes a fully prepared space with three 4K Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting."
				}
			]
		},
		{
			question: "Is there a producer included?",
			answerParts: [
				{
					value:
						"Yes, every session provides an experienced AV producer who will guide you through the recording process so you can focus on what you do best."
				}
			]
		},
		{
			question: "How do I get the best results from my session?",
			answerParts: [
				{
					value:
						"Arrive with your topic locked in and a few key talking points ready. Clear preparation leads to stronger, more focused content."
				},
				{
					value:
						"Bring any notes, scripts, or references you want to use so we can build the session around them."
				}
			]
		},
		{
			question: "When should I arrive for my studio session?",
			answerParts: [
				{
					value:
						"We recommend arriving 15 minutes before your scheduled session time. This gives you time to settle in, get comfortable in the studio, and go through any final setup so your full booking time is dedicated to recording. Arriving early also helps ensure a smooth start to your session, especially if it’s your first time in the studio."
				}
			]
		},
		{
			question: "Do you offer editing and post-production?",
			answerParts: [
				{
					heading: "Rough Cut ($100) - ",
					value:
						"The minimum needed to make it postable. Mistakes removed, clean cuts between camera angles, no hook, no B-roll, no graphics."
				},
				{
					heading: "Complete Edit ($249) - ",
					value:
						"Opens strong and keeps people watching. Intro snippet with animated subtitles and B-roll, lower third graphics, and every filler word and silence cut for tight pacing."
				},
				{
					heading: "Clip Volume Pack ($80) - ",
					value:
						"Quick, ready-to-post clips, nothing fancy. 10 clips from your session with basic subtitles and vertical cropping. No B-roll, no animated subtitles, no custom graphics."
				},
				{
					heading: "Handcrafted Clips ($199) - ",
					value:
						"Five clips cut to stand out in the feed. Edited one at a time with animated subtitles, B-roll, and custom graphics."
				}
			]
		},
		{
			question: "How do I get the recorded content after the session?",
			answerParts: [
				{
					value:
						"After your session, all deliverables will be uploaded to your dedicated Google Drive folder and sent to you personally via email. You’ll receive a private link where you can access and download your files anytime. We recommend signing into your preferred Google account and starring the folder for easy future access."
				},
				{
					value:
						"Please note: Files are typically stored and available for 7 days after delivery, after which they may be archived or removed as part of our storage cycle"
				}
			]
		}
	]
} as const;
