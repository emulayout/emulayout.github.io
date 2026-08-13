<script lang="ts">
	import { magicFallbackMappingId, magicRuleMappingId } from '$lib/inputMappingControls';
	import {
		createCreatorMagicRule,
		createCreatorMagicSection,
		creatorMagicFallbackSource,
		type CreatorMagicDraft,
		type CreatorMagicFallbackKind,
		type CreatorMagicSection
	} from '$lib/layoutCreatorMappings';

	const FALLBACK_OPTIONS: { value: CreatorMagicFallbackKind; label: string }[] = [
		{ value: 'no-op', label: 'nothing' },
		{ value: 'repeat-last', label: 'repeat previous' },
		{ value: 'emit', label: 'text' }
	];

	interface Props {
		draft: CreatorMagicDraft;
		disabledMappingIds?: readonly string[];
		onDraftChange: (draft: CreatorMagicDraft) => void;
		onDisabledMappingIdsChange?: (ids: string[]) => void;
	}

	const {
		draft,
		disabledMappingIds = [],
		onDraftChange,
		onDisabledMappingIdsChange
	}: Props = $props();
	const disabledIds = $derived(new Set(disabledMappingIds));

	function compiledRuleId(trigger: string, after: string): string | null {
		const nextTrigger = trigger.trim();
		const nextAfter = after.trim().toLowerCase();
		if (!nextTrigger || !nextAfter) return null;
		return magicRuleMappingId(nextTrigger, nextAfter);
	}

	function compiledFallbackId(section: CreatorMagicSection): string | null {
		const trigger = section.trigger.trim();
		if (!trigger || !creatorMagicFallbackSource(section)) return null;
		return magicFallbackMappingId(trigger);
	}

	const mappingIds = $derived(draft.sections.flatMap((section) => sectionMappingIds(section)));

	function sectionMappingIds(section: CreatorMagicSection): string[] {
		const ruleIds = section.rules.flatMap((rule) => {
			const id = compiledRuleId(section.trigger, rule.after);
			return id ? [id] : [];
		});
		const fallbackId = compiledFallbackId(section);
		return fallbackId ? [...ruleIds, fallbackId] : ruleIds;
	}

	function allEnabled(ids: readonly string[]): boolean {
		return ids.length > 0 && ids.every((id) => !disabledIds.has(id));
	}

	function someEnabled(ids: readonly string[]): boolean {
		return ids.some((id) => !disabledIds.has(id));
	}

	function setMappingsEnabled(ids: readonly string[], enabled: boolean) {
		const retained = disabledMappingIds.filter((id) => !ids.includes(id));
		onDisabledMappingIdsChange?.(enabled ? retained : [...retained, ...ids]);
	}

	function updateDraft(next: CreatorMagicDraft) {
		onDraftChange(next);
	}

	function updateSection(sectionId: string, patch: Partial<CreatorMagicSection>) {
		updateDraft({
			...draft,
			sections: draft.sections.map((section) =>
				section.id === sectionId ? { ...section, ...patch } : section
			)
		});
	}

	function addSection() {
		updateDraft({ ...draft, sections: [...draft.sections, createCreatorMagicSection('')] });
	}

	function removeSection(sectionId: string) {
		updateDraft({
			...draft,
			sections: draft.sections.filter((section) => section.id !== sectionId)
		});
	}

	function addRule(sectionId: string) {
		updateDraft({
			...draft,
			sections: draft.sections.map((section) =>
				section.id === sectionId
					? { ...section, rules: [...section.rules, createCreatorMagicRule()] }
					: section
			)
		});
	}

	function updateRule(sectionId: string, ruleId: string, field: 'after' | 'emit', value: string) {
		updateDraft({
			...draft,
			sections: draft.sections.map((section) =>
				section.id === sectionId
					? {
							...section,
							rules: section.rules.map((rule) =>
								rule.id === ruleId ? { ...rule, [field]: value } : rule
							)
						}
					: section
			)
		});
	}

	function removeRule(sectionId: string, ruleId: string) {
		updateDraft({
			...draft,
			sections: draft.sections.map((section) =>
				section.id === sectionId
					? { ...section, rules: section.rules.filter((rule) => rule.id !== ruleId) }
					: section
			)
		});
	}

	function updateFallbackKind(sectionId: string, fallbackKind: CreatorMagicFallbackKind) {
		updateSection(sectionId, { fallbackKind });
	}

	function updateFallbackEmit(sectionId: string, fallbackEmit: string) {
		updateSection(sectionId, { fallbackEmit });
	}
</script>

<section class="creator-mappings-panel" aria-label="Magic key mappings">
	<label class="creator-mappings-heading">
		<input
			type="checkbox"
			checked={allEnabled(mappingIds)}
			indeterminate={someEnabled(mappingIds) && !allEnabled(mappingIds)}
			disabled={mappingIds.length === 0}
			onchange={(event) => setMappingsEnabled(mappingIds, event.currentTarget.checked)}
		/>
		<span>Magic key mappings</span>
	</label>

	{#each draft.sections as section (section.id)}
		{@const sectionIds = sectionMappingIds(section)}
		{@const fallbackId = compiledFallbackId(section)}
		<div class="creator-mappings-section">
			<div class="creator-mappings-section-header">
				<div class="creator-mappings-group-heading">
					<input
						type="checkbox"
						checked={allEnabled(sectionIds)}
						indeterminate={someEnabled(sectionIds) && !allEnabled(sectionIds)}
						disabled={sectionIds.length === 0}
						aria-label="Enable section"
						onchange={(event) => setMappingsEnabled(sectionIds, event.currentTarget.checked)}
					/>
					<input
						class="creator-mappings-field creator-mappings-field--trigger"
						value={section.trigger}
						aria-label="Magic trigger"
						placeholder="*"
						oninput={(event) => updateSection(section.id, { trigger: event.currentTarget.value })}
					/>
				</div>
				<button
					type="button"
					class="creator-mappings-text-button"
					onclick={() => addRule(section.id)}
				>
					Add mapping
				</button>
				<button
					type="button"
					class="creator-mappings-icon-button"
					aria-label="Delete section"
					onclick={() => removeSection(section.id)}
				>
					<span aria-hidden="true">×</span>
				</button>
			</div>

			<div class="creator-mappings-list">
				{#each section.rules as rule (rule.id)}
					{@const mappingId = compiledRuleId(section.trigger, rule.after)}
					<div
						class="creator-mappings-row"
						class:creator-mappings-row--disabled={mappingId !== null && disabledIds.has(mappingId)}
					>
						<input
							type="checkbox"
							checked={mappingId !== null && !disabledIds.has(mappingId)}
							disabled={mappingId === null}
							aria-label="Enable mapping"
							onchange={(event) => {
								if (mappingId) setMappingsEnabled([mappingId], event.currentTarget.checked);
							}}
						/>
						<span class="creator-magic-mapping">
							<input
								class="creator-mappings-field"
								value={rule.after}
								aria-label="Preceding"
								oninput={(event) =>
									updateRule(section.id, rule.id, 'after', event.currentTarget.value)}
							/>
							<span class="creator-mappings-trigger">{section.trigger.trim() || '*'}</span>
							<span class="creator-mappings-arrow" aria-hidden="true">→</span>
							<input
								class="creator-mappings-field"
								value={rule.emit}
								aria-label="Emit"
								oninput={(event) =>
									updateRule(section.id, rule.id, 'emit', event.currentTarget.value)}
							/>
						</span>
						<button
							type="button"
							class="creator-mappings-icon-button"
							aria-label="Delete mapping"
							onclick={() => removeRule(section.id, rule.id)}
						>
							<span aria-hidden="true">×</span>
						</button>
					</div>
				{/each}
				<div
					class="creator-mappings-row"
					class:creator-mappings-row--disabled={fallbackId !== null && disabledIds.has(fallbackId)}
				>
					<input
						type="checkbox"
						checked={fallbackId !== null && !disabledIds.has(fallbackId)}
						disabled={fallbackId === null}
						aria-label="Enable fallback"
						onchange={(event) => {
							if (fallbackId) setMappingsEnabled([fallbackId], event.currentTarget.checked);
						}}
					/>
					<span class="creator-magic-mapping creator-magic-mapping--fallback">
						<span class="creator-mappings-otherwise">otherwise</span>
						<span class="creator-mappings-trigger">{section.trigger.trim() || '*'}</span>
						<span class="creator-mappings-arrow" aria-hidden="true">→</span>
						<span class="creator-magic-fallback-output">
							<select
								class="creator-mappings-field creator-mappings-field--fallback"
								value={section.fallbackKind}
								aria-label="Fallback"
								onchange={(event) =>
									updateFallbackKind(
										section.id,
										event.currentTarget.value as CreatorMagicFallbackKind
									)}
							>
								{#each FALLBACK_OPTIONS as option (option.value)}
									<option value={option.value}>{option.label}</option>
								{/each}
							</select>
							{#if section.fallbackKind === 'emit'}
								<input
									class="creator-mappings-field"
									value={section.fallbackEmit}
									aria-label="Fallback text"
									oninput={(event) => updateFallbackEmit(section.id, event.currentTarget.value)}
								/>
							{/if}
						</span>
					</span>
					<span class="creator-mappings-icon-spacer" aria-hidden="true"></span>
				</div>
			</div>
		</div>
	{/each}

	<button type="button" class="creator-mappings-text-button" onclick={addSection}>
		Add section
	</button>
</section>

<style>
	.creator-mappings-panel {
		min-width: 0;
		padding: 0.75rem;
		border: 1px solid var(--border);
		border-radius: 0.5rem;
		background-color: var(--bg-primary);
	}

	.creator-mappings-heading,
	.creator-mappings-group-heading,
	.creator-mappings-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.creator-mappings-heading {
		margin-bottom: 0.625rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.25rem;
	}

	.creator-mappings-section + .creator-mappings-section {
		margin-top: 0.75rem;
	}

	.creator-mappings-section-header {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		margin-bottom: 0.3rem;
	}

	.creator-mappings-group-heading {
		min-width: 0;
		flex: 1;
		color: var(--text-caption);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.creator-mappings-list {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding-inline-start: 1.5rem;
	}

	.creator-mappings-row--disabled .creator-magic-mapping {
		opacity: 0.45;
	}

	.creator-magic-mapping {
		display: grid;
		flex: 1;
		min-width: 0;
		grid-template-columns: minmax(2.5rem, 1fr) minmax(1ch, auto) 1rem minmax(2.5rem, 1fr);
		align-items: center;
		gap: 0.25rem;
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	.creator-magic-mapping--fallback {
		grid-template-columns: auto minmax(1ch, auto) 1rem minmax(5rem, 1fr);
		color: var(--text-secondary);
	}

	.creator-magic-fallback-output {
		display: flex;
		min-width: 0;
		align-items: center;
		gap: 0.25rem;
	}

	.creator-mappings-otherwise {
		font-family: var(--font-sans);
		font-size: 0.75rem;
	}

	.creator-mappings-field {
		width: 100%;
		min-width: 0;
		height: 1.75rem;
		padding: 0 0.35rem;
		border: 1px solid var(--border);
		border-radius: 0.35rem;
		background-color: var(--input-bg);
		color: var(--text-primary);
		font: inherit;
	}

	.creator-mappings-field--trigger {
		max-width: 3.5rem;
	}

	.creator-mappings-field--fallback {
		min-width: 0;
		flex: 1;
		cursor: pointer;
	}

	.creator-mappings-field:focus-visible {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.creator-mappings-trigger {
		color: var(--accent);
	}

	.creator-mappings-arrow {
		color: var(--text-caption);
		text-align: center;
	}

	.creator-mappings-text-button,
	.creator-mappings-icon-button {
		margin: 0;
		border: 0;
		background: transparent;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.creator-mappings-text-button {
		padding: 0.15rem 0;
		font-size: 0.75rem;
		font-weight: 600;
	}

	.creator-mappings-icon-button,
	.creator-mappings-icon-spacer {
		width: 1.5rem;
		height: 1.5rem;
		flex: none;
	}

	.creator-mappings-icon-button {
		padding: 0;
		border-radius: 0.35rem;
		font-size: 1.125rem;
		line-height: 1;
	}

	.creator-mappings-text-button:hover,
	.creator-mappings-icon-button:hover {
		color: var(--text-primary);
	}

	.creator-mappings-text-button:focus-visible,
	.creator-mappings-icon-button:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}

	input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		flex: 0 0 1rem;
		margin: 0;
		accent-color: var(--accent);
		cursor: pointer;
	}

	input[type='checkbox']:disabled {
		cursor: default;
	}
</style>
