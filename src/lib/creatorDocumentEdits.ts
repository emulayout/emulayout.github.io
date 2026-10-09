import { creatorSparkKeys } from '$lib/creatorGeometry';
import { compileSparkLayout } from '$lib/sparkCompiler';
import type { SparkLayout, SparkMagic } from '$lib/sparkSchema';
import { buildKeyboardInputConfig } from '$lib/keyboardInputConfig';
import { magicDraftFromSource, adaptiveDraftFromSource } from '$lib/layoutCreatorMappings';
import { chiralDraftFromSource } from '$lib/creatorChiralMappings';
import type { CreatorContentSnapshot } from '$lib/creatorContent';

function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function character(value: string) {
	return Array.from(value).length === 1;
}
function copy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export function creatorSparkProjection(
	content: CreatorContentSnapshot,
	legacyPrimary = false
): SparkLayout {
	const keys = creatorSparkKeys(content.keyConfig, legacyPrimary ? 'first' : 'last');
	const magic: SparkMagic = {};
	magic.magic_keys = content.magicDraft.sections.flatMap((section) => {
		const key = section.trigger.trim();
		if (!character(key)) return [];
		const rules = section.rules
			.filter((rule) => rule.after && rule.emit)
			.map(({ after, emit, sparkExtensions }) => ({ ...sparkExtensions, after, emit }));
		const fallback =
			section.fallbackKind === 'repeat-last'
				? { kind: 'repeat' as const }
				: section.fallbackKind === 'emit' && character(section.fallbackEmit)
					? { kind: 'char' as const, char: section.fallbackEmit }
					: undefined;
		if (!rules.length && !fallback && !(section.fallbackKind === 'emit' && section.fallbackEmit))
			return [];
		return [
			{
				...section.sparkExtensions,
				key,
				...(rules.length ? { rules } : {}),
				...(fallback ? { default: fallback } : {})
			}
		];
	});
	magic.adaptive_swaps = [
		...content.adaptiveDraft.rules,
		...content.adaptiveDraft.groups.flatMap((group) => group.rules)
	].flatMap((rule) => {
		const trigger = rule.trigger.trim(),
			left = rule.left.trim(),
			right = rule.right.trim();
		return [trigger, left, right].every(character)
			? [{ ...rule.sparkExtensions, trigger, swap: [left, right] as [string, string] }]
			: [];
	});
	magic.chiral_keys = (content.chiralDraft?.rules ?? []).flatMap((rule) => {
		if (!character(rule.key)) return [];
		if (
			(rule.sameKind === 'char' && !character(rule.sameChar)) ||
			(rule.oppositeKind === 'char' && !character(rule.oppositeChar))
		)
			return [];
		const output = (kind: string, char: string) =>
			kind === 'repeat'
				? { kind: 'repeat' as const }
				: kind === 'char'
					? { kind: 'char' as const, char }
					: undefined;
		return [
			{
				...rule.sparkExtensions,
				key: rule.key,
				same: output(rule.sameKind, rule.sameChar),
				opposite: output(rule.oppositeKind, rule.oppositeChar),
				...(rule.except ? { except: Array.from(rule.except) } : {})
			}
		];
	});
	for (const field of ['magic_keys', 'adaptive_swaps', 'chiral_keys'] as const)
		if (!magic[field]?.length) delete magic[field];
	return copy({ keys, ...(Object.keys(magic).length ? { magic } : {}) });
}

function projectedField(field: string, value: unknown): unknown {
	return field === 'rules' && Array.isArray(value)
		? value.map((rule) => (record(rule) ? { after: rule.after, emit: rule.emit } : rule))
		: value;
}
function projectedIdentity(
	entry: Record<string, unknown> | undefined,
	known: string[]
): string | undefined {
	if (!entry) return undefined;
	return JSON.stringify(
		Object.fromEntries(
			known
				.filter((field) => field !== 'except' || !known.includes('rules'))
				.map((field) => [field, projectedField(field, entry[field])])
		)
	);
}

/** Merge only edited identities. Untouched unsupported data and extension fields remain canonical. */
function reconcile<T extends Record<string, unknown>>(
	original: T[],
	baseline: T[],
	current: T[],
	identity: (entry: T) => string,
	known: string[]
): T[] {
	const before = new Map(baseline.map((entry) => [identity(entry), entry]));
	const after = new Map(current.map((entry) => [identity(entry), entry]));
	const changed = new Set(
		[...before.keys(), ...after.keys()].filter(
			(key) =>
				projectedIdentity(before.get(key), known) !== projectedIdentity(after.get(key), known)
		)
	);
	const result = original.flatMap((entry) => {
		const id = identity(entry);
		if (!changed.has(id)) return [entry];
		const next = after.get(id);
		if (!next) return [];
		after.delete(id);
		const merged: Record<string, unknown> = { ...entry };
		for (const field of new Set([...known, ...Object.keys(next)])) {
			if (
				JSON.stringify(projectedField(field, before.get(id)?.[field])) ===
					JSON.stringify(projectedField(field, next[field])) &&
				Object.hasOwn(entry, field)
			)
				continue;
			if (Object.hasOwn(next, field)) merged[field] = next[field];
			else delete merged[field];
		}
		if (Array.isArray(entry.rules) && Array.isArray(merged.rules)) {
			merged.rules = merged.rules.map((rule) => {
				if (!record(rule)) return rule;
				const old = (entry.rules as unknown[]).find(
					(original) => record(original) && original.after === rule.after
				);
				return record(old) ? { ...old, ...rule } : rule;
			});
		}
		return [merged as T];
	});
	for (const [id, entry] of after)
		if (changed.has(id) && !original.some((old) => identity(old) === id)) result.push(entry);
	return result;
}

/** Apply supported editor changes while retaining untouched source-only content. */
export function reconcileCreatorSpark(content: CreatorContentSnapshot): SparkLayout {
	const sparkSource = content.sparkSource;
	const current = creatorSparkProjection(content);
	let layout = current;
	if (sparkSource) {
		const compiled = compileSparkLayout(sparkSource);
		const baseline =
			content.sparkEditorBaseline ??
			creatorSparkProjection({
				...content,
				keyConfig: buildKeyboardInputConfig({ ...content.keyConfig, keys: compiled.keys }),
				magicDraft: magicDraftFromSource(compiled.source.magicKeys),
				adaptiveDraft: adaptiveDraftFromSource(compiled.source.adaptiveSwaps),
				chiralDraft: chiralDraftFromSource(compiled.source.chiralKeys)
			});
		layout = copy(sparkSource);
		layout.keys = reconcile(
			layout.keys,
			baseline.keys,
			current.keys,
			(key) => `${key.row},${key.col}`,
			['char', 'finger']
		);
		// A changed primary duplicate must also change Spark's first-occurrence ordering.
		for (const key of current.keys) {
			if (!key.char || current.keys.find((entry) => entry.char === key.char) !== key) continue;
			const previous = baseline.keys.find((entry) => entry.char === key.char);
			if (previous?.row === key.row && previous.col === key.col) continue;
			const index = layout.keys.findIndex(
				(entry) => entry.row === key.row && entry.col === key.col
			);
			const first = layout.keys.findIndex((entry) => entry.char === key.char);
			if (index > first && first >= 0)
				layout.keys.splice(first, 0, ...layout.keys.splice(index, 1));
		}
		const magic = layout.magic ?? {};
		const beforeMagic = new Map((baseline.magic?.magic_keys ?? []).map((key) => [key.key, key]));
		const afterMagic = new Map((current.magic?.magic_keys ?? []).map((key) => [key.key, key]));
		const editedTriggers = new Set(
			[...beforeMagic.keys(), ...afterMagic.keys()].filter(
				(key) =>
					projectedIdentity(beforeMagic.get(key), ['key', 'rules', 'default']) !==
					projectedIdentity(afterMagic.get(key), ['key', 'rules', 'default'])
			)
		);
		if (magic.rules)
			magic.rules = magic.rules.filter((rule) => {
				const input = Array.from(rule.inputs),
					trigger = input.pop() ?? '',
					after = input.join('');
				return (
					!editedTriggers.has(trigger) ||
					!after ||
					!rule.output.startsWith(after) ||
					rule.output.length === after.length
				);
			});
		for (const field of ['magic_keys', 'chiral_keys', 'adaptive_swaps'] as const) {
			const original = magic[field] ?? [];
			const before = baseline.magic?.[field] ?? [],
				after = current.magic?.[field] ?? [];
			const known =
				field === 'magic_keys'
					? ['key', 'rules', 'default', 'except']
					: field === 'chiral_keys'
						? ['key', 'same', 'opposite', 'except']
						: ['trigger', 'swap'];
			const identity = (entry: Record<string, unknown>) =>
				field === 'adaptive_swaps'
					? `${entry.trigger}\0${JSON.stringify(entry.swap)}`
					: String(entry.key);
			const merged = reconcile<Record<string, unknown>>(original, before, after, identity, known);
			if (merged.length) Object.assign(magic, { [field]: merged });
			else delete magic[field];
		}
		if (Object.keys(magic).length) layout.magic = magic;
		else delete layout.magic;
	}
	return layout;
}

/** Carry metadata onto the caller-owned next draft; stable identities decide what survives. */
export function retainCreatorSourceExtensions(
	previous: CreatorContentSnapshot,
	next: CreatorContentSnapshot,
	layout: SparkLayout
): void {
	const residue = (source: Record<string, unknown> | undefined, known: string[]) =>
		Object.fromEntries(Object.entries(source ?? {}).filter(([field]) => !known.includes(field)));
	for (const section of next.magicDraft.sections) {
		const before = previous.magicDraft.sections.find((candidate) => candidate.id === section.id);
		if (!before) continue;
		const source = layout.magic?.magic_keys?.find((key) => key.key === before.trigger.trim());
		section.sparkExtensions = {
			...residue(source, ['key', 'rules', 'default']),
			...section.sparkExtensions
		};
		for (const rule of section.rules) {
			const old = before.rules.find((candidate) => candidate.id === rule.id);
			const sourceRule = source?.rules?.find((candidate) => candidate.after === old?.after);
			rule.sparkExtensions = { ...residue(sourceRule, ['after', 'emit']), ...rule.sparkExtensions };
		}
	}
	const beforeAdaptive = [
		...previous.adaptiveDraft.rules,
		...previous.adaptiveDraft.groups.flatMap((group) => group.rules)
	];
	for (const rule of [
		...next.adaptiveDraft.rules,
		...next.adaptiveDraft.groups.flatMap((group) => group.rules)
	]) {
		const before = beforeAdaptive.find((candidate) => candidate.id === rule.id);
		if (!before) continue;
		const source = layout.magic?.adaptive_swaps?.find(
			(entry) =>
				entry.trigger.toLowerCase() === before.trigger.trim().toLowerCase() &&
				entry.swap[0].toLowerCase() === before.left.trim().toLowerCase() &&
				entry.swap[1].toLowerCase() === before.right.trim().toLowerCase()
		);
		rule.sparkExtensions = { ...residue(source, ['trigger', 'swap']), ...rule.sparkExtensions };
	}
	for (const rule of next.chiralDraft?.rules ?? []) {
		const before = previous.chiralDraft?.rules.find((candidate) => candidate.id === rule.id);
		const source = layout.magic?.chiral_keys?.find((entry) => entry.key === before?.key);
		rule.sparkExtensions = {
			...residue(source, ['key', 'same', 'opposite', 'except']),
			...rule.sparkExtensions
		};
	}
	for (const section of next.magicDraft.sections) {
		if (!Object.keys(section.sparkExtensions ?? {}).length) delete section.sparkExtensions;
		for (const rule of section.rules)
			if (!Object.keys(rule.sparkExtensions ?? {}).length) delete rule.sparkExtensions;
	}
	for (const rule of [
		...next.adaptiveDraft.rules,
		...next.adaptiveDraft.groups.flatMap((group) => group.rules),
		...(next.chiralDraft?.rules ?? [])
	])
		if (!Object.keys(rule.sparkExtensions ?? {}).length) delete rule.sparkExtensions;
}
