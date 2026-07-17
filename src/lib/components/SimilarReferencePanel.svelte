<script lang="ts">
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { CYANOPHAGE_ANALYZER } from '$lib/layoutStats';
	import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likesData?: LayoutLikesMap;
		statsMaps?: StatsMaps;
	}

	const { layout, authorName, likesData = {}, statsMaps = {} }: Props = $props();

	const compactStats = $derived.by(() => {
		const map =
			filterStore.statsAnalyzer === CYANOPHAGE_ANALYZER
				? statsMaps.cyanophage
				: statsMaps.monkeyracer;
		return map?.[layout.name];
	});
</script>

<div id="selected-layout" class="similar-reference-panel">
	<LayoutCard {layout} {authorName} likeCount={likesData[layout.name] ?? 0} {compactStats} />
</div>
