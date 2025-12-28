<script lang="ts">
	import type { LayoutData } from '$lib/layout';

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

	// Standard QWERTY layout positions (row, col) mapped to KeyboardEvent.code
	// Row 0: q w e r t y u i o p [ ]
	// Row 1: a s d f g h j k l ; '
	// Row 2: z x c v b n m , . /
	const QWERTY_KEY_MAP: Record<string, { row: number; col: number }> = {
		KeyQ: { row: 0, col: 0 },
		KeyW: { row: 0, col: 1 },
		KeyE: { row: 0, col: 2 },
		KeyR: { row: 0, col: 3 },
		KeyT: { row: 0, col: 4 },
		KeyY: { row: 0, col: 5 },
		KeyU: { row: 0, col: 6 },
		KeyI: { row: 0, col: 7 },
		KeyO: { row: 0, col: 8 },
		KeyP: { row: 0, col: 9 },
		BracketLeft: { row: 0, col: 10 },
		BracketRight: { row: 0, col: 11 },
		KeyA: { row: 1, col: 0 },
		KeyS: { row: 1, col: 1 },
		KeyD: { row: 1, col: 2 },
		KeyF: { row: 1, col: 3 },
		KeyG: { row: 1, col: 4 },
		KeyH: { row: 1, col: 5 },
		KeyJ: { row: 1, col: 6 },
		KeyK: { row: 1, col: 7 },
		KeyL: { row: 1, col: 8 },
		Semicolon: { row: 1, col: 9 },
		Quote: { row: 1, col: 10 },
		KeyZ: { row: 2, col: 0 },
		KeyX: { row: 2, col: 1 },
		KeyC: { row: 2, col: 2 },
		KeyV: { row: 2, col: 3 },
		KeyB: { row: 2, col: 4 },
		KeyN: { row: 2, col: 5 },
		KeyM: { row: 2, col: 6 },
		Comma: { row: 2, col: 7 },
		Period: { row: 2, col: 8 },
		Slash: { row: 2, col: 9 }
	};

	// Parse displayValue and create key mapping
	const keyMap = $derived.by(() => {
		const map: Record<string, string> = {};
		const rows = layout.displayValue.split('\n');
		const splitCol = 5; // Gap between hands

		rows.forEach((row, rowIndex) => {
			// Remove extra spaces and split
			const chars = row.split(/\s+/).filter((c) => c.length > 0);
			// Account for the gap between hands (splitCol)
			// First splitCol characters are left hand, rest are right hand
			const leftHand = chars.slice(0, splitCol);
			const rightHand = chars.slice(splitCol);

			// Map QWERTY positions to layout characters
			Object.entries(QWERTY_KEY_MAP).forEach(([keyCode, { row: qwertyRow, col: qwertyCol }]) => {
				if (qwertyRow === rowIndex) {
					let layoutChar: string | undefined;
					if (qwertyCol < splitCol) {
						// Left hand
						layoutChar = leftHand[qwertyCol];
					} else {
						// Right hand (adjust column index)
						layoutChar = rightHand[qwertyCol - splitCol];
					}
					if (layoutChar && layoutChar.length === 1) {
						map[keyCode] = layoutChar;
					}
				}
			});
		});

		return map;
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

		// Check if this is a remappable key
		if (event.code in keyMap) {
			event.preventDefault();
			let mappedChar = keyMap[event.code];

			// Handle shift: uppercase letters, keep other characters as-is
			if (event.shiftKey && mappedChar) {
				if (mappedChar.match(/[a-z]/)) {
					mappedChar = mappedChar.toUpperCase();
				}
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
			class="text-lg font-semibold flex-1 truncate flex items-center gap-2"
			style="color: var(--text-primary);"
			title={layout.name}
		>
			{layout.name}
			<a
				href={playgroundUrl}
				class="shrink-0 transition-colors"
				style="color: var(--link);"
				aria-label="View layout details"
			>
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
					/>
				</svg>
			</a>
		</h2>
	</div>
	<p class="text-xs mb-3" style="color: var(--text-secondary);">
		{layout.board} · by {authorName}
	</p>
	<div class="overflow-x-auto -mx-5 px-5 mb-4">
		<pre
			class="font-mono text-xs leading-relaxed tracking-widest whitespace-pre"
			style="color: var(--text-primary);">{layout.displayValue}</pre>
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
			{isExpanded ? 'Close test area' : 'Test layout'}
		</button>
	</div>
</div>
