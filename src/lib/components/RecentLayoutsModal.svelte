<script lang="ts">
	import { getRecentLayoutsByDay, type LayoutsByDay } from '$lib/recentLayouts';
	import { filterStore } from '$lib/filterStore.svelte';
	import { layoutsCatalog } from '$lib/layoutsCatalog.svelte';
	import { lockPageScroll } from '$lib/modalScrollLock';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	const authorById = $derived(
		new Map<number, string>(
			Object.entries(layoutsCatalog.authorsData).map(([name, id]) => [id as number, name])
		)
	);

	const groups = $derived.by((): LayoutsByDay[] => {
		if (layoutsCatalog.layouts.length === 0) return [];
		return getRecentLayoutsByDay(layoutsCatalog.layouts);
	});

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

	function getAuthorName(userId: number): string {
		return authorById.get(userId) ?? 'Unknown';
	}

	function showLayout(name: string) {
		filterStore.focusLayout(name);
		onClose();
	}

	function blockBackgroundScroll(event: Event) {
		event.preventDefault();
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div
			class="absolute inset-0 bg-black/40"
			role="presentation"
			onclick={onClose}
			onwheel={blockBackgroundScroll}
			ontouchmove={blockBackgroundScroll}
		></div>

		<div
			class="relative z-10 flex max-h-[min(80vh,640px)] w-full max-w-lg flex-col rounded-2xl shadow-xl"
			style="background-color: var(--bg-primary); border: 1px solid var(--border);"
			role="dialog"
			aria-modal="true"
			aria-labelledby="recent-layouts-title"
		>
			<div
				class="flex items-center justify-between border-b px-5 py-4"
				style="border-color: var(--border);"
			>
				<div>
					<h2
						id="recent-layouts-title"
						class="text-lg font-semibold"
						style="color: var(--text-primary);"
					>
						New layouts
					</h2>
					<p class="text-sm" style="color: var(--text-secondary);">Last 7 days</p>
				</div>
				<button
					onclick={onClose}
					class="flex size-8 items-center justify-center rounded-full transition-colors"
					style="color: var(--text-secondary);"
					aria-label="Close"
				>
					<svg class="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<path d="M18 6L6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="overflow-y-auto px-5 py-4">
				{#if layoutsCatalog.layouts.length === 0}
					<p class="text-sm" style="color: var(--text-secondary);">Loading…</p>
				{:else if groups.length === 0}
					<p class="text-sm" style="color: var(--text-secondary);">
						No new layouts in the last 7 days.
					</p>
				{:else}
					<div class="space-y-5">
						{#each groups as group (group.day)}
							<section>
								<h3 class="mb-2 text-sm font-medium" style="color: var(--text-secondary);">
									{group.label}
								</h3>
								<ul class="space-y-1">
									{#each group.layouts as layout (layout.name)}
										<li>
											<button
												type="button"
												onclick={() => showLayout(layout.name)}
												class="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[var(--bg-secondary)]"
												style="color: var(--text-primary);"
											>
												<span class="font-medium">{layout.name}</span>
												<span class="shrink-0 text-xs" style="color: var(--text-caption);">
													{getAuthorName(layout.user)}
												</span>
											</button>
										</li>
									{/each}
								</ul>
							</section>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
