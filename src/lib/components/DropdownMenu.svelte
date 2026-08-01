<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';

	interface TriggerArgs {
		open: boolean;
		toggle: () => void;
		/** Spread onto the menu trigger button. */
		triggerProps: {
			'aria-haspopup': 'menu';
			'aria-expanded': boolean;
			'aria-controls': string;
		};
	}

	interface MenuArgs {
		close: (restoreTriggerFocus?: boolean) => void;
	}

	interface Props {
		open?: boolean;
		/** Accessible name for the menu. */
		menuLabel?: string;
		/** Extra classes on the relative root. */
		rootClass?: string;
		/** Extra classes on the menu panel. */
		menuClass?: string;
		/** Where the menu opens relative to the root. */
		placement?: 'bottom-center' | 'top-stretch';
		trigger: Snippet<[TriggerArgs]>;
		children: Snippet<[MenuArgs]>;
	}

	let {
		open = $bindable(false),
		menuLabel,
		rootClass = '',
		menuClass = '',
		placement = 'bottom-center',
		trigger,
		children
	}: Props = $props();

	let rootEl = $state<HTMLDivElement | undefined>(undefined);
	let triggerEl = $state<HTMLElement | undefined>(undefined);
	const menuId = `dropdown-menu-${crypto.randomUUID()}`;

	function setOpen(next: boolean) {
		open = next;
	}

	function close(restoreTriggerFocus = false) {
		setOpen(false);
		if (restoreTriggerFocus) triggerEl?.focus();
	}

	async function toggle() {
		const next = !open;
		setOpen(next);
		if (!next) return;
		await tick();
		const firstItem = rootEl?.querySelector<HTMLElement>(
			'[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
		);
		firstItem?.focus();
	}

	function menuItems(): HTMLElement[] {
		return Array.from(
			rootEl?.querySelectorAll<HTMLElement>(
				'[role="menuitem"]:not([disabled]):not([aria-disabled="true"])'
			) ?? []
		);
	}

	async function handleKeyDown(event: KeyboardEvent) {
		if (!open) {
			if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && event.target === triggerEl) {
				event.preventDefault();
				setOpen(true);
				await tick();
				const items = menuItems();
				items[event.key === 'ArrowUp' ? items.length - 1 : 0]?.focus();
			}
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			event.stopPropagation();
			close(true);
			return;
		}

		if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
		const items = menuItems();
		if (items.length === 0) return;

		event.preventDefault();
		const currentIndex = items.indexOf(document.activeElement as HTMLElement);
		const nextIndex =
			event.key === 'Home'
				? 0
				: event.key === 'End'
					? items.length - 1
					: event.key === 'ArrowUp'
						? currentIndex <= 0
							? items.length - 1
							: currentIndex - 1
						: (currentIndex + 1) % items.length;
		items[nextIndex]?.focus();
	}

	function handleFocusOut(event: FocusEvent) {
		const nextTarget = event.relatedTarget;
		if (!(nextTarget instanceof Node) || !rootEl?.contains(nextTarget)) {
			close();
		}
	}

	$effect(() => {
		if (!open) return;

		function handlePointerDown(event: PointerEvent) {
			const target = event.target;
			if (!(target instanceof Node) || rootEl?.contains(target)) return;
			close();
		}

		document.addEventListener('pointerdown', handlePointerDown);
		return () => document.removeEventListener('pointerdown', handlePointerDown);
	});

	$effect(() => {
		if (!rootEl) return;
		const button = rootEl.querySelector<HTMLElement>('[aria-haspopup="menu"]');
		triggerEl = button ?? undefined;
	});

	const triggerProps = $derived({
		'aria-haspopup': 'menu' as const,
		'aria-expanded': open,
		'aria-controls': menuId
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="dropdown-menu-root {rootClass}"
	class:dropdown-menu-root--bottom-center={placement === 'bottom-center'}
	class:dropdown-menu-root--top-stretch={placement === 'top-stretch'}
	bind:this={rootEl}
	onkeydown={handleKeyDown}
	onfocusout={handleFocusOut}
>
	{@render trigger({ open, toggle, triggerProps })}
	{#if open}
		<div id={menuId} class="dropdown-menu {menuClass}" role="menu" aria-label={menuLabel}>
			{@render children({ close })}
		</div>
	{/if}
</div>

<style>
	.dropdown-menu-root {
		position: relative;
	}

	.dropdown-menu {
		z-index: 20;
		display: flex;
		flex-direction: column;
		padding: 0.25rem;
		border: 1px solid var(--border);
		border-radius: 0.75rem;
		background-color: var(--bg-primary);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.24);
	}

	.dropdown-menu-root--bottom-center .dropdown-menu {
		position: absolute;
		top: calc(100% + 0.375rem);
		left: 50%;
		width: max-content;
		min-width: 14.5rem;
		transform: translateX(-50%);
	}

	.dropdown-menu-root--top-stretch .dropdown-menu {
		position: absolute;
		left: 0;
		right: 0;
		bottom: calc(100% + 0.25rem);
		box-shadow: 0 8px 24px rgb(0 0 0 / 0.18);
	}
</style>
