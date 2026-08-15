<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		/** `id` of the dialog title element (`aria-labelledby` target). */
		titleId: string;
		/** Plain title text; ignored when `title` snippet is provided. */
		title?: string;
		onClose: () => void;
		/** Extra classes on the title heading. */
		titleClass?: string;
		/** Optional native tooltip, used only when a title can be visually truncated. */
		titleTooltip?: string;
		/** Optional trailing content before the close button. */
		actions?: Snippet;
		/** Bottom border under the title. Omit for compact confirmations. */
		divider?: boolean;
	}

	let {
		titleId,
		title = '',
		onClose,
		titleClass = '',
		titleTooltip,
		actions,
		divider = true
	}: Props = $props();
</script>

<div
	class={['modal-header flex items-center justify-between gap-3 px-5 py-4', divider && 'border-b']}
	style={divider ? 'border-color: var(--border);' : undefined}
>
	<h2
		id={titleId}
		class="text-lg font-semibold min-w-0 {titleClass}"
		style="color: var(--text-primary);"
		title={titleTooltip}
	>
		{title}
	</h2>
	{#if actions}
		{@render actions()}
	{/if}
	<button
		type="button"
		onclick={onClose}
		class="flex size-8 shrink-0 items-center justify-center rounded-full transition-colors"
		style="color: var(--text-secondary);"
		aria-label="Close"
	>
		<svg
			class="size-5"
			fill="none"
			viewBox="0 0 24 24"
			stroke="currentColor"
			stroke-width="2"
			aria-hidden="true"
		>
			<path d="M18 6L6 18M6 6l12 12" />
		</svg>
	</button>
</div>
