<script lang="ts">
	import type { LayoutData } from '$lib/layout';
	import { applyAnglemodToDisplayValue, buildKeyMap, buildShiftKeyMap } from '$lib/cmini/keyboard';
	import { filterStore } from '$lib/filterStore.svelte';

	interface Props {
		layout: LayoutData;
		authorName: string;
		playgroundUrl: string;
	}

	const { layout, authorName, playgroundUrl }: Props = $props();

	let isExpanded = $state(false);
	let textareaElement: HTMLTextAreaElement | null = $state(null);
	let cardElement: HTMLDivElement | null = $state(null);
	let buttonElement: HTMLButtonElement | null = $state(null);
	let anglemod = $state(false);

	// Transform displayValue when anglemod is enabled
	const transformedDisplayValue = $derived.by(() => {
		if (!anglemod) return layout.displayValue;
		return applyAnglemodToDisplayValue(layout.displayValue);
	});

	// Parse displayValue and create key mapping
	const keyMap = $derived.by(() => {
		return buildKeyMap(transformedDisplayValue);
	});

	// Create shift key map: maps key codes to layout characters when shift is pressed
	// For punctuation keys: get the base character from layout, find its shifted version, then find where that appears in layout
	// For letter keys: uppercase the character from the layout at that position
	const shiftKeyMap = $derived.by(() => {
		return buildShiftKeyMap(keyMap);
	});

	function toggleTextarea() {
		isExpanded = !isExpanded;
		// Focus the textarea after it's rendered
		if (isExpanded) {
			setTimeout(() => {
				if (textareaElement) {
					textareaElement.focus();
				}
			}, 0);
		}
	}

	function closeCardAndRefocus() {
		isExpanded = false;
		setTimeout(() => {
			if (buttonElement) {
				buttonElement.focus();
			}
		}, 0);
	}

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeCardAndRefocus();
			return;
		}

		// Don't remap if meta, ctrl, or alt are pressed
		if (event.metaKey || event.ctrlKey || event.altKey) {
			return;
		}

		// Check if this is a remappable key
		if (event.code in keyMap) {
			event.preventDefault();
			let mappedChar: string | undefined;

			// Use shift map if shift is pressed
			if (event.shiftKey) {
				if (event.code in shiftKeyMap) {
					mappedChar = shiftKeyMap[event.code];
				}
			} else {
				mappedChar = keyMap[event.code];
			}

			if (textareaElement && mappedChar) {
				const start = textareaElement.selectionStart;
				const end = textareaElement.selectionEnd;
				const value = textareaElement.value;
				const newValue = value.slice(0, start) + mappedChar + value.slice(end);

				textareaElement.value = newValue;
			}
		}
	}
</script>

<div
	bind:this={cardElement}
	data-layout-name={layout.name}
	class="pt-5 px-5 pb-2 rounded-xl transition-all duration-300 min-w-0 overflow-hidden flex flex-col h-full"
	style="background-color: var(--bg-secondary); border: 1px solid var(--border);"
>
	<div class="flex items-center gap-2 mb-1">
		<h2
			class="text-lg font-semibold flex-1 truncate"
			style="color: var(--text-primary);"
			title={layout.name}
		>
			{layout.name}
		</h2>
		<div class="flex items-center gap-1 shrink-0">
			<button
				type="button"
				onclick={() => (anglemod = !anglemod)}
				class="px-2 py-1 rounded-lg text-sm transition-all flex items-center justify-center"
				style="
					background-color: {anglemod ? 'var(--accent)' : 'var(--bg-primary)'};
					color: {anglemod ? 'white' : 'var(--text-primary)'};
					border: 1px solid {anglemod ? 'var(--accent)' : 'var(--border)'};
				"
				title="Anglemod"
			>
				<svg
					class="size-4"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
					<path d="M21 3v5h-5" />
					<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
					<path d="M3 21v-5h5" />
				</svg>
			</button>
			<a
				href={playgroundUrl}
				class="px-2 py-1 rounded-lg text-sm transition-all flex items-center justify-center"
				style="
					background-color: var(--bg-primary);
					color: var(--text-primary);
					border: 1px solid var(--border);
				"
				title="View on Cyanophage"
				aria-label="View on Cyanophage"
			>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
			</a>
		</div>
	</div>
	<p class="text-xs mb-3" style="color: var(--text-secondary);">
		{layout.board} · by{' '}
		<button
			type="button"
			onclick={() => {
				filterStore.clearAuthors();
				filterStore.toggleAuthor(layout.user);
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}}
			class="hover:underline cursor-pointer"
			style="color: var(--text-secondary);"
		>
			{authorName}
		</button>
	</p>
	<div class="overflow-x-auto -mx-5 px-5 mb-4">
		<pre
			class="font-mono text-xs leading-relaxed tracking-widest whitespace-pre"
			style="color: var(--text-primary);">{transformedDisplayValue}</pre>
	</div>
	<div class="mt-auto flex flex-col gap-2">
		{#if isExpanded}
			<textarea
				bind:this={textareaElement}
				class="w-full p-3 rounded-lg text-sm resize-none outline-none focus:ring-2 transition-all"
				style="
					background-color: var(--bg-primary);
					color: var(--text-primary);
					border: 1px solid var(--border);
					--tw-ring-color: var(--accent);
				"
				rows="4"
				placeholder="Test layout here..."
				onkeydown={handleKeyDown}
			></textarea>
		{/if}
		<button
			bind:this={buttonElement}
			type="button"
			onclick={toggleTextarea}
			class="w-full px-4 py-2 rounded-lg text-sm font-medium transition-colors"
			style="
			color: var(--text-primary);
			background-color: var(--bg-primary);
			border: 1px solid var(--border);
		"
		>
			{isExpanded ? 'Close' : 'Try'}
		</button>
	</div>
</div>
