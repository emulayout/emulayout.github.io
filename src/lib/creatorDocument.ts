import { normalizeTypingPracticeLessonSettings } from '$lib/typingPracticeText';
import { LAYOUT_CREATOR_NEW_LAYOUT_NAME } from '$lib/layoutCreator';
import { compileSparkLayout } from '$lib/sparkCompiler';
import {
	validateSparkLayout,
	type SparkLayout,
	type SparkKey,
	type SparkMagic
} from '$lib/sparkSchema';
import { buildKeyboardInputConfig, parseKeyboardInputSlot } from '$lib/keyboardInputConfig';
import { magicDraftFromSource, adaptiveDraftFromSource } from '$lib/layoutCreatorMappings';
import { chiralDraftFromSource } from '$lib/creatorChiralMappings';
import type { CreatorContentSnapshot } from '$lib/layoutCreatorUrl';

export const CREATOR_DOCUMENT_VERSION = 1;
export type CreatorDocument = {
	version: typeof CREATOR_DOCUMENT_VERSION;
	format: 'spark/1';
	layout: SparkLayout;
	/** Editor recovery, app preferences, and multi-character fallbacks stay outside Spark. */
	emulayout: Omit<CreatorContentSnapshot, 'sparkSource' | 'sparkEditorBaseline'>;
};

function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function character(value: string) {
	return Array.from(value).length === 1;
}
function copy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export function creatorSparkProjection(content: CreatorContentSnapshot): SparkLayout {
	const keys: SparkKey[] = content.keyConfig.keys.flatMap((key) => {
		const position = parseKeyboardInputSlot(key.slot);
		if (!position || !Number.isSafeInteger(position.row) || !Number.isSafeInteger(position.column))
			return [];
		const { row, column: col } = position;
		let finger: SparkKey['finger'] =
			row >= 3
				? key.thumbHand === 'r'
					? 'RT'
					: 'LT'
				: ((['LP', 'LR', 'LM', 'LI', 'LI', 'RI', 'RI', 'RM', 'RR', 'RP'] as const)[col] ?? 'RP');
		if (key.hand && !finger.startsWith(key.hand.toUpperCase()))
			finger = `${key.hand.toUpperCase()}${finger.slice(1)}` as SparkKey['finger'];
		return [{ row, col, finger, ...(character(key.value) ? { char: key.value } : {}) }];
	});
	// Spark's first occurrence is primary. Move explicit primary duplicates ahead of their peers.
	for (const key of content.keyConfig.keys.filter((key) => key.primary && key.value)) {
		const current = keys.findIndex((entry) => `${entry.row},${entry.col}` === key.slot);
		const first = keys.findIndex((entry) => entry.char === key.value);
		if (current > first && first >= 0) keys.splice(first, 0, ...keys.splice(current, 1));
	}
	const magic: SparkMagic = {};
	magic.magic_keys = content.magicDraft.sections.flatMap((section) => {
		const key = section.trigger.trim();
		if (!character(key)) return [];
		const rules = section.rules
			.filter((rule) => rule.after && rule.emit)
			.map(({ after, emit }) => ({ after, emit }));
		const fallback =
			section.fallbackKind === 'repeat-last'
				? { kind: 'repeat' as const }
				: section.fallbackKind === 'emit' && character(section.fallbackEmit)
					? { kind: 'char' as const, char: section.fallbackEmit }
					: undefined;
		if (!rules.length && !fallback && !(section.fallbackKind === 'emit' && section.fallbackEmit))
			return [];
		return [
			{ key, ...(rules.length ? { rules } : {}), ...(fallback ? { default: fallback } : {}) }
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
			? [{ trigger, swap: [left, right] as [string, string] }]
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
			(key) => JSON.stringify(before.get(key)) !== JSON.stringify(after.get(key))
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
				JSON.stringify(before.get(id)?.[field]) === JSON.stringify(next[field]) &&
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

export function buildCreatorDocument(content: CreatorContentSnapshot): CreatorDocument {
	const { sparkSource, sparkEditorBaseline, ...editor } = copy(content);
	void sparkEditorBaseline;
	delete (editor as Record<string, unknown>).preview;
	delete (editor as Record<string, unknown>).section;
	editor.name = editor.name.trim() || LAYOUT_CREATOR_NEW_LAYOUT_NAME;
	editor.author = editor.author.trim();
	editor.practiceLesson = normalizeTypingPracticeLessonSettings(editor.practiceLesson);
	editor.disabledMappingIds = [
		...new Set(editor.disabledMappingIds.map((id) => id.trim()).filter(Boolean))
	].sort();
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
				(key) => JSON.stringify(beforeMagic.get(key)) !== JSON.stringify(afterMagic.get(key))
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
	return {
		version: CREATOR_DOCUMENT_VERSION,
		format: 'spark/1',
		layout: validateSparkLayout(layout),
		emulayout: editor
	};
}

function strings(value: unknown, fields: string[]): boolean {
	return (
		record(value) &&
		fields.every((field) => typeof value[field] === 'string') &&
		(!fields.includes('id') || Boolean(value.id))
	);
}
function rows(value: unknown, fields: string[]): boolean {
	return (
		Array.isArray(value) &&
		new Set(value.map((row) => (record(row) ? row.id : null))).size === value.length &&
		value.every((row) => strings(row, ['id', ...fields]))
	);
}

/** Strict document boundary; malformed sidecars never fall back to unrelated legacy fields. */
export function readCreatorDocument(value: unknown): CreatorContentSnapshot | null {
	try {
		if (!record(value) || value.version !== 1 || value.format !== 'spark/1') return null;
		const source = validateSparkLayout(value.layout);
		const e = value.emulayout;
		if (
			!record(e) ||
			!strings(e, ['name', 'author']) ||
			!['includeMagicKey', 'includeAdaptiveKey'].every((field) => typeof e[field] === 'boolean') ||
			(e.includeChiralKey !== undefined && typeof e.includeChiralKey !== 'boolean')
		)
			return null;
		const config = e.keyConfig;
		if (
			!record(config) ||
			!['ortho', 'staggered'].includes(String(config.keyboardType)) ||
			(config.baseLayoutName !== null && typeof config.baseLayoutName !== 'string') ||
			typeof config.baseLayoutModified !== 'boolean' ||
			!Array.isArray(config.keys)
		)
			return null;
		const slots = new Set<string>();
		for (const key of config.keys) {
			if (
				!strings(key, ['slot', 'value']) ||
				!record(key) ||
				!parseKeyboardInputSlot(String(key.slot)) ||
				slots.has(String(key.slot))
			)
				return null;
			if (
				['inert', 'primary'].some(
					(field) => key[field] !== undefined && typeof key[field] !== 'boolean'
				) ||
				['hand', 'thumbHand'].some(
					(field) => key[field] !== undefined && key[field] !== 'l' && key[field] !== 'r'
				)
			)
				return null;
			const position = parseKeyboardInputSlot(String(key.slot))!;
			if (
				!Number.isSafeInteger(position.row) ||
				!Number.isSafeInteger(position.column) ||
				position.row > 4 ||
				position.column > 12
			)
				return null;
			slots.add(String(key.slot));
		}
		const m = e.magicDraft,
			a = e.adaptiveDraft,
			c = e.chiralDraft;
		if (
			!record(m) ||
			!Array.isArray(m.sections) ||
			new Set(m.sections.map((section) => (record(section) ? section.id : null))).size !==
				m.sections.length ||
			!m.sections.every(
				(section) =>
					strings(section, ['id', 'trigger', 'fallbackEmit']) &&
					record(section) &&
					['no-op', 'repeat-last', 'emit'].includes(String(section.fallbackKind)) &&
					rows(section.rules, ['after', 'emit'])
			)
		)
			return null;
		if (
			!record(a) ||
			!rows(a.rules, ['trigger', 'left', 'right']) ||
			!Array.isArray(a.groups) ||
			new Set(a.groups.map((group) => (record(group) ? group.id : null))).size !==
				a.groups.length ||
			!a.groups.every(
				(group) =>
					strings(group, ['id', 'label']) &&
					record(group) &&
					rows(group.rules, ['trigger', 'left', 'right'])
			)
		)
			return null;
		if (
			c !== undefined &&
			(!record(c) ||
				!rows(c.rules, ['key', 'sameChar', 'oppositeChar', 'except']) ||
				!(c.rules as Record<string, unknown>[]).every((rule) =>
					['sameKind', 'oppositeKind'].every((field) =>
						['key', 'char', 'repeat'].includes(String(rule[field]))
					)
				))
		)
			return null;
		if (
			!Array.isArray(e.disabledMappingIds) ||
			!e.disabledMappingIds.every((id) => typeof id === 'string') ||
			!record(e.practiceLesson) ||
			(e.practiceLesson.customText !== null && typeof e.practiceLesson.customText !== 'string') ||
			typeof e.practiceLesson.specialWordsPercent !== 'number' ||
			!Number.isFinite(e.practiceLesson.specialWordsPercent) ||
			![10, 25, 50].includes(Number(e.practiceLesson.wordCount))
		)
			return null;
		const content = copy(e) as Omit<CreatorContentSnapshot, 'sparkSource' | 'sparkEditorBaseline'>;
		content.practiceLesson = normalizeTypingPracticeLessonSettings(content.practiceLesson);
		return {
			...content,
			sparkSource: source,
			sparkEditorBaseline: creatorSparkProjection(content)
		};
	} catch {
		return null;
	}
}

/** Stable comparisons ignore transient row IDs while preserving group identities used by toggles. */
export function creatorDocumentSignature(content: CreatorContentSnapshot): string {
	function stable(value: unknown, editor = false): unknown {
		if (Array.isArray(value)) return value.map((entry) => stable(entry, editor));
		if (!record(value)) return value;
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.filter((key) => !editor || key !== 'id' || 'label' in value)
				.map((key) => [key, stable(value[key], editor)])
		);
	}
	const document = buildCreatorDocument(content);
	return JSON.stringify({
		version: document.version,
		format: document.format,
		layout: stable(document.layout),
		emulayout: stable(document.emulayout, true)
	});
}
