<script lang="ts">
	import { afterNavigate, goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import LayoutExpandedView from '$lib/components/LayoutExpandedView.svelte';
	import { filterStore } from '$lib/filterStore.svelte';
	import { decodeLayoutDetail } from '$lib/layoutDetails';
	import {
		layoutDetailPageHref,
		LAYOUT_DETAIL_TAB_PARAM,
		parseLayoutDetailSection,
		type LayoutDetailSection
	} from '$lib/layoutDetailTabs';
	import { layoutDetailsStore } from '$lib/layoutDetailsStore.svelte';
	import {
		typingPracticeLessonFromSearchParams,
		type TypingPracticeLessonSettings
	} from '$lib/typingPracticeText';
	import { untrack } from 'svelte';

	const { data } = $props();
	const detail = $derived(data.detail ? decodeLayoutDetail(data.detail, data.layoutName) : null);
	const layout = $derived(detail?.layout);
	const activeSection = $derived(
		parseLayoutDetailSection(page.url.searchParams.get(LAYOUT_DETAIL_TAB_PARAM))
	);

	const practiceLesson = $derived(typingPracticeLessonFromSearchParams(page.url.searchParams));
	let disabledMappingIds = $state<string[]>([]);

	filterStore.enterLayoutDetailRoute();

	afterNavigate(() => {
		const pathname = resolve('/layouts/[name]', { name: data.layoutName });
		const canonicalHref = data.detail
			? layoutDetailPageHref(
					pathname,
					parseLayoutDetailSection(page.url.searchParams.get(LAYOUT_DETAIL_TAB_PARAM)),
					typingPracticeLessonFromSearchParams(page.url.searchParams)
				)
			: pathname;
		if (`${page.url.pathname}${page.url.search}` === canonicalHref) return;
		// canonicalHref starts with route-aware resolve(); the helper appends canonical detail state.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		replaceState(canonicalHref, page.state);
	});

	function setActiveSection(section: LayoutDetailSection) {
		if (section === activeSection) return;
		// The route is resolved before layoutDetailPageHref appends its canonical tab query.
		/* eslint-disable svelte/no-navigation-without-resolve */
		void goto(
			layoutDetailPageHref(
				resolve('/layouts/[name]', { name: data.layoutName }),
				section,
				practiceLesson
			),
			{
				replaceState: true,
				noScroll: true,
				keepFocus: true,
				state: page.state
			}
		);
		/* eslint-enable svelte/no-navigation-without-resolve */
	}

	function setPracticeLesson(lesson: TypingPracticeLessonSettings) {
		// The route is resolved before layoutDetailPageHref appends its canonical query.
		/* eslint-disable svelte/no-navigation-without-resolve */
		void goto(
			layoutDetailPageHref(
				resolve('/layouts/[name]', { name: data.layoutName }),
				activeSection,
				lesson
			),
			{
				replaceState: true,
				noScroll: true,
				state: page.state
			}
		);
		/* eslint-enable svelte/no-navigation-without-resolve */
	}

	async function backToLayouts(event: MouseEvent) {
		const indexUrl = page.state.layoutIndexUrl;
		if (!indexUrl) return;
		event.preventDefault();
		// layoutIndexUrl was captured from the already-resolved index location.
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(indexUrl);
		// A forward navigation fires no popstate, so re-read the restored index URL.
		filterStore.restoreIndexUrlState();
	}

	$effect(() => {
		const compact = data.detail;
		const expectedName = data.layoutName;
		if (compact) untrack(() => layoutDetailsStore.hydrate(compact, expectedName));
	});
</script>

<svelte:head>
	<title>{layout ? `${layout.name} · Emulayout` : 'Layout not found · Emulayout'}</title>
</svelte:head>

{#if detail}
	<LayoutExpandedView
		layout={detail.layout}
		authorName={detail.authorName}
		likeCount={detail.likeCount}
		onBackToLayouts={backToLayouts}
		detailStats={detail.stats}
		inputProfile={detail.inputProfile}
		{disabledMappingIds}
		onDisabledMappingIdsChange={(ids) => (disabledMappingIds = ids)}
		{activeSection}
		onActiveSectionChange={setActiveSection}
		{practiceLesson}
		onPracticeLessonChange={setPracticeLesson}
	/>
{:else}
	<section class="layout-not-found" aria-labelledby="layout-not-found-title">
		<h2 id="layout-not-found-title">Layout not found</h2>
		<p>No layout named “{data.layoutName}” is in the current catalog.</p>
		<a href={resolve('/')} onclick={backToLayouts}>Back to layouts</a>
	</section>
{/if}

<style>
	.layout-not-found {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.75rem;
		max-width: 32rem;
		padding: 1.5rem 0.25rem;
		color: var(--text-secondary);
	}

	.layout-not-found h2,
	.layout-not-found p {
		margin: 0;
	}

	.layout-not-found h2 {
		color: var(--text-primary);
		font-size: 1.25rem;
	}

	.layout-not-found a {
		color: var(--accent);
		font-weight: 600;
	}
</style>
