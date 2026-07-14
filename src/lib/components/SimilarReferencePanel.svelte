<script lang="ts">
	import LayoutCard from '$lib/components/LayoutCard.svelte';
	import {
		filterStore,
		type SimilarityMirrorMode,
		type StatLimitOperator
	} from '$lib/filterStore.svelte';
	import { CYANOPHAGE_ANALYZER } from '$lib/layoutStats';
	import type { LayoutData, LayoutLikesMap, StatsMaps } from '$lib/layout';

	interface Props {
		layout: LayoutData;
		authorName: string;
		likesData?: LayoutLikesMap;
		statsMaps?: StatsMaps;
	}

	const { layout, authorName, likesData = {}, statsMaps = {} }: Props = $props();

	let selectedLayoutSection = $state<HTMLElement | undefined>(undefined);

	const compactStats = $derived.by(() => {
		const map =
			filterStore.statsAnalyzer === CYANOPHAGE_ANALYZER
				? statsMaps.cyanophage
				: statsMaps.monkeyracer;
		return map?.[layout.name];
	});

	const matchOperatorActive = $derived(filterStore.similarityFilterOperator !== 'gt');
	const matchValueActive = $derived(filterStore.similarityFilterValue.trim() !== '50');

	$effect(() => {
		if (!filterStore.scrollToSelectedLayout) return;
		if (!selectedLayoutSection) return;

		const section = selectedLayoutSection;
		let cancelled = false;
		let attempts = 0;

		function tryScroll() {
			if (cancelled || !filterStore.scrollToSelectedLayout) return;

			const sectionTop = section.getBoundingClientRect().top + window.scrollY - 10;

			// Only scroll up when the page is below the selected-layout section.
			if (window.scrollY <= sectionTop) {
				filterStore.clearScrollToSelectedLayout();
				return;
			}

			window.scrollTo(0, Math.max(0, sectionTop));
			attempts += 1;

			const aligned = Math.abs(section.getBoundingClientRect().top - 10) < 2;
			if (!aligned && attempts < 12) {
				requestAnimationFrame(tryScroll);
				return;
			}

			filterStore.clearScrollToSelectedLayout();
		}

		requestAnimationFrame(() => {
			requestAnimationFrame(tryScroll);
		});

		return () => {
			cancelled = true;
		};
	});
</script>

<div id="selected-layout" class="similar-reference-panel" bind:this={selectedLayoutSection}>
	<div class="flex flex-col gap-3">
		<LayoutCard
			{layout}
			{authorName}
			likeCount={likesData[layout.name] ?? 0}
			{compactStats}
		/>
		<div
			class="similarity-filter w-full p-3 rounded-xl"
			style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
		>
			<div class="text-sm font-medium mb-1" style="color: var(--text-secondary);">
				Similarity filters
			</div>
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
								border: 1px solid {matchOperatorActive ? 'var(--accent)' : 'var(--border)'};
								--tw-ring-color: var(--accent);
							"
							aria-label="Similarity comparison"
						>
							<option value="lt">Less than</option>
							<option value="gt">Greater than</option>
						</select>
						<input
							type="text"
							inputmode="decimal"
							value={filterStore.similarityFilterValue}
							oninput={(e) => filterStore.setSimilarityFilterValue(e.currentTarget.value)}
							class="w-11 px-1.5 py-1 rounded-lg text-xs text-right outline-none focus:ring-2"
							style="
								background-color: var(--input-bg);
								color: var(--text-primary);
								border: 1px solid {matchValueActive ? 'var(--accent)' : 'var(--border)'};
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
							border: 1px solid {filterStore.similarityWeightHomeKeys
							? 'var(--accent)'
							: 'var(--border)'};
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
							border: 1px solid {filterStore.similarityMirrorMode !== 'excluded'
							? 'var(--accent)'
							: 'var(--border)'};
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
	</div>
</div>
