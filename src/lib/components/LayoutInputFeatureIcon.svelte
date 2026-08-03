<script lang="ts" module>
	export type LayoutInputFeature = 'repeat' | 'adaptive' | 'magic';
</script>

<script lang="ts">
	interface Props {
		feature: LayoutInputFeature;
	}

	const { feature }: Props = $props();
</script>

{#if feature === 'repeat'}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="m17 2 4 4-4 4" />
		<path d="M3 11V9a3 3 0 0 1 3-3h15" />
		<path d="m7 22-4-4 4-4" />
		<path d="M21 13v2a3 3 0 0 1-3 3H3" />
	</svg>
{:else if feature === 'adaptive'}
	<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<!-- Material Insights icon paths, inlined to avoid a MUI dependency. -->
		<path
			d="M21 8c-1.45 0-2.26 1.44-1.93 2.51l-3.55 3.56c-.3-.09-.74-.09-1.04 0l-2.55-2.55C12.27 10.45 11.46 9 10 9c-1.45 0-2.27 1.44-1.93 2.52l-4.56 4.55C2.44 15.74 1 16.55 1 18c0 1.1.9 2 2 2 1.45 0 2.26-1.44 1.93-2.51l4.55-4.56c.3.09.74.09 1.04 0l2.55 2.55C12.73 16.55 13.54 18 15 18c1.45 0 2.27-1.44 1.93-2.52l3.56-3.55c1.07.33 2.51-.48 2.51-1.93 0-1.1-.9-2-2-2"
		/>
		<path
			d="m15 9 .94-2.07L18 6l-2.06-.93L15 3l-.92 2.07L12 6l2.08.93zM3.5 11 4 9l2-.5L4 8l-.5-2L3 8l-2 .5L3 9z"
		/>
	</svg>
{:else}
	<svg
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<!-- Lucide sparkles style (inline; no icon pack dependency). -->
		<path
			d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"
		/>
	</svg>
{/if}
