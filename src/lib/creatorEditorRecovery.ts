import type { SparkLayout } from '$lib/sparkSchema';
import { compileSparkLayout } from '$lib/sparkCompiler';
import {
	magicDraftFromSource,
	adaptiveDraftFromSource,
	type CreatorMagicSection,
	type CreatorMagicRule,
	type CreatorAdaptiveRule
} from '$lib/layoutCreatorMappings';
import { chiralDraftFromSource, type CreatorChiralRule } from '$lib/creatorChiralMappings';
import type { KeyboardInputKey } from '$lib/keyboardInputConfig';
import type { CreatorContentSnapshot } from '$lib/creatorContent';

type Editor = Omit<CreatorContentSnapshot, 'sparkSource' | 'sparkEditorBaseline'>;
type Reference = { id: string; source: number };
type Recovery<T> = T | Reference;
type KeyRecovery =
	| KeyboardInputKey
	| { slot: string; overrides?: Partial<KeyboardInputKey>; omit?: string[] };
type MagicHeader = Omit<CreatorMagicSection, 'id' | 'rules'>;
export type CreatorEditorRecovery = Omit<
	Editor,
	'keyConfig' | 'magicDraft' | 'adaptiveDraft' | 'chiralDraft'
> & {
	keyConfig: Omit<Editor['keyConfig'], 'keys'> & { keys: KeyRecovery[] };
	magicDraft: {
		sections: {
			id: string;
			source?: number;
			draft?: MagicHeader;
			rules: Recovery<CreatorMagicRule>[];
		}[];
	};
	adaptiveDraft: {
		rules: Recovery<CreatorAdaptiveRule>[];
		groups: { id: string; label: string; rules: Recovery<CreatorAdaptiveRule>[] }[];
	};
	chiralDraft?: { rules: Recovery<CreatorChiralRule>[] };
};

function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
function withoutId<T extends { id: string; sparkExtensions?: Record<string, unknown> }>({
	id,
	sparkExtensions,
	...rest
}: T) {
	void id;
	void sparkExtensions;
	return rest;
}
function equal(a: unknown, b: unknown): boolean {
	// Domain records have fixed fields; sort to support independently supplied JSON field order.
	const stable = (value: unknown): unknown =>
		Array.isArray(value)
			? value.map(stable)
			: record(value)
				? Object.fromEntries(
						Object.keys(value)
							.sort()
							.map((key) => [key, stable(value[key])])
					)
				: value;
	return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}
function complete(row: unknown): boolean {
	if (!record(row)) return false;
	if ('after' in row) return Boolean(row.after && row.emit);
	if ('trigger' in row)
		return ['trigger', 'left', 'right'].every(
			(field) =>
				typeof row[field] === 'string' && Array.from(String(row[field]).trim()).length === 1
		);
	return (
		typeof row.key === 'string' &&
		Array.from(row.key).length === 1 &&
		['same', 'opposite'].every(
			(side) =>
				row[`${side}Kind`] !== 'char' ||
				(typeof row[`${side}Char`] === 'string' &&
					Array.from(String(row[`${side}Char`])).length === 1)
		)
	);
}
function compactRows<T extends { id: string; sparkExtensions?: Record<string, unknown> }>(
	rows: T[],
	source: T[]
): Recovery<T>[] {
	return rows.map((row) => {
		if (row.sparkExtensions && !complete(row)) return row;
		const index = source.findIndex((candidate) => equal(withoutId(row), withoutId(candidate)));
		return index < 0 ? row : { id: row.id, source: index };
	});
}
function expandRows(value: unknown, source: { id: string }[]): unknown[] {
	if (!Array.isArray(value)) throw new Error('Missing editor rows');
	return value.map((row) => {
		if (!record(row) || !Object.hasOwn(row, 'source')) return row;
		if (Object.keys(row).some((key) => key !== 'id' && key !== 'source'))
			throw new Error('Invalid editor reference');
		if (!Number.isSafeInteger(row.source) || Number(row.source) < 0 || !source[Number(row.source)])
			throw new Error('Missing editor source');
		return { ...source[Number(row.source)], id: row.id };
	});
}
function header({ id, rules, ...rest }: CreatorMagicSection): MagicHeader {
	void id;
	void rules;
	return rest;
}
function projected(layout: SparkLayout) {
	const compiled = compileSparkLayout(layout);
	return {
		keys: new Map(compiled.keys.map((key) => [key.slot, key])),
		magic: magicDraftFromSource(compiled.source.magicKeys).sections,
		adaptive: adaptiveDraftFromSource(compiled.source.adaptiveSwaps).rules,
		chiral: chiralDraftFromSource(compiled.source.chiralKeys).rules
	};
}

/** Complete supported values live in Spark; only references and editor-only differences are stored. */
export function compactCreatorEditor(layout: SparkLayout, editor: Editor): CreatorEditorRecovery {
	const source = projected(layout);
	return {
		...editor,
		keyConfig: {
			...editor.keyConfig,
			keys: editor.keyConfig.keys.map((key): KeyRecovery => {
				const base = source.keys.get(key.slot);
				if (!base) return key;
				const overrides = Object.fromEntries(
					Object.entries(key).filter(
						([field, value]) => !equal(value, base[field as keyof KeyboardInputKey])
					)
				);
				const omit = Object.keys(base).filter((field) => !Object.hasOwn(key, field));
				return {
					slot: key.slot,
					...(Object.keys(overrides).length ? { overrides } : {}),
					...(omit.length ? { omit } : {})
				};
			})
		},
		magicDraft: {
			sections: editor.magicDraft.sections.map((section) => {
				const index = source.magic.findIndex((candidate) => candidate.trigger === section.trigger);
				const base = source.magic[index];
				const { sparkExtensions, ...plainHeader } = header(section);
				const storedHeader =
					base &&
					equal(plainHeader, header(base)) &&
					(!sparkExtensions || layout.magic?.magic_keys?.some((key) => key.key === section.trigger))
						? undefined
						: header(section);
				return {
					id: section.id,
					...(base ? { source: index } : {}),
					...(storedHeader ? { draft: storedHeader } : {}),
					rules: compactRows(section.rules, base?.rules ?? [])
				};
			})
		},
		adaptiveDraft: {
			rules: compactRows(editor.adaptiveDraft.rules, source.adaptive),
			groups: editor.adaptiveDraft.groups.map((group) => ({
				...group,
				rules: compactRows(group.rules, source.adaptive)
			}))
		},
		...(editor.chiralDraft
			? { chiralDraft: { rules: compactRows(editor.chiralDraft.rules, source.chiral) } }
			: {})
	};
}

/** Expand only domain references; the document reader validates the recovered editor afterwards. */
export function expandCreatorEditor(layout: SparkLayout, value: unknown): unknown {
	if (
		!record(value) ||
		!record(value.keyConfig) ||
		!Array.isArray(value.keyConfig.keys) ||
		!record(value.magicDraft) ||
		!Array.isArray(value.magicDraft.sections) ||
		!record(value.adaptiveDraft) ||
		!Array.isArray(value.adaptiveDraft.groups)
	)
		throw new Error('Missing editor recovery');
	const source = projected(layout);
	return {
		...value,
		keyConfig: {
			...value.keyConfig,
			keys: value.keyConfig.keys.map((key) => {
				if (!record(key) || Object.hasOwn(key, 'value')) return key;
				if (
					Object.keys(key).some((field) => !['slot', 'overrides', 'omit'].includes(field)) ||
					typeof key.slot !== 'string' ||
					!source.keys.has(key.slot)
				)
					throw new Error('Missing key source');
				if (
					key.overrides !== undefined &&
					(!record(key.overrides) || Object.hasOwn(key.overrides, 'slot'))
				)
					throw new Error('Invalid key overrides');
				if (
					key.omit !== undefined &&
					(!Array.isArray(key.omit) ||
						key.omit.some(
							(field) => !['inert', 'primary', 'hand', 'thumbHand'].includes(String(field))
						))
				)
					throw new Error('Invalid key omissions');
				const restored = {
					...source.keys.get(key.slot),
					...((key.overrides as object) ?? {})
				} as Record<string, unknown>;
				for (const field of (key.omit ?? []) as string[]) delete restored[field];
				return restored;
			})
		},
		magicDraft: {
			sections: value.magicDraft.sections.map((section) => {
				if (!record(section)) throw new Error('Missing Magic recovery');
				const index = section.source;
				if (
					index !== undefined &&
					(!Number.isSafeInteger(index) || Number(index) < 0 || !source.magic[Number(index)])
				)
					throw new Error('Missing Magic source');
				const base = index === undefined ? undefined : source.magic[Number(index)];
				if (section.draft !== undefined && !record(section.draft))
					throw new Error('Invalid Magic draft');
				return {
					...(base ? header(base) : {}),
					...((section.draft as object) ?? {}),
					id: section.id,
					rules: expandRows(section.rules, base?.rules ?? [])
				};
			})
		},
		adaptiveDraft: {
			rules: expandRows(value.adaptiveDraft.rules, source.adaptive),
			groups: value.adaptiveDraft.groups.map((group) => {
				if (!record(group)) throw new Error('Missing Adaptive group');
				return { ...group, rules: expandRows(group.rules, source.adaptive) };
			})
		},
		...(value.chiralDraft === undefined
			? {}
			: {
					chiralDraft: {
						rules: expandRows(
							record(value.chiralDraft) ? value.chiralDraft.rules : null,
							source.chiral
						)
					}
				})
	};
}
