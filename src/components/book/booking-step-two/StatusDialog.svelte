<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog";

	type Props = {
		open?: boolean;
		title: string;
		status: string;
		dismissLabel: string;
		onClose: () => void;
	};

	let {
		open = $bindable(false),
		title,
		status,
		dismissLabel,
		onClose,
	}: Props = $props();
</script>

<Dialog bind:open>
	<DialogContent class="rounded-xl p-5 sm:max-w-lg sm:p-6">
		<DialogHeader class="gap-2">
			<DialogTitle class="text-xl">{title}</DialogTitle>
			<DialogDescription class="text-muted-foreground text-sm leading-6">
				{status}
			</DialogDescription>
		</DialogHeader>

		<DialogFooter class="sm:justify-end">
			<Button
				type="button"
				class="rounded-lg"
				onclick={onClose}>
				{dismissLabel}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
