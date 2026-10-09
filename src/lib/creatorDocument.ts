import {
	creatorSparkProjection,
	reconcileCreatorSpark,
	retainCreatorSourceExtensions
} from '$lib/creatorDocumentEdits';
import { normalizeTypingPracticeLessonSettings } from '$lib/typingPracticeText';
import { LAYOUT_CREATOR_NEW_LAYOUT_NAME } from '$lib/layoutCreator';
import { validateSparkLayout, type SparkLayout } from '$lib/sparkSchema';
import { parseKeyboardInputSlot } from '$lib/keyboardInputConfig';
import {
	compactCreatorEditor,
	expandCreatorEditor,
	type CreatorEditorRecovery
} from '$lib/creatorEditorRecovery';
import type { CreatorContentSnapshot } from '$lib/creatorContent';

export const CREATOR_DOCUMENT_VERSION = 2;
export type CreatorDocument = {
	version: typeof CREATOR_DOCUMENT_VERSION;
	format: 'spark/1';
	layout: SparkLayout;
	/** Editor recovery, app preferences, and multi-character fallbacks stay outside Spark. */
	emulayout: CreatorEditorRecovery;
};

function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function copy<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

export function buildCreatorDocument(content: CreatorContentSnapshot): CreatorDocument {
	// Normalize reactive drafts before Spark validation, which uses structuredClone.
	const normalized = copy(content);
	const { sparkSource, sparkEditorBaseline, ...editor } = normalized;
	void sparkSource;
	void sparkEditorBaseline;
	delete (editor as Record<string, unknown>).preview;
	delete (editor as Record<string, unknown>).section;
	editor.name = editor.name.trim() || LAYOUT_CREATOR_NEW_LAYOUT_NAME;
	editor.author = editor.author.trim();
	editor.practiceLesson = normalizeTypingPracticeLessonSettings(editor.practiceLesson);
	editor.disabledMappingIds = [
		...new Set(editor.disabledMappingIds.map((id) => id.trim()).filter(Boolean))
	].sort();
	const layout = reconcileCreatorSpark(normalized);
	return {
		version: CREATOR_DOCUMENT_VERSION,
		format: 'spark/1',
		layout: validateSparkLayout(layout),
		emulayout: compactCreatorEditor(layout, editor)
	};
}

/** Carry source-only fields through an incomplete edit; deleting the row deletes its recovery too. */
export function updateCreatorDocument(
	document: CreatorDocument,
	patch: Partial<CreatorContentSnapshot>
): CreatorDocument {
	const previous = readCreatorDocument(document);
	if (!previous) throw new Error('Cannot edit an invalid creator document');
	const next = copy({ ...previous, ...patch });
	if (Object.hasOwn(patch, 'sparkSource')) return buildCreatorDocument(next);
	retainCreatorSourceExtensions(previous, next, document.layout);
	return buildCreatorDocument(next);
}

function strings(value: unknown, fields: string[]): boolean {
	return (
		record(value) &&
		fields.every((field) => typeof value[field] === 'string') &&
		(!fields.includes('id') || Boolean(value.id)) &&
		(value.sparkExtensions === undefined || record(value.sparkExtensions))
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
		if (
			!record(value) ||
			(value.version !== 1 && value.version !== 2) ||
			value.format !== 'spark/1'
		)
			return null;
		const source = validateSparkLayout(value.layout);
		// COMPATIBILITY: v1 stores the full editor sidecar. Retire only with v1 document support.
		const e = value.version === 2 ? expandCreatorEditor(source, value.emulayout) : value.emulayout;
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
			sparkEditorBaseline: validateSparkLayout(creatorSparkProjection(content, value.version === 1))
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
		emulayout: stable(expandCreatorEditor(document.layout, document.emulayout), true)
	});
}
