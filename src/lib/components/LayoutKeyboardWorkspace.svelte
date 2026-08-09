<script lang="ts">
	import type { Snippet } from 'svelte';
	import InputMappingsPanel from '$lib/components/InputMappingsPanel.svelte';
	import LayoutKeyboardPreview from '$lib/components/LayoutKeyboardPreview.svelte';
	import type { LayoutData } from '$lib/layout';
	import type { DisplayCell } from '$lib/layoutDisplay';
	import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
	import type { LayoutKeyboardFeedback, LayoutKeyboardSwapPath } from '$lib/layoutKeyboardFeedback';

	const FULL_KEY_GAP_REM = 0.45;
	const COMPACT_KEY_GAP_REM = 0.25;
	const COMPACT_MAPPINGS_RESERVED_REM = 15.5;
	const WIDE_MAPPINGS_RESERVED_REM = 21.1875;

	interface Props {
		layout: LayoutData;
		rows: DisplayCell[][];
		feedback?: LayoutKeyboardFeedback;
		swapPaths?: readonly LayoutKeyboardSwapPath[];
		highlightedKeys?: readonly string[];
		highlightHomeKeys?: boolean;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
		showMappings?: boolean;
		optionsLabel?: string;
		header?: Snippet;
		options?: Snippet;
	}

	const {
		layout,
		rows,
		feedback,
		swapPaths = [],
		highlightedKeys = [],
		highlightHomeKeys = false,
		inputProfile,
		disabledMappingIds = [],
		onDisabledMappingIdsChange,
		showMappings = false,
		optionsLabel = 'Keyboard options',
		header,
		options
	}: Props = $props();

	function keyboardWidthTerms(): { keyUnits: number; gapCount: number } {
		if (layout.board === 'ortho' || layout.board === 'mini') {
			const mainRowMaxColumn = Math.max(
				9,
				...Object.values(layout.keys)
					.filter(({ row }) => row < 3)
					.map(({ col }) => col)
			);
			const rightSlotCount = Math.max(5, mainRowMaxColumn - 4);
			return {
				keyUnits: 5 + rightSlotCount + 0.48,
				gapCount: rightSlotCount + 3
			};
		}

		const rowTerms = rows.flatMap((row) => {
			const keys = row.filter((cell) => cell.slot !== null);
			if (keys.length === 0) return [];
			const rowNumber = Number(keys[0].slot?.split(',')[0]);
			if (rowNumber >= 3) return [];
			const rowOffset = rowNumber === 1 ? 0.28 : rowNumber === 2 ? 0.68 : 0;
			return [{ keyUnits: keys.length + rowOffset, gapCount: Math.max(keys.length - 1, 0) }];
		});

		return (
			rowTerms.sort(
				(a, b) =>
					b.keyUnits * 3.35 +
					b.gapCount * FULL_KEY_GAP_REM -
					(a.keyUnits * 3.35 + a.gapCount * FULL_KEY_GAP_REM)
			)[0] ?? { keyUnits: 10, gapCount: 9 }
		);
	}

	function fittedKeySize(
		keyUnits: number,
		gapCount: number,
		gapRem: number,
		reservedRem = 0
	): string {
		const containerShare = (100 / keyUnits).toFixed(5);
		const reservedShare = ((gapCount * gapRem + reservedRem) / keyUnits).toFixed(5);
		return `calc(${containerShare}cqw - ${reservedShare}rem)`;
	}

	const sizingStyle = $derived.by(() => {
		const { keyUnits, gapCount } = keyboardWidthTerms();
		return [
			`--keyboard-preview-key-size-stacked: ${fittedKeySize(keyUnits, gapCount, FULL_KEY_GAP_REM)}`,
			`--keyboard-preview-key-size-compact: ${fittedKeySize(keyUnits, gapCount, COMPACT_KEY_GAP_REM)}`,
			`--keyboard-preview-key-size-with-compact-mappings: ${fittedKeySize(keyUnits, gapCount, FULL_KEY_GAP_REM, COMPACT_MAPPINGS_RESERVED_REM)}`,
			`--keyboard-preview-key-size-with-wide-mappings: ${fittedKeySize(keyUnits, gapCount, FULL_KEY_GAP_REM, WIDE_MAPPINGS_RESERVED_REM)}`
		].join('; ');
	});

	const mappingsVisible = $derived(showMappings && Boolean(inputProfile));
</script>

<div class="layout-keyboard-workspace-region">
	<div class="layout-keyboard-workspace-main">
		<div
			class="layout-keyboard-workspace"
			class:layout-keyboard-workspace--with-mappings={mappingsVisible}
			style={sizingStyle}
		>
			<div class="layout-keyboard-workspace-cluster">
				<div class="layout-keyboard-workspace-preview-area">
					{#if header}
						<div class="layout-keyboard-workspace-header">
							{@render header()}
						</div>
					{/if}
					<LayoutKeyboardPreview
						{layout}
						{rows}
						{feedback}
						{swapPaths}
						{highlightedKeys}
						{highlightHomeKeys}
						horizontalAlignment="start"
					/>
				</div>
				{#if options}
					<div class="layout-keyboard-workspace-options" role="group" aria-label={optionsLabel}>
						{@render options()}
					</div>
				{/if}
			</div>
			{#if mappingsVisible && inputProfile}
				<div class="layout-keyboard-workspace-mappings">
					<InputMappingsPanel
						profile={inputProfile}
						{disabledMappingIds}
						{onDisabledMappingIdsChange}
					/>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.layout-keyboard-workspace-region {
		container: layout-keyboard-workspace / inline-size;
		min-width: 0;
	}

	.layout-keyboard-workspace {
		--keyboard-preview-key-size: min(3.35rem, var(--keyboard-preview-key-size-stacked));
		--keyboard-preview-key-gap: 0.45rem;
		display: grid;
		width: max-content;
		max-width: 100%;
		gap: clamp(0.75rem, 2vw, 1.5rem);
		min-width: 0;
	}

	.layout-keyboard-workspace-main,
	.layout-keyboard-workspace-mappings {
		min-width: 0;
	}

	.layout-keyboard-workspace-main {
		display: flex;
		justify-content: center;
	}

	.layout-keyboard-workspace-cluster {
		display: grid;
		grid-template-columns: minmax(0, max-content);
		width: max-content;
		max-width: 100%;
		min-width: 0;
	}

	.layout-keyboard-workspace-cluster :global(.keyboard-preview) {
		width: max-content;
		max-width: 100%;
	}

	.layout-keyboard-workspace-preview-area {
		display: grid;
		width: 100%;
		min-width: 0;
	}

	.layout-keyboard-workspace-header {
		justify-self: start;
		margin-bottom: 0.5rem;
	}

	.layout-keyboard-workspace-mappings {
		width: 100%;
		margin-top: 1.25rem;
		margin-inline: auto;
	}

	.layout-keyboard-workspace-options {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
		grid-auto-flow: row;
		align-items: start;
		width: 100%;
		min-width: 0;
		gap: 0.75rem 1rem;
		margin-top: 0.75rem;
		contain: inline-size;
	}

	.layout-keyboard-workspace-options :global(.toggle-switch) {
		width: 100%;
		min-width: 0;
	}

	@container layout-keyboard-workspace (max-width: 30rem) {
		.layout-keyboard-workspace {
			--keyboard-preview-key-size: min(3.35rem, var(--keyboard-preview-key-size-compact));
			--keyboard-preview-key-gap: 0.25rem;
		}
	}

	@container layout-keyboard-workspace (min-width: 50rem) {
		.layout-keyboard-workspace--with-mappings {
			--keyboard-preview-key-size: min(
				3.35rem,
				var(--keyboard-preview-key-size-with-compact-mappings)
			);
			--keyboard-preview-key-gap: 0.45rem;
			grid-template-columns: max-content 14rem;
			align-items: start;
		}

		.layout-keyboard-workspace--with-mappings .layout-keyboard-workspace-mappings {
			max-width: 14rem;
			margin-top: 0;
			margin-inline: 0;
		}
	}

	@container layout-keyboard-workspace (min-width: 72rem) {
		.layout-keyboard-workspace--with-mappings {
			--keyboard-preview-key-size: min(
				3.35rem,
				var(--keyboard-preview-key-size-with-wide-mappings)
			);
			grid-template-columns: max-content 19.6875rem;
		}

		.layout-keyboard-workspace--with-mappings .layout-keyboard-workspace-mappings {
			max-width: 19.6875rem;
		}
	}
</style>
