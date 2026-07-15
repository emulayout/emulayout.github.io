<script lang="ts">
	import {
		buildBotStatsDiffBlockLines,
		buildCyanophageStatsDiffBlockLines,
		CYANOPHAGE_ANALYZER,
		decodeCyanophageStats,
		decodeMonkeyracerStats,
		deriveBotStats,
		deriveCyanophageStats,
		type StatsAnalyzer,
		type StatsBlockSegment
	} from '$lib/layoutStats';
	import type { CompactCyanophageStats, CompactLayoutStats } from '$lib/layout';

	interface Props {
		newCompact?: CompactLayoutStats | CompactCyanophageStats;
		oldCompact?: CompactLayoutStats | CompactCyanophageStats;
		analyzer: StatsAnalyzer;
		statsLoading?: boolean;
	}

	let { newCompact, oldCompact, analyzer, statsLoading = false }: Props = $props();

	const isCyanophage = $derived(analyzer === CYANOPHAGE_ANALYZER);

	const diffLines = $derived.by((): StatsBlockSegment[][] | null => {
		if (!newCompact || !oldCompact) return null;

		if (isCyanophage) {
			const newer = decodeCyanophageStats(newCompact as CompactCyanophageStats);
			const older = decodeCyanophageStats(oldCompact as CompactCyanophageStats);
			if (!newer || !older) return null;
			return buildCyanophageStatsDiffBlockLines(
				deriveCyanophageStats(newer),
				deriveCyanophageStats(older)
			);
		}

		const newer = decodeMonkeyracerStats(newCompact as CompactLayoutStats);
		const older = decodeMonkeyracerStats(oldCompact as CompactLayoutStats);
		if (!newer || !older) return null;
		return buildBotStatsDiffBlockLines(deriveBotStats(newer), deriveBotStats(older));
	});
</script>

{#if diffLines}
	<div class="stats-block">
		{#each diffLines as line, lineIndex (lineIndex)}
			<div class="stats-block-line">
				{#each line as segment, segmentIndex (segmentIndex)}
					<span
						class:stats-diff-better={segment.tone === 'better'}
						class:stats-diff-worse={segment.tone === 'worse'}
					>{segment.text}</span
					>
				{/each}
			</div>
		{/each}
	</div>
{:else}
	<pre
		class="stats-block stats-block--unavailable"
	>{statsLoading ? 'LOADING STATS\n…' : 'STATS UNAVAILABLE\ncannot compare this pair'}</pre>
{/if}
