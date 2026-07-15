<script lang="ts">
	import type { Snippet } from 'svelte';
	import { lockPageScroll } from '$lib/modalScrollLock';

	interface Props {
		open: boolean;
		onClose: () => void;
		/** `id` of the dialog title element. */
		labelledBy: string;
		/** Extra classes for the dialog panel (width/height constraints). */
		panelClass?: string;
		children: Snippet;
	}

	let { open, onClose, labelledBy, panelClass = '', children }: Props = $props();

	$effect(() => {
		if (!open) return;

		const unlock = lockPageScroll();

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') onClose();
		}

		document.addEventListener('keydown', handleKeyDown);
		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			unlock();
		};
	});

	function blockBackgroundScroll(event: Event) {
		event.preventDefault();
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div
			class="modal-backdrop absolute inset-0"
			role="presentation"
			onclick={onClose}
			onwheel={blockBackgroundScroll}
			ontouchmove={blockBackgroundScroll}
		></div>

		<div
			class="modal-panel relative z-10 flex min-h-0 w-full flex-col rounded-2xl shadow-xl {panelClass}"
			style="background-color: var(--bg-primary); border: 1px solid var(--border);"
			role="dialog"
			aria-modal="true"
			aria-labelledby={labelledBy}
		>
			{@render children()}
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		background-color: rgb(0 0 0 / 0.4);
	}

	:global(html.dark) .modal-backdrop {
		background-color: rgb(0 0 0 / 0.8);
	}
</style>
