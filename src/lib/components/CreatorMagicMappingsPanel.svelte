<script lang="ts">
	import { magicFallbackMappingId, magicRuleMappingId } from '$lib/inputMappingControls';
	import {
		createCreatorMagicRule,
		createCreatorMagicSection,
		creatorMagicFallbackSource,
		creatorMagicTriggerError,
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
		availableKeys?: readonly string[];
		disabledMappingIds?: readonly string[];
		onDraftChange: (draft: CreatorMagicDraft) => void;
		onDisabledMappingIdsChange?: (ids: string[]) => void;
	}

	const {
		draft,
		availableKeys,
		disabledMappingIds = [],
		onDraftChange,
		onDisabledMappingIdsChange
	}: Props = $props();
	const disabledIds = $derived(new Set(disabledMappingIds));

	function compiledRuleId(trigger: string, after: string): string | null {
		const nextTrigger = trigger.trim();
		const nextAfter = after.trim().toLowerCase();
		if (!nextTrigger || !nextAfter || creatorMagicTriggerError(nextTrigger, availableKeys))
			return null;
		return magicRuleMappingId(nextTrigger, nextAfter);
	}

	function compiledFallbackId(section: CreatorMagicSection): string | null {
		const trigger = section.trigger.trim();
		if (
			!trigger ||
			creatorMagicTriggerError(trigger, availableKeys) ||
			!creatorMagicFallbackSource(section)
		) {
			return null;
		}
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
		{@const triggerError = creatorMagicTriggerError(section.trigger, availableKeys)}
		{@const triggerErrorId = `creator-magic-trigger-error-${section.id}`}
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
						aria-invalid={triggerError ? 'true' : undefined}
						aria-describedby={triggerError ? triggerErrorId : undefined}
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
			{#if triggerError}
				<p id={triggerErrorId} class="creator-mappings-error">{triggerError}</p>
			{/if}

			<table class="creator-mappings-list">
				<tbody>
					{#each section.rules as rule (rule.id)}
						{@const mappingId = compiledRuleId(section.trigger, rule.after)}
						<tr
							class="creator-mappings-row"
							class:creator-mappings-row--disabled={mappingId !== null &&
								disabledIds.has(mappingId)}
						>
							<td>
								<input
									type="checkbox"
									checked={mappingId !== null && !disabledIds.has(mappingId)}
									disabled={mappingId === null}
									aria-label="Enable mapping"
									onchange={(event) => {
										if (mappingId) setMappingsEnabled([mappingId], event.currentTarget.checked);
									}}
								/>
							</td>
							<td class="creator-mappings-context">
								<input
									class="creator-mappings-field creator-mappings-field--after"
									size="1"
									value={rule.after}
									aria-label="Preceding"
									oninput={(event) =>
										updateRule(section.id, rule.id, 'after', event.currentTarget.value)}
								/>
							</td>
							<td class="creator-mappings-trigger">{section.trigger.trim() || '*'}</td>
							<td class="creator-mappings-arrow" aria-hidden="true">→</td>
							<td class="creator-mappings-output">
								<input
									class="creator-mappings-field"
									value={rule.emit}
									aria-label="Emit"
									oninput={(event) =>
										updateRule(section.id, rule.id, 'emit', event.currentTarget.value)}
								/>
							</td>
							<td>
								<button
									type="button"
									class="creator-mappings-icon-button"
									aria-label="Delete mapping"
									onclick={() => removeRule(section.id, rule.id)}
								>
									<span aria-hidden="true">×</span>
								</button>
							</td>
						</tr>
					{/each}
					<tr
						class="creator-mappings-row creator-mappings-row--fallback"
						class:creator-mappings-row--disabled={fallbackId !== null &&
							disabledIds.has(fallbackId)}
					>
						<td>
							<input
								type="checkbox"
								checked={fallbackId !== null && !disabledIds.has(fallbackId)}
								disabled={fallbackId === null}
								aria-label="Enable fallback"
								onchange={(event) => {
									if (fallbackId) setMappingsEnabled([fallbackId], event.currentTarget.checked);
								}}
							/>
						</td>
						<td class="creator-mappings-context">
							<span class="creator-mappings-otherwise">otherwise</span>
						</td>
						<td class="creator-mappings-trigger">{section.trigger.trim() || '*'}</td>
						<td class="creator-mappings-arrow" aria-hidden="true">→</td>
						<td class="creator-mappings-output">
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
						</td>
						<td>
							<span class="creator-mappings-icon-spacer" aria-hidden="true"></span>
						</td>
					</tr>
				</tbody>
			</table>
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

	.creator-mappings-error {
		margin: 0.35rem 0 0;
		color: var(--keyboard-input-validation-error);
		font-size: 0.75rem;
	}

	.creator-mappings-heading,
	.creator-mappings-group-heading {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.creator-mappings-row:has(.creator-magic-fallback-output input) td {
		vertical-align: top;
	}

	.creator-mappings-row:has(.creator-magic-fallback-output input) td:first-child,
	.creator-mappings-row:has(.creator-magic-fallback-output input) td:last-child {
		padding-top: 0.375rem;
	}

	.creator-mappings-heading {
		margin-bottom: 0.625rem;
		color: var(--text-secondary);
		font-size: 0.875rem;
		font-weight: 600;
		line-height: 1.25rem;
	}

	.creator-mappings-section {
		display: grid;
		grid-template-columns: 1.25rem minmax(0, 1fr) 1.5rem;
		align-items: start;
		min-width: 0;
	}

	.creator-mappings-section + .creator-mappings-section {
		margin-top: 0.75rem;
	}

	.creator-mappings-section-header {
		display: flex;
		grid-column: 1 / -1;
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
		grid-column: 2 / -1;
		width: 100%;
		min-width: 0;
		margin: 0;
		padding: 0;
		border-collapse: collapse;
		border-spacing: 0;
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	.creator-mappings-list td {
		padding: 0.175rem 0.25rem;
		vertical-align: middle;
	}

	.creator-mappings-list td:last-child {
		width: 1.5rem;
		padding-inline: 0;
	}

	.creator-mappings-row--disabled td:not(:first-child):not(:last-child) {
		opacity: 0.45;
	}

	.creator-mappings-row--fallback {
		color: var(--text-secondary);
	}

	.creator-mappings-context {
		width: 1%;
		white-space: nowrap;
	}

	.creator-mappings-output {
		width: 100%;
	}

	.creator-magic-fallback-output {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 0.25rem;
		min-width: 0;
	}

	.creator-magic-fallback-output .creator-mappings-field {
		width: 100%;
	}

	.creator-mappings-otherwise {
		display: block;
		font-family: var(--font-sans);
		font-size: 0.75rem;
		line-height: 1.75rem;
		white-space: nowrap;
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
		text-align: start;
	}

	.creator-mappings-field--after {
		display: block;
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}

	.creator-mappings-field--trigger {
		max-width: 3.5rem;
	}

	.creator-mappings-field--fallback {
		min-width: 0;
		width: 100%;
		cursor: pointer;
	}

	.creator-mappings-field:focus-visible {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.creator-mappings-trigger,
	.creator-mappings-arrow {
		font-family: var(--font-mono);
		font-size: 0.875rem;
		white-space: nowrap;
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
		appearance: none;
		-webkit-appearance: none;
		box-sizing: border-box;
		width: 1rem;
		height: 1rem;
		flex: 0 0 1rem;
		margin: 0;
		border: 1px solid var(--border);
		border-radius: 0.2rem;
		background-color: var(--bg-primary);
		background-position: center;
		background-repeat: no-repeat;
		background-size: 0.7rem 0.7rem;
		cursor: pointer;
	}

	input[type='checkbox']:checked,
	input[type='checkbox']:indeterminate {
		background-color: var(--magic-key);
		border-color: var(--magic-key);
	}

	input[type='checkbox']:checked {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23f4f4f4' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round' d='M3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E");
	}

	input[type='checkbox']:indeterminate {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23f4f4f4' stroke-width='2.25' stroke-linecap='round' d='M4 8h8'/%3E%3C/svg%3E");
	}

	:global(.dark) input[type='checkbox']:checked {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23100f0d' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round' d='M3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E");
	}

	:global(.dark) input[type='checkbox']:indeterminate {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='none' stroke='%23100f0d' stroke-width='2.25' stroke-linecap='round' d='M4 8h8'/%3E%3C/svg%3E");
	}

	input[type='checkbox']:focus-visible {
		outline: 2px solid var(--magic-key);
		outline-offset: 1px;
	}

	input[type='checkbox']:disabled {
		cursor: default;
	}
</style>
