<script lang="ts">
	import ModalHeader from '$lib/components/ModalHeader.svelte';
	import ModalShell from '$lib/components/ModalShell.svelte';
	import { normalizeTypingPracticeText } from '$lib/typingPracticeText';

	interface Props {
		open: boolean;
		initialText: string;
		onClose: () => void;
		onSave: (text: string) => void;
	}

	let { open, initialText, onClose, onSave }: Props = $props();
	let text = $state('');
	let textField = $state<HTMLTextAreaElement | undefined>(undefined);
	const normalizedText = $derived(normalizeTypingPracticeText(text));

	$effect(() => {
		if (!open) return;
		text = initialText;
		requestAnimationFrame(() => {
			textField?.focus();
			textField?.select();
		});
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!normalizedText) return;
		onSave(normalizedText);
	}
</script>

<ModalShell {open} {onClose} labelledBy="typing-practice-text-title" panelClass="max-w-xl">
	<ModalHeader titleId="typing-practice-text-title" title="Practice custom text" {onClose} />

	<form onsubmit={submit}>
		<div class="px-5 py-4">
			<label class="flex flex-col gap-1.5">
				<span class="text-sm" style="color: var(--text-secondary);">Practice text</span>
				<textarea
					bind:this={textField}
					bind:value={text}
					rows="5"
					class="typing-practice-text-field w-full resize-y rounded-xl px-4 py-3 outline-none transition-all duration-200 focus:ring-2"
					style="
						background-color: var(--input-bg);
						color: var(--text-primary);
						border: 1px solid var(--border);
						--tw-ring-color: var(--accent);
					"></textarea>
			</label>
		</div>

		<div
			class="flex items-center justify-end gap-2 border-t px-5 py-4"
			style="border-color: var(--border);"
		>
			<button
				type="button"
				class="filter-reset-button typing-practice-text-button"
				onclick={onClose}
			>
				Cancel
			</button>
			<button
				type="submit"
				class="filter-reset-button typing-practice-text-button typing-practice-text-button--primary"
				disabled={!normalizedText}
			>
				Use text
			</button>
		</div>
	</form>
</ModalShell>

<style>
	.typing-practice-text-field {
		min-height: 8rem;
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
		font-size: 1rem;
		line-height: 1.5;
	}

	.typing-practice-text-button {
		min-width: 5rem;
		padding: 0.5rem 0.875rem;
		border-radius: 0.75rem;
		font-size: 0.875rem;
	}

	.typing-practice-text-button--primary {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 18%, var(--bg-primary));
		color: var(--text-primary);
	}

	.typing-practice-text-button--primary:hover:not(:disabled) {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 28%, var(--bg-primary));
		color: var(--accent);
	}

	.typing-practice-text-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}
</style>
