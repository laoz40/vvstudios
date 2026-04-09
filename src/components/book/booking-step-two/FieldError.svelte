<script lang="ts">
	export type FieldErrorProps = {
		message?: string;
		id?: string;
	};

	let { message, id }: FieldErrorProps = $props();
</script>

{#if message}
	<p
		{id}
		class="text-destructive text-xs"
		role="alert">
		{message}
	</p>
{/if}
