<script lang="ts">
	import type { StatsBlockSegment } from '$lib/layoutStats';

	interface Props {
		lines: StatsBlockSegment[][] | null;
		fallback: string | null;
		mana2?: boolean;
		unavailable?: boolean;
		shrink?: boolean;
	}

	const { lines, fallback, mana2 = false, unavailable = true, shrink = false }: Props = $props();
</script>

{#if lines}
	<div class="stats-block" class:stats-block--mana2={mana2} class:shrink-0={shrink}>
		{#each lines as line, lineIndex (lineIndex)}
			<div class="stats-block-line">
				{#each line as segment, segmentIndex (segmentIndex)}
					<span
						class:stats-block-highlight={Boolean(segment.highlight)}
						class:stats-block-highlight--cmini={segment.highlight === 'cmini'}
						class:stats-block-highlight--cyanophage={segment.highlight === 'cyanophage'}
						class:stats-block-highlight--mana2={segment.highlight === 'mana2'}
						class:stats-block-highlight--sort={segment.highlight === 'sort'}>{segment.text}</span
					>
				{/each}
			</div>
		{/each}
	</div>
{:else}
	<pre
		class="stats-block"
		class:stats-block--mana2={mana2}
		class:stats-block--unavailable={unavailable}
		class:shrink-0={shrink}>{fallback}</pre>
{/if}
