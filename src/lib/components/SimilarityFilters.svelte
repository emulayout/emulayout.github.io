<script lang="ts">
	import LayoutAutocomplete from '$lib/components/LayoutAutocomplete.svelte';
	import Tooltip from '$lib/components/Tooltip.svelte';
	import {
		filterStore,
		type SimilarityMirrorMode,
		type StatLimitOperator
	} from '$lib/filterStore.svelte';
	import type { LayoutData } from '$lib/layout';

	interface Props {
		layouts: LayoutData[];
	}

	let { layouts }: Props = $props();

	const hasReference = $derived(filterStore.hasSimilarReference);

	function selectReference(name: string) {
		filterStore.toggleSimilarReference(name);
	}
</script>

<div
	class="similarity-filter w-full p-3 rounded-xl"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="filter-section-header">
		<div class="filter-section-header-start">
			<span class="filter-section-header-label">Similarity filter</span>
			<Tooltip text="Compare letter positions to a reference layout. Differing keys are highlighted on cards." />
		</div>
	</div>

	{#if !hasReference}
		<LayoutAutocomplete
			{layouts}
			id="similarity-layout-search"
			label="Find similarity reference layout"
			placeholder="Search layouts…"
			onSelect={(name) => selectReference(name)}
		/>
	{:else}
		<div class="flex flex-col gap-2">
			<div>
				<div class="block text-sm mb-1" style="color: var(--text-secondary);">Match percent</div>
				<div class="flex items-center gap-1.5 min-w-0">
					<select
						value={filterStore.similarityFilterOperator}
						onchange={(e) =>
							filterStore.setSimilarityFilterOperator(
								e.currentTarget.value as StatLimitOperator
							)}
						class="w-[6.75rem] shrink-0 px-1.5 py-1 rounded-lg text-xs outline-none cursor-pointer focus:ring-2"
						style="
							background-color: var(--input-bg);
							color: var(--text-primary);
							border: 1px solid var(--border);
							--tw-ring-color: var(--accent);
						"
						aria-label="Similarity comparison"
					>
						<option value="lt">Less than</option>
						<option value="gt">Greater than</option>
					</select>
					<input
						id="similarity-match-value"
						type="text"
						inputmode="decimal"
						value={filterStore.similarityFilterValue}
						oninput={(e) => filterStore.setSimilarityFilterValue(e.currentTarget.value)}
						onkeydown={(e) => {
							if (e.key === 'ArrowUp') {
								e.preventDefault();
								filterStore.nudgeSimilarityFilterValue(1);
							} else if (e.key === 'ArrowDown') {
								e.preventDefault();
								filterStore.nudgeSimilarityFilterValue(-1);
							}
						}}
						class="w-11 px-1.5 py-1 rounded-lg text-xs text-right outline-none focus:ring-2"
						style="
							background-color: var(--input-bg);
							color: var(--text-primary);
							border: 1px solid var(--border);
							--tw-ring-color: var(--accent);
						"
						placeholder="—"
						aria-label="Similarity percent limit"
					/>
					<span class="text-xs shrink-0" style="color: var(--text-caption);">%</span>
				</div>
			</div>
			<div>
				<label
					for="similarity-home-filter"
					class="block text-sm mb-1"
					style="color: var(--text-secondary);"
				>
					Scoring
				</label>
				<select
					id="similarity-home-filter"
					value={filterStore.similarityWeightHomeKeys ? 'weighted' : 'equal'}
					onchange={(e) =>
						filterStore.setSimilarityWeightHomeKeys(e.currentTarget.value === 'weighted')}
					class="w-full px-1.5 py-1 rounded-lg text-xs outline-none cursor-pointer focus:ring-2"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid var(--border);
						--tw-ring-color: var(--accent);
					"
				>
					<option value="equal">All keys count equally</option>
					<option value="weighted">Home row keys count double</option>
				</select>
			</div>
			<div>
				<label
					for="similarity-mirror-filter"
					class="block text-sm mb-1"
					style="color: var(--text-secondary);"
				>
					Mirror matches
				</label>
				<select
					id="similarity-mirror-filter"
					value={filterStore.similarityMirrorMode}
					onchange={(e) =>
						filterStore.setSimilarityMirrorMode(
							e.currentTarget.value as SimilarityMirrorMode
						)}
					class="w-full px-1.5 py-1 rounded-lg text-xs outline-none cursor-pointer focus:ring-2"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid var(--border);
						--tw-ring-color: var(--accent);
					"
				>
					<option value="excluded">Excluded</option>
					<option value="optional">Optional</option>
					<option value="required">Required</option>
				</select>
			</div>
		</div>
	{/if}
</div>
