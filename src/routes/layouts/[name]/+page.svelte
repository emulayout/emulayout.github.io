<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PathnameWithSearchOrHash } from '$app/types';
	import LayoutExpandedView from '$lib/components/LayoutExpandedView.svelte';
	import { compileLayoutInputRegistry } from '$lib/layoutInputBehaviors';
	import { layoutStatsStore } from '$lib/layoutStatsStore.svelte';

	const { data } = $props();
	const layout = $derived(data.layouts.find((candidate) => candidate.name === data.layoutName));
	const authorById = $derived(
		new Map<number, string>(
			Object.entries(data.authorsData).map(([name, id]) => [id as number, name])
		)
	);
	const inputProfiles = $derived(compileLayoutInputRegistry(data.inputBehaviors, data.layouts));
	const statsMaps = $derived({ ...data.statsMaps, ...layoutStatsStore.maps });
	const returnTarget = $derived(`/${page.url.search}` as PathnameWithSearchOrHash);
	let disabledMappingIds = $state<string[]>([]);

	const authorName = $derived(layout ? (authorById.get(layout.user) ?? 'Unknown') : 'Unknown');
	const likeCount = $derived(layout ? (data.likesData[layout.name] ?? 0) : 0);
</script>

<svelte:head>
	<title>{layout ? `${layout.name} · Emulayout` : 'Layout not found · Emulayout'}</title>
</svelte:head>

{#if layout}
	<LayoutExpandedView
		{layout}
		{authorName}
		{likeCount}
		returnSearch={page.url.search}
		compactCminiStats={statsMaps.cmini?.[layout.name]}
		compactCyanophageStats={statsMaps.cyanophage?.[layout.name]}
		compactMana2Stats={statsMaps.mana2?.[layout.name]}
		inputProfile={inputProfiles.get(layout.name)}
		{disabledMappingIds}
		onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
	/>
{:else}
	<section class="layout-not-found" aria-labelledby="layout-not-found-title">
		<h2 id="layout-not-found-title">Layout not found</h2>
		<p>No layout named “{data.layoutName}” is in the current catalog.</p>
		<a href={resolve(returnTarget)}>Back to layouts</a>
	</section>
{/if}

<style>
	.layout-not-found {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
		max-width: 32rem;
		padding: 1.5rem 0.25rem;
		color: var(--text-secondary);
	}

	.layout-not-found h2,
	.layout-not-found p {
		margin: 0;
	}

	.layout-not-found h2 {
		color: var(--text-primary);
		font-size: 1.25rem;
	}

	.layout-not-found a {
		color: var(--accent);
		font-weight: 600;
	}
</style>
