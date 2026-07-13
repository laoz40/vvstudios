import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";

export function AddonCompatibilityModal({ onClose }: { onClose: () => void }) {
	return (
		<Modal
			open
			onOpenChange={onClose}
			title="4K isn't available for remote podcasts"
			closeLabel="Close"
			footer={
				<Button
					type="button"
					className="w-full"
					onClick={onClose}>
					Got it
				</Button>
			}>
			<div className="grid gap-4 text-sm leading-6 text-muted-foreground">
				<p>
					Remote Podcast runs through Riverside.fm using our studio setup, which does not support
					our 4K recording addon.
				</p>
				<p className="font-bold text-destructive">
					Selecting Remote Podcast will remove 4K UDH Recording.
				</p>
			</div>
		</Modal>
	);
}
