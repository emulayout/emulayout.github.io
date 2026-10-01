<script lang="ts">
	import { browser } from '$app/environment';
	import { replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { PathnameWithSearchOrHash } from '$app/types';
	import { onMount } from 'svelte';
	import LayoutCreator from '$lib/components/LayoutCreator.svelte';
	import { readAklTryHash } from '$lib/aklTryImport';

	const imported = browser
		? readAklTryHash(window.location.hash)
		: { snapshot: null, notice: null, source: null };

	onMount(() => {
		if (!window.location.hash.startsWith('#akl=')) return;
		const timeout = setTimeout(() => {
			const target = (window.location.pathname +
				window.location.search) as PathnameWithSearchOrHash;
			replaceState(resolve(target), {});
		}, 0);
		return () => clearTimeout(timeout);
	});
</script>

<LayoutCreator
	path="/try"
	initialSnapshot={imported.snapshot}
	importNotice={imported.notice}
	importSource={imported.source}
/>
