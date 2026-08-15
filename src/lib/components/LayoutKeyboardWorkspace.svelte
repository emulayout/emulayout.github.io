<script lang="ts">
	import type { Snippet } from 'svelte';
	import InputMappingsPanel from '$lib/components/InputMappingsPanel.svelte';
	import LayoutKeyboardPreview from '$lib/components/LayoutKeyboardPreview.svelte';
	import type { LayoutData } from '$lib/layout';
	import {
		fillPreviewKeyboardRows,
		layoutMainRowMaxColumn,
		type DisplayCell
	} from '$lib/layoutDisplay';
	import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
	import type { KeyboardWidthTerms } from '$lib/keyboardInputConfig';
	import type {
		LayoutKeyboardFeedback,
		LayoutKeyboardPresentation,
		LayoutKeyboardSwapPath
	} from '$lib/layoutKeyboardFeedback';

	const FULL_KEY_GAP_REM = 0.45;
	const COMPACT_KEY_GAP_REM = 0.25;
	const COMPACT_MAPPINGS_RESERVED_REM = 15.5;
	const WIDE_MAPPINGS_RESERVED_REM = 21.1875;
	const ASIDE_RESERVED_REM = 5.75;
	const ASIDE_AND_COMPACT_MAPPINGS_RESERVED_REM =
		ASIDE_RESERVED_REM + COMPACT_MAPPINGS_RESERVED_REM;
	const ASIDE_AND_WIDE_MAPPINGS_RESERVED_REM = ASIDE_RESERVED_REM + WIDE_MAPPINGS_RESERVED_REM;

	interface Props {
		layout: LayoutData;
		rows: DisplayCell[][];
		feedback?: LayoutKeyboardFeedback;
		swapPaths?: readonly LayoutKeyboardSwapPath[];
		highlightedKeys?: readonly string[];
		unreachableKeys?: readonly string[];
		highlightHomeKeys?: boolean;
		inputProfile?: LayoutInputProfile;
		disabledMappingIds?: readonly string[];
		onDisabledMappingIdsChange?: (ids: string[]) => void;
		showMappings?: boolean;
		optionsLabel?: string;
		header?: Snippet;
		options?: Snippet;
		/** Prompt, input, and other content sized to the workspace width. */
		above?: Snippet;
		/** Replaces the presentation keyboard. Omit to keep the preview. */
		keyboard?: Snippet<[LayoutKeyboardPresentation]>;
		/** Sits above the keyboard, still in the preview column. */
		keyboardLead?: Snippet;
		/** When the editor is showing, size keys to its full slot grid. */
		keyboardWidthTerms?: KeyboardWidthTerms;
		/** Sits under the keyboard, before the option toggles. */
		belowKeyboard?: Snippet;
		/** Sits beside the keyboard in its own column, independent of mappings. */
		aside?: Snippet;
		/** Replaces the read-only mappings panel when provided. */
		mappings?: Snippet;
	}

	const {
		layout,
		rows,
		feedback,
		swapPaths = [],
		highlightedKeys = [],
		unreachableKeys = [],
		highlightHomeKeys = false,
		inputProfile,
		disabledMappingIds = [],
		onDisabledMappingIdsChange,
		showMappings = false,
		optionsLabel = 'Keyboard options',
		header,
		options,
		above,
		keyboard,
		keyboardLead,
		keyboardWidthTerms: keyboardWidthTermsOverride,
		belowKeyboard,
		aside,
		mappings
	}: Props = $props();

	const previewDisplayRows = $derived(fillPreviewKeyboardRows(rows));

	function keyboardWidthTerms(): { keyUnits: number; gapCount: number } {
		if (layout.board === 'ortho' || layout.board === 'mini') {
			const mainRowMaxColumn = layoutMainRowMaxColumn(layout);
			const rightSlotCount = Math.max(5, mainRowMaxColumn - 4);
			return {
				keyUnits: 5 + rightSlotCount + 0.48,
				gapCount: rightSlotCount + 3
			};
		}

		const rowTerms = previewDisplayRows.flatMap((row) => {
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
		const { keyUnits, gapCount } = keyboardWidthTermsOverride ?? keyboardWidthTerms();
		return [
			`--keyboard-preview-key-size-stacked: ${fittedKeySize(keyUnits, gapCount, FULL_KEY_GAP_REM)}`,
			`--keyboard-preview-key-size-compact: ${fittedKeySize(keyUnits, gapCount, COMPACT_KEY_GAP_REM)}`,
			`--keyboard-preview-key-size-with-aside: ${fittedKeySize(keyUnits, gapCount, FULL_KEY_GAP_REM, ASIDE_RESERVED_REM)}`,
			`--keyboard-preview-key-size-with-compact-mappings: ${fittedKeySize(keyUnits, gapCount, FULL_KEY_GAP_REM, COMPACT_MAPPINGS_RESERVED_REM)}`,
			`--keyboard-preview-key-size-with-wide-mappings: ${fittedKeySize(keyUnits, gapCount, FULL_KEY_GAP_REM, WIDE_MAPPINGS_RESERVED_REM)}`,
			`--keyboard-preview-key-size-with-aside-and-compact-mappings: ${fittedKeySize(keyUnits, gapCount, FULL_KEY_GAP_REM, ASIDE_AND_COMPACT_MAPPINGS_RESERVED_REM)}`,
			`--keyboard-preview-key-size-with-aside-and-wide-mappings: ${fittedKeySize(keyUnits, gapCount, FULL_KEY_GAP_REM, ASIDE_AND_WIDE_MAPPINGS_RESERVED_REM)}`
		].join('; ');
	});

	const mappingsVisible = $derived(showMappings && (Boolean(mappings) || Boolean(inputProfile)));
	const asideVisible = $derived(Boolean(aside));
	const keyboardPresentation = $derived({
		feedback: feedback ?? new Map(),
		swapPaths,
		highlightedKeys,
		unreachableKeys,
		highlightHomeKeys
	} satisfies LayoutKeyboardPresentation);
</script>

<div class="layout-keyboard-workspace-region">
	<div class="layout-keyboard-workspace-main">
		<div
			class="layout-keyboard-workspace"
			class:layout-keyboard-workspace--with-aside={asideVisible}
			class:layout-keyboard-workspace--with-mappings={mappingsVisible}
			style={sizingStyle}
		>
			{#if above}
				<div class="layout-keyboard-workspace-above">
					{@render above()}
				</div>
			{/if}
			<div class="layout-keyboard-workspace-board">
				<div class="layout-keyboard-workspace-cluster">
					<div class="layout-keyboard-workspace-preview-area">
						{#if header}
							<div class="layout-keyboard-workspace-header">
								{@render header()}
							</div>
						{/if}
						{#if keyboardLead}
							<div class="layout-keyboard-workspace-lead">
								{@render keyboardLead()}
							</div>
						{/if}
						<div class="layout-keyboard-workspace-keys">
							{#if keyboard}
								{@render keyboard(keyboardPresentation)}
							{:else}
								<LayoutKeyboardPreview
									{layout}
									rows={previewDisplayRows}
									{feedback}
									{swapPaths}
									{highlightedKeys}
									{unreachableKeys}
									{highlightHomeKeys}
									horizontalAlignment="start"
								/>
							{/if}
						</div>
						{#if belowKeyboard}
							<div class="layout-keyboard-workspace-below">
								{@render belowKeyboard()}
							</div>
						{/if}
					</div>
					{#if options}
						<div class="layout-keyboard-workspace-options" role="group" aria-label={optionsLabel}>
							{@render options()}
						</div>
					{/if}
				</div>
				{#if aside}
					<div class="layout-keyboard-workspace-aside">
						{@render aside()}
					</div>
				{/if}
			</div>
			{#if mappingsVisible}
				<div class="layout-keyboard-workspace-mappings">
					{#if mappings}
						{@render mappings()}
					{:else if inputProfile}
						<InputMappingsPanel
							profile={inputProfile}
							{disabledMappingIds}
							{onDisabledMappingIdsChange}
						/>
					{/if}
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
	.layout-keyboard-workspace-board,
	.layout-keyboard-workspace-mappings {
		min-width: 0;
	}

	.layout-keyboard-workspace-main {
		display: flex;
		justify-content: center;
	}

	.layout-keyboard-workspace-board {
		display: grid;
		grid-template-columns: minmax(0, max-content);
		width: max-content;
		max-width: 100%;
		min-width: 0;
		gap: clamp(0.75rem, 2vw, 1.5rem);
	}

	.layout-keyboard-workspace-cluster {
		display: grid;
		grid-template-columns: minmax(0, max-content);
		width: max-content;
		max-width: 100%;
		min-width: 0;
	}

	.layout-keyboard-workspace-cluster :global(.keyboard-preview),
	.layout-keyboard-workspace-cluster :global(.keyboard-input-editor) {
		width: max-content;
		max-width: 100%;
		min-width: 0;
	}

	.layout-keyboard-workspace-above {
		grid-column: 1 / -1;
		box-sizing: border-box;
		width: 0;
		min-width: 100%;
	}

	.layout-keyboard-workspace-preview-area {
		display: grid;
		width: 100%;
		min-width: 0;
	}

	.layout-keyboard-workspace-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		width: 100%;
		margin-bottom: 0.5rem;
	}

	.layout-keyboard-workspace-lead {
		margin-bottom: 0.75rem;
		min-width: 0;
	}

	.layout-keyboard-workspace-keys {
		min-width: 0;
	}

	.layout-keyboard-workspace-below {
		box-sizing: border-box;
		width: 0;
		min-width: 100%;
		margin-top: 0.75rem;
	}

	.layout-keyboard-workspace-aside {
		display: flex;
		justify-content: center;
		margin-top: 1.25rem;
	}

	.layout-keyboard-workspace-mappings {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		width: 100%;
		margin-top: 1.25rem;
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
		.layout-keyboard-workspace--with-aside .layout-keyboard-workspace-board {
			grid-template-columns: max-content max-content;
			grid-template-areas:
				'header .'
				'lead .'
				'keys specials'
				'below .'
				'options .';
			align-items: start;
			column-gap: clamp(0.75rem, 2vw, 1.5rem);
			row-gap: 0;
		}

		.layout-keyboard-workspace--with-aside .layout-keyboard-workspace-cluster,
		.layout-keyboard-workspace--with-aside .layout-keyboard-workspace-preview-area {
			display: contents;
		}

		.layout-keyboard-workspace--with-aside .layout-keyboard-workspace-header {
			grid-area: header;
		}

		.layout-keyboard-workspace--with-aside .layout-keyboard-workspace-lead {
			grid-area: lead;
		}

		.layout-keyboard-workspace--with-aside .layout-keyboard-workspace-keys {
			grid-area: keys;
		}

		.layout-keyboard-workspace--with-aside .layout-keyboard-workspace-below {
			grid-area: below;
		}

		.layout-keyboard-workspace--with-aside .layout-keyboard-workspace-options {
			grid-area: options;
		}

		.layout-keyboard-workspace--with-aside .layout-keyboard-workspace-aside {
			grid-area: specials;
			align-self: start;
			margin-top: 0;
			padding-top: 0.25rem;
		}

		.layout-keyboard-workspace--with-aside:not(.layout-keyboard-workspace--with-mappings) {
			--keyboard-preview-key-size: min(3.35rem, var(--keyboard-preview-key-size-with-aside));
			--keyboard-preview-key-gap: 0.45rem;
		}

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
		}

		.layout-keyboard-workspace--with-aside.layout-keyboard-workspace--with-mappings {
			--keyboard-preview-key-size: min(
				3.35rem,
				var(--keyboard-preview-key-size-with-aside-and-compact-mappings)
			);
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

		.layout-keyboard-workspace--with-aside.layout-keyboard-workspace--with-mappings {
			--keyboard-preview-key-size: min(
				3.35rem,
				var(--keyboard-preview-key-size-with-aside-and-wide-mappings)
			);
		}
	}
</style>
