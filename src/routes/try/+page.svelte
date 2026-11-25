<script lang="ts">
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { PathnameWithSearchOrHash } from '$app/types';
	import { onMount } from 'svelte';
	import LayoutCreator from '$lib/components/LayoutCreator.svelte';
	import { readAklTryHash } from '$lib/aklTryImport';
	import { isRouterNotReadyError } from '$lib/filterNavigation';

	const imported = browser
		? readAklTryHash(window.location.hash)
		: { snapshot: null, notice: null, source: null };

	onMount(() => {
		if (imported.snapshot || !window.location.hash.startsWith('#akl=')) return;
		let timeout: ReturnType<typeof setTimeout> | null = null;
		const clearHash = () => {
			timeout = null;
			const target = (window.location.pathname +
				window.location.search) as PathnameWithSearchOrHash;
			try {
				replaceState(resolve(target), page.state);
			} catch (error) {
				if (!isRouterNotReadyError(error)) throw error;
				timeout = setTimeout(clearHash, 0);
			}
		};
		timeout = setTimeout(clearHash, 0);
		return () => {
			if (timeout) clearTimeout(timeout);
		};
	});
</script>

<LayoutCreator
	path="/try"
	initialSnapshot={imported.snapshot}
	importNotice={imported.notice}
	importSource={imported.source}
/>
