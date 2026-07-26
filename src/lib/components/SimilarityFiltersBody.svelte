<script lang="ts">
	import LayoutAutocomplete from '$lib/components/LayoutAutocomplete.svelte';
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

	const selectedReference = $derived(filterStore.similarReferenceName);

	function selectReference(name: string) {
		if (filterStore.similarReferenceName === name) return;
		filterStore.toggleSimilarReference(name);
	}
</script>

<div class="similarity-filters-body">
	<div>
		<div class="block text-sm mb-1" style="color: var(--text-secondary);">Layout name</div>
		<LayoutAutocomplete
			{layouts}
			id="similarity-layout-search"
			label="Layout name"
			placeholder="Search..."
			selected={selectedReference}
			onSelect={(name) => selectReference(name)}
			onClear={() => filterStore.clearSimilarReference()}
		/>
	</div>

	<div class="similarity-filters-fields">
		<div>
			<div class="block text-sm mb-1" style="color: var(--text-secondary);">Match percent</div>
			<div class="flex items-center gap-1.5 min-w-0">
				<select
					value={filterStore.similarityFilterOperator}
					onchange={(e) =>
						filterStore.setSimilarityFilterOperator(e.currentTarget.value as StatLimitOperator)}
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
					filterStore.setSimilarityMirrorMode(e.currentTarget.value as SimilarityMirrorMode)}
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
</div>

<style>
	.similarity-filters-body {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.similarity-filters-fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}
</style>
