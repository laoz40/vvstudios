import { useState } from "react";
import { createServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Textarea } from "#/components/ui/textarea";
import { Modal } from "#studio/components/Modal";
import { env } from "#/env";
import { err, ok } from "#/lib/errors";
import { escapeHtml, sendFeedbackEmail } from "#studio/lib/send-feedback-email";

const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((data: { message: string }) => data)
  .handler(async ({ data }) => {
    const message = data.message.trim();

    if (!message) {
      return err({ code: "INVALID_MESSAGE" });
    }

    const response = await sendFeedbackEmail({
      html: [
        "<p>You received new website feedback from the VV Studios website.</p>",
        "<p><strong>Message:</strong></p>",
        `<p>${escapeHtml(message).replaceAll("\n", "<br />")}</p>`,
      ].join(""),
      to: env.VITE_APP_CONTACT_EMAIL,
    });

    if (!response.ok) {
      return err({ code: "SEND_FAILED" });
    }

    return ok(undefined);
  });

export function GiveFeedbackDialog() {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = feedback.trim().length > 0 && !isSubmitting;

  const handleSubmit: React.ComponentProps<"form">["onSubmit"] = async (
    event,
  ) => {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);

    const [error] = await submitFeedback({
      data: { message: feedback },
    }).catch(() => err({ code: "SEND_FAILED" }));

    setIsSubmitting(false);

    if (error == null) {
      setFeedback("");
      setOpen(false);
      toast.success("Thanks for your feedback!");
      return;
    }

    switch (error.code) {
      case "INVALID_MESSAGE":
        toast.error("Please enter some feedback before submitting.");
        return;
      case "SEND_FAILED":
        toast.error("We couldn’t send your feedback. Please try again.");
        return;
      default:
        throw new Error(`Unknown error code`);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="link"
        className="accent-link h-auto p-0 text-sm!"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Send feedback
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Give us your feedback"
        description="Tell us what you don't like or anything we could improve to make the website experience better for you."
        closeLabel="Close feedback dialog"
        initialFocus="content"
        size="md"
      >
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <div className="grid gap-2">
            <label htmlFor="feedback-message" className="text-sm font-medium">
              Your feedback
            </label>
            <Textarea
              id="feedback-message"
              value={feedback}
              onChange={(event) => setFeedback(event.target.value)}
              placeholder="Tell us anything"
              rows={6}
              maxLength={2000}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Sending..." : "Submit"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
