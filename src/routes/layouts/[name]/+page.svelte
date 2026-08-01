<script lang="ts">
	import { afterNavigate, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LayoutExpandedView from '$lib/components/LayoutExpandedView.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { decodeLayoutDetail } from '$lib/layoutDetails';
	import { layoutDetailsStore } from '$lib/layoutDetailsStore.svelte';
	import { untrack } from 'svelte';

	const { data } = $props();
	const detail = $derived(data.detail ? decodeLayoutDetail(data.detail, data.layoutName) : null);
	const layout = $derived(detail?.layout);
	let disabledMappingIds = $state<string[]>([]);

	filterStore.enterLayoutDetailRoute();

	afterNavigate(() => {
		if (!page.url.search) return;
		replaceState(resolve('/layouts/[name]', { name: data.layoutName }), page.state);
	});

	function backToLayouts(event: MouseEvent) {
		if (!page.state.fromLayoutIndex) return;
		event.preventDefault();
		history.back();
	}

	$effect(() => {
		const compact = data.detail;
		const expectedName = data.layoutName;
		if (compact) untrack(() => layoutDetailsStore.hydrate(compact, expectedName));
	});
</script>

<svelte:head>
	<title>{layout ? `${layout.name} · Emulayout` : 'Layout not found · Emulayout'}</title>
</svelte:head>

{#if detail}
	<LayoutExpandedView
		layout={detail.layout}
		authorName={detail.authorName}
		likeCount={detail.likeCount}
		onBackToLayouts={backToLayouts}
		compactCminiStats={detail.stats.cmini}
		compactCyanophageStats={detail.stats.cyanophage}
		compactMana2Stats={detail.stats.mana2}
		inputProfile={detail.inputProfile}
		{disabledMappingIds}
		onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
	/>
{:else}
	<section class="layout-not-found" aria-labelledby="layout-not-found-title">
		<h2 id="layout-not-found-title">Layout not found</h2>
		<p>No layout named “{data.layoutName}” is in the current catalog.</p>
		<a href={resolve('/')} onclick={backToLayouts}>Back to layouts</a>
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
