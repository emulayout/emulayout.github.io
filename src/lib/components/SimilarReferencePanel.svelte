<script lang="ts">
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import {
		showsCyanophageStats,
		showsMana2Stats,
		showsMonkeyracerStats
	} from '$lib/layoutStats';
	import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likesData?: LayoutLikesMap;
		statsMaps?: StatsMaps;
	}

	const { layout, authorName, likesData = {}, statsMaps = {} }: Props = $props();
</script>

<div id="selected-layout" class="similar-reference-panel">
	<LayoutCard
		{layout}
		{authorName}
		likeCount={likesData[layout.name] ?? 0}
		compactMonkeyStats={showsMonkeyracerStats(filterStore.statsAnalyzer)
			? statsMaps.monkeyracer?.[layout.name]
			: undefined}
		compactCyanophageStats={showsCyanophageStats(filterStore.statsAnalyzer)
			? statsMaps.cyanophage?.[layout.name]
			: undefined}
		compactMana2Stats={showsMana2Stats(filterStore.statsAnalyzer)
			? statsMaps.mana2?.[layout.name]
			: undefined}
	/>
</div>
