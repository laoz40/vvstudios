import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";

export function InstagramRepostPrompt(): ReactNode {
	const [instagramHandle, setInstagramHandle] = useState("");

	function handleSubmit(event: FormEvent<HTMLFormElement>): void {
		event.preventDefault();

		if (!instagramHandle.trim()) {
			return;
		}

		toast.success("Thanks! We’ll keep an eye out for your post.");
		setInstagramHandle("");
	}

	return (
		<section className="rounded-lg border bg-background/60 p-4 shadow-sm">
			<div className="flex flex-col gap-3">
				<div className="flex flex-col gap-1">
					<h2 className="text-base font-semibold">Posting your studio content on Instagram?</h2>
					<p className="text-sm leading-normal text-muted-foreground">
						Send us your Instagram handle. If you post content made at VV Studios, we can repost it
						and help give your work free advertising.
					</p>
				</div>
				<form
					className="flex flex-col gap-2 sm:flex-row"
					onSubmit={handleSubmit}>
					<Input
						aria-label="Instagram handle"
						placeholder="@yourhandle"
						value={instagramHandle}
						onChange={(event) => setInstagramHandle(event.target.value)}
					/>
					<Button
						type="submit"
						className="sm:w-auto">
						Submit
					</Button>
				</form>
			</div>
		</section>
	);
}
