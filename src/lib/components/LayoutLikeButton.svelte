<script lang="ts">
	import { layoutLikes } from '$lib/layoutLikes.svelte';

	const { name, likeCount }: { name: string; likeCount: number } = $props();
	const liked = $derived(layoutLikes.names.has(name));
	const count = $derived(likeCount + Number(liked));
	const countId = $props.id();
</script>

<button
	type="button"
	class="layout-like inline-flex items-center gap-1 text-xs tabular-nums shrink-0 rounded"
	aria-label={`Like ${name}`}
	aria-pressed={liked}
	aria-describedby={countId}
	onclick={() => layoutLikes.toggle(name)}
>
	<svg
		class="size-3.5 shrink-0"
		class:liked
		viewBox="0 0 24 24"
		fill={liked ? 'currentColor' : 'none'}
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path
			d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
		/>
	</svg>
	<span aria-hidden="true">{count}</span>
</button>
<span id={countId} class="sr-only">{count} likes</span>

<style>
	.layout-like {
		color: var(--text-secondary);
		cursor: pointer;
	}

	.layout-like:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}

	.liked {
		color: #ef4444;
	}
</style>
