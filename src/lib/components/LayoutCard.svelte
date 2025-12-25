<script lang="ts">
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layout: LayoutData;
		authorName: string;
		playgroundUrl: string;
	}

	const { layout, authorName, playgroundUrl }: Props = $props();

	let isExpanded = $state(false);
	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let cardElement: HTMLDivElement | null = $state(null);

	function toggleCard(event: Event) {
		// Don't toggle if clicking on the link
		if ((event.target as HTMLElement).closest('a')) {
			return;
		}
		isExpanded = !isExpanded;
		// Focus the textarea after it's rendered
		if (isExpanded) {
			setTimeout(() => {
				if (textareaElement) {
					textareaElement.focus();
				}
			}, 0);
		}
	}

	function closeCardAndRefocus() {
		isExpanded = false;
		setTimeout(() => {
			if (cardElement) {
				cardElement.focus();
			}
		}, 0);
	}
</script>

<div
	bind:this={cardElement}
	data-layout-name={layout.name}
	class="p-5 rounded-xl transition-all duration-300 min-w-0 overflow-hidden cursor-pointer"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
	role="button"
	tabindex="0"
	onclick={(e) => toggleCard(e)}
	onkeydown={(e) => {
		// Only handle space/enter if the card itself is focused (not textarea)
		if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			toggleCard(e);
		}
	}}
>
	<div class="flex items-center gap-2 mb-1">
		<h2
			class="text-lg font-semibold flex-1 truncate"
			style="color: var(--text-primary);"
			title={layout.name}
		>
			{layout.name}
		</h2>
		<a
			href={playgroundUrl}
			class="shrink-0 transition-colors"
			style="color: var(--link);"
			aria-label="View layout details"
			onclick={(e) => e.stopPropagation()}
		>
			<svg
				class="size-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
				/>
			</svg>
		</a>
	</div>
	<p class="text-xs mb-3" style="color: var(--text-secondary);">
		{layout.board} · by {authorName}
	</p>
	<div class="overflow-x-auto -mx-5 px-5">
		<pre
			class="font-mono text-xs leading-relaxed tracking-widest whitespace-pre"
			style="color: var(--text-primary);">{layout.displayValue}</pre>
	</div>
	{#if isExpanded}
		<textarea
			bind:this={textareaElement}
			class="w-full mt-4 p-3 rounded-lg text-sm resize-none outline-none focus:ring-2 transition-all"
			style="
				background-color: var(--bg-primary);
				color: var(--text-primary);
				border: 1px solid var(--border);
				--tw-ring-color: var(--accent);
			"
			rows="4"
			placeholder="Test layout here..."
			onkeydown={(e) => {
				if (e.key === 'Escape') {
					e.preventDefault();
					closeCardAndRefocus();
				}
			}}
		></textarea>
	{/if}
</div>

