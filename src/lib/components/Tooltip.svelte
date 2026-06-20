<script lang="ts">
	interface Props {
		text: string;
	}

	let { text }: Props = $props();

	let showTooltip = $state(false);
</script>

<div class="relative inline-block">
	<button
		type="button"
		onmouseenter={() => (showTooltip = true)}
		onmouseleave={() => (showTooltip = false)}
		onfocus={() => (showTooltip = true)}
		onblur={() => (showTooltip = false)}
		class="size-4 rounded-full flex items-center justify-center transition-colors outline-none focus:ring-2"
		style="
			background-color: transparent;
			border: 1px solid var(--text-secondary);
			color: var(--text-secondary);
			--tw-ring-color: var(--accent);
		"
		aria-label="Help"
	>
		<span class="text-[10px] font-medium leading-none">?</span>
	</button>
	{#if showTooltip}
		<div
			class="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2 rounded-lg text-xs shadow-lg pointer-events-none"
			style="
				background-color: var(--bg-primary);
				border: 1px solid var(--border);
				color: var(--text-primary);
				width: 16rem;
				max-width: 16rem;
				word-wrap: break-word;
				overflow-wrap: break-word;
				white-space: normal;
			"
		>
			<span style="display: block; word-wrap: break-word; overflow-wrap: break-word;">{text}</span>
			<div
				class="absolute bottom-full left-1/2 -translate-x-1/2"
				style="
					border-left: 6px solid transparent;
					border-right: 6px solid transparent;
					border-bottom: 6px solid var(--border);
				"
			></div>
		</div>
	{/if}
</div>
