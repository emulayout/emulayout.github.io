<script lang="ts">
	import { adaptiveRuleMappingId } from '$lib/inputMappingControls';
	import {
		createCreatorAdaptiveRule,
		createCreatorAdaptiveSection,
		creatorAdaptiveDraftErrors,
		type CreatorAdaptiveDraft,
		type CreatorAdaptiveRule
	} from '$lib/layoutCreatorMappings';

	interface Props {
		draft: CreatorAdaptiveDraft;
		availableKeys?: readonly string[];
		disabledMappingIds?: readonly string[];
		onDraftChange: (draft: CreatorAdaptiveDraft) => void;
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
	const draftErrors = $derived(creatorAdaptiveDraftErrors(draft, availableKeys));

	function compiledRuleId(rule: CreatorAdaptiveRule, groupId?: string): string | null {
		if (draftErrors.has(rule.id)) return null;
		const trigger = rule.trigger.trim().toLowerCase();
		const left = rule.left.trim().toLowerCase();
		const right = rule.right.trim().toLowerCase();
		if (
			Array.from(trigger).length !== 1 ||
			Array.from(left).length !== 1 ||
			Array.from(right).length !== 1 ||
			left === right
		) {
			return null;
		}
		return adaptiveRuleMappingId(groupId, { trigger, left, right });
	}

	function ruleIds(rules: readonly CreatorAdaptiveRule[], groupId?: string): string[] {
		return rules.flatMap((rule) => {
			const id = compiledRuleId(rule, groupId);
			return id ? [id] : [];
		});
	}

	const mappingIds = $derived([
		...ruleIds(draft.rules),
		...draft.groups.flatMap((group) => ruleIds(group.rules, group.id))
	]);

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

	function updateDraft(next: CreatorAdaptiveDraft) {
		onDraftChange(next);
	}

	function addUngroupedRule() {
		updateDraft({ ...draft, rules: [...draft.rules, createCreatorAdaptiveRule()] });
	}

	function updateUngroupedRule(ruleId: string, field: 'trigger' | 'left' | 'right', value: string) {
		updateDraft({
			...draft,
			rules: draft.rules.map((rule) => (rule.id === ruleId ? { ...rule, [field]: value } : rule))
		});
	}

	function removeUngroupedRule(ruleId: string) {
		updateDraft({ ...draft, rules: draft.rules.filter((rule) => rule.id !== ruleId) });
	}

	function addSection() {
		updateDraft({ ...draft, groups: [...draft.groups, createCreatorAdaptiveSection()] });
	}

	function updateSection(sectionId: string, label: string) {
		updateDraft({
			...draft,
			groups: draft.groups.map((group) => (group.id === sectionId ? { ...group, label } : group))
		});
	}

	function removeSection(sectionId: string) {
		updateDraft({
			...draft,
			groups: draft.groups.filter((group) => group.id !== sectionId)
		});
	}

	function addSectionRule(sectionId: string) {
		updateDraft({
			...draft,
			groups: draft.groups.map((group) =>
				group.id === sectionId
					? { ...group, rules: [...group.rules, createCreatorAdaptiveRule()] }
					: group
			)
		});
	}

	function updateSectionRule(
		sectionId: string,
		ruleId: string,
		field: 'trigger' | 'left' | 'right',
		value: string
	) {
		updateDraft({
			...draft,
			groups: draft.groups.map((group) =>
				group.id === sectionId
					? {
							...group,
							rules: group.rules.map((rule) =>
								rule.id === ruleId ? { ...rule, [field]: value } : rule
							)
						}
					: group
			)
		});
	}

	function removeSectionRule(sectionId: string, ruleId: string) {
		updateDraft({
			...draft,
			groups: draft.groups.map((group) =>
				group.id === sectionId
					? { ...group, rules: group.rules.filter((rule) => rule.id !== ruleId) }
					: group
			)
		});
	}
</script>

{#snippet adaptiveRow(
	rule: CreatorAdaptiveRule,
	groupId: string | undefined,
	onField: (field: 'trigger' | 'left' | 'right', value: string) => void,
	onRemove: () => void
)}
	{@const mappingId = compiledRuleId(rule, groupId)}
	{@const ruleError = draftErrors.get(rule.id)}
	{@const ruleErrorId = `creator-adaptive-rule-error-${rule.id}`}
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
		<span class="creator-adaptive-mapping">
			<input
				class="creator-mappings-field"
				value={rule.trigger}
				aria-label="Trigger"
				aria-invalid={ruleError ? 'true' : undefined}
				aria-describedby={ruleError ? ruleErrorId : undefined}
				oninput={(event) => onField('trigger', event.currentTarget.value)}
			/>
			<span class="creator-mappings-punctuation" aria-hidden="true">:</span>
			<input
				class="creator-mappings-field"
				value={rule.left}
				aria-label="Left"
				aria-invalid={ruleError ? 'true' : undefined}
				aria-describedby={ruleError ? ruleErrorId : undefined}
				oninput={(event) => onField('left', event.currentTarget.value)}
			/>
			<span class="creator-mappings-arrow" aria-hidden="true">↔</span>
			<input
				class="creator-mappings-field"
				value={rule.right}
				aria-label="Right"
				aria-invalid={ruleError ? 'true' : undefined}
				aria-describedby={ruleError ? ruleErrorId : undefined}
				oninput={(event) => onField('right', event.currentTarget.value)}
			/>
		</span>
		<button
			type="button"
			class="creator-mappings-icon-button"
			aria-label="Delete mapping"
			onclick={onRemove}
		>
			<span aria-hidden="true">×</span>
		</button>
	</div>
	{#if ruleError}
		<p id={ruleErrorId} class="creator-mappings-error">{ruleError}</p>
	{/if}
{/snippet}

<section class="creator-mappings-panel" aria-label="Adaptive swap mappings">
	<label class="creator-mappings-heading">
		<input
			type="checkbox"
			checked={allEnabled(mappingIds)}
			indeterminate={someEnabled(mappingIds) && !allEnabled(mappingIds)}
			disabled={mappingIds.length === 0}
			onchange={(event) => setMappingsEnabled(mappingIds, event.currentTarget.checked)}
		/>
		<span>Adaptive swap mappings</span>
	</label>

	<div class="creator-mappings-list">
		{#each draft.rules as rule (rule.id)}
			{@render adaptiveRow(
				rule,
				undefined,
				(field, value) => updateUngroupedRule(rule.id, field, value),
				() => removeUngroupedRule(rule.id)
			)}
		{/each}
	</div>
	<button type="button" class="creator-mappings-text-button" onclick={addUngroupedRule}>
		Add mapping
	</button>

	{#each draft.groups as group (group.id)}
		{@const sectionIds = ruleIds(group.rules, group.id)}
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
						class="creator-mappings-field creator-mappings-field--label"
						value={group.label}
						aria-label="Section name"
						placeholder="New section"
						oninput={(event) => updateSection(group.id, event.currentTarget.value)}
					/>
				</div>
				<button
					type="button"
					class="creator-mappings-text-button"
					onclick={() => addSectionRule(group.id)}
				>
					Add mapping
				</button>
				<button
					type="button"
					class="creator-mappings-icon-button"
					aria-label="Delete section"
					onclick={() => removeSection(group.id)}
				>
					<span aria-hidden="true">×</span>
				</button>
			</div>
			<div class="creator-mappings-list">
				{#each group.rules as rule (rule.id)}
					{@render adaptiveRow(
						rule,
						group.id,
						(field, value) => updateSectionRule(group.id, rule.id, field, value),
						() => removeSectionRule(group.id, rule.id)
					)}
				{/each}
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

	.creator-mappings-error {
		margin: 0.35rem 0 0 2rem;
		color: var(--keyboard-input-validation-error);
		font-size: 0.75rem;
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

	.creator-mappings-section {
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
	}

	.creator-mappings-section .creator-mappings-list {
		padding-inline-start: 1.5rem;
	}

	.creator-mappings-row--disabled .creator-adaptive-mapping {
		opacity: 0.45;
	}

	.creator-adaptive-mapping {
		display: grid;
		flex: 1;
		min-width: 0;
		grid-template-columns: minmax(2rem, 1fr) 0.75rem minmax(2rem, 1fr) 1.25rem minmax(2rem, 1fr);
		align-items: center;
		gap: 0.2rem;
		font-family: var(--font-mono);
		font-size: 0.875rem;
	}

	.creator-mappings-field {
		width: 100%;
		min-width: 0;
		height: 1.75rem;
		padding: 0 0.35rem;
		border: 1px solid var(--border);
		border-radius: 0.35rem;
		background: var(--input-bg);
		color: var(--text-primary);
		font: inherit;
	}

	.creator-mappings-field--label {
		max-width: 8rem;
	}

	.creator-mappings-field:focus-visible {
		outline: none;
		border-color: var(--accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 35%, transparent);
	}

	.creator-mappings-arrow,
	.creator-mappings-punctuation {
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

	.creator-mappings-icon-button {
		width: 1.5rem;
		height: 1.5rem;
		flex: none;
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
		background-color: var(--adaptive-key);
		border-color: var(--adaptive-key);
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
		outline: 2px solid var(--adaptive-key);
		outline-offset: 1px;
	}

	input[type='checkbox']:disabled {
		cursor: default;
	}
</style>
