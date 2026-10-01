import {
	buildKeyboardInputConfig,
	type InputKeyboardType,
	type KeyboardInputKey
} from '$lib/keyboardInputConfig';
import {
	createCreatorAdaptiveRule,
	createCreatorMagicRule,
	createCreatorMagicSection,
	createEmptyCreatorAdaptiveDraft,
	createEmptyCreatorMagicDraft,
	type CreatorMagicSection
} from '$lib/layoutCreatorMappings';
import { createDefaultCreatorUrlSnapshot, type CreatorUrlSnapshot } from '$lib/layoutCreatorUrl';

export const AKL_TRY_HASH_PREFIX = '#akl=';
// The current keyboard supports the three letter rows and two thumb rows,
// with the widest main row matching the 13-key ANSI punctuation row.
const MAX_IMPORT_COLUMN = 12;
const MAX_IMPORT_ROW = 4;
const MAX_ENCODED_PAYLOAD_LENGTH = 64 * 1024;

export type AklTryImportResult = {
	snapshot: CreatorUrlSnapshot | null;
	notice: string | null;
	source: string | null;
};

const INVALID_AKL_TRY_RESULT: AklTryImportResult = {
	snapshot: null,
	notice: "Couldn't read this akl.gg link.",
	source: null
};

type SparkKey = {
	char?: string;
	row: number;
	col: number;
	finger: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSingleCharacter(value: unknown): value is string {
	return typeof value === 'string' && Array.from(value).length === 1 && value !== ' ';
}

function decodeBase64UrlUtf8(value: string): string | null {
	if (!value || !/^[A-Za-z0-9_-]+$/.test(value) || value.length % 4 === 1) return null;
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
	try {
		const binary = atob(padded);
		const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

function parseSource(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
	} catch {
		return null;
	}
}

function magicValue(value: unknown, previous: string): string | null {
	if (!isRecord(value)) return null;
	if (value.kind === 'repeat') return previous;
	if (value.kind === 'char' && typeof value.char === 'string' && value.char) return value.char;
	return null;
}

function sectionFor(
	sections: Map<string, CreatorMagicSection>,
	trigger: string,
	preserveBaseOutput = false
): CreatorMagicSection {
	let section = sections.get(trigger);
	if (!section) {
		section = createCreatorMagicSection(trigger);
		section.rules = [];
		if (preserveBaseOutput) {
			section.fallbackKind = 'emit';
			section.fallbackEmit = trigger;
		}
		sections.set(trigger, section);
	}
	return section;
}

function addMagicRule(
	sections: Map<string, CreatorMagicSection>,
	trigger: string,
	after: string,
	emit: string,
	warnings: Set<string>
) {
	if (!trigger || !after || !emit) {
		warnings.add('some Magic rules');
		return;
	}
	if (/\s/u.test(after)) {
		warnings.add('word-start or whitespace-context rules');
		return;
	}
	const section = sectionFor(sections, trigger);
	if (section.rules.some((rule) => rule.after === after)) {
		warnings.add('overlapping Magic rules');
		return;
	}
	const rule = createCreatorMagicRule();
	rule.after = after;
	rule.emit = emit;
	section.rules.push(rule);
}

function parseSparkKeys(
	value: unknown,
	warnings: Set<string>
): {
	keys: KeyboardInputKey[];
	sparkKeys: SparkKey[];
} {
	if (!Array.isArray(value)) return { keys: [], sparkKeys: [] };
	const keys: KeyboardInputKey[] = [];
	const sparkKeys: SparkKey[] = [];
	const slots = new Set<string>();
	for (const raw of value) {
		if (
			!isRecord(raw) ||
			!Number.isInteger(raw.row) ||
			!Number.isInteger(raw.col) ||
			typeof raw.finger !== 'string'
		) {
			warnings.add('malformed keys');
			continue;
		}
		const row = raw.row as number;
		const col = raw.col as number;
		if (row < 0) {
			warnings.add('the number row');
			continue;
		}
		if (col < 0 || (raw.char !== undefined && !isSingleCharacter(raw.char))) {
			warnings.add('malformed keys');
			continue;
		}
		if (row > MAX_IMPORT_ROW || col > MAX_IMPORT_COLUMN) {
			warnings.add('keys outside supported keyboard bounds');
			continue;
		}
		const slot = `${row},${col}`;
		if (slots.has(slot)) {
			warnings.add('duplicate key positions');
			continue;
		}
		slots.add(slot);
		const char = typeof raw.char === 'string' ? raw.char : undefined;
		const finger = raw.finger;
		const standardFinger =
			col === 0
				? 'LP'
				: col === 1
					? 'LR'
					: col === 2
						? 'LM'
						: col <= 4
							? 'LI'
							: col <= 6
								? 'RI'
								: col === 7
									? 'RM'
									: col === 8
										? 'RR'
										: 'RP';
		if (row < 3 && finger !== standardFinger) warnings.add('custom finger assignments');
		sparkKeys.push({ ...(char ? { char } : {}), row, col, finger });
		keys.push({
			slot,
			value: char ?? '',
			...(!char ? { inert: true } : {}),
			...(row >= 3 && (finger === 'LT' || finger === 'RT')
				? { thumbHand: finger === 'LT' ? ('l' as const) : ('r' as const) }
				: {})
		});
	}
	// Geometry is sorted for display; carry primary identity separately from that order.
	const counts = new Map<string, number>();
	for (const key of keys) if (key.value) counts.set(key.value, (counts.get(key.value) ?? 0) + 1);
	const seen = new Set<string>();
	for (const key of keys) {
		if ((counts.get(key.value) ?? 0) > 1 && !seen.has(key.value)) key.primary = true;
		seen.add(key.value);
	}
	return { keys, sparkKeys };
}

function importMagic(
	value: unknown,
	sparkKeys: readonly SparkKey[],
	warnings: Set<string>
): Pick<
	CreatorUrlSnapshot,
	'includeMagicKey' | 'includeAdaptiveKey' | 'magicDraft' | 'adaptiveDraft'
> {
	const sections = new Map<string, CreatorMagicSection>();
	const adaptiveDraft = createEmptyCreatorAdaptiveDraft();
	adaptiveDraft.rules = [];
	if (!isRecord(value)) {
		return {
			includeMagicKey: false,
			includeAdaptiveKey: false,
			magicDraft: createEmptyCreatorMagicDraft(),
			adaptiveDraft: createEmptyCreatorAdaptiveDraft()
		};
	}

	for (const raw of Array.isArray(value.magic_keys) ? value.magic_keys : []) {
		if (!isRecord(raw) || !isSingleCharacter(raw.key)) {
			warnings.add('some Magic keys');
			continue;
		}
		const section = sectionFor(sections, raw.key);
		if (isRecord(raw.default) && raw.default.kind === 'repeat') {
			section.fallbackKind = 'repeat-last';
		} else if (
			isRecord(raw.default) &&
			raw.default.kind === 'char' &&
			typeof raw.default.char === 'string' &&
			raw.default.char
		) {
			section.fallbackKind = 'emit';
			section.fallbackEmit = raw.default.char;
		}
		for (const rule of Array.isArray(raw.rules) ? raw.rules : []) {
			if (!isRecord(rule) || typeof rule.after !== 'string' || typeof rule.emit !== 'string') {
				warnings.add('some Magic rules');
				continue;
			}
			addMagicRule(sections, raw.key, rule.after, rule.emit, warnings);
		}
		for (const except of Array.isArray(raw.except) ? raw.except : []) {
			if (typeof except === 'string' && except) {
				addMagicRule(sections, raw.key, except, raw.key, warnings);
			} else warnings.add('some Magic exceptions');
		}
	}

	const primaryKeys = new Map<string, SparkKey>();
	for (const key of sparkKeys)
		if (key.char && !primaryKeys.has(key.char)) primaryKeys.set(key.char, key);
	for (const raw of Array.isArray(value.chiral_keys) ? value.chiral_keys : []) {
		if (!isRecord(raw) || !isSingleCharacter(raw.key)) {
			warnings.add('some chiral keys');
			continue;
		}
		const triggerKey = primaryKeys.get(raw.key);
		const triggerHand = triggerKey?.finger[0];
		if (triggerHand !== 'L' && triggerHand !== 'R') {
			warnings.add('a chiral key without a known hand');
			continue;
		}
		const exceptions = new Set(
			(Array.isArray(raw.except) ? raw.except : []).filter(
				(entry): entry is string => typeof entry === 'string'
			)
		);
		sectionFor(sections, raw.key, true);
		for (const [after, key] of primaryKeys) {
			const afterHand = key.finger[0];
			if (afterHand !== 'L' && afterHand !== 'R') continue;
			const output: string = exceptions.has(after)
				? raw.key
				: (magicValue(afterHand === triggerHand ? raw.same : raw.opposite, after) ?? raw.key);
			addMagicRule(sections, raw.key, after, output, warnings);
		}
	}

	for (const raw of Array.isArray(value.rules) ? value.rules : []) {
		if (!isRecord(raw) || typeof raw.inputs !== 'string' || typeof raw.output !== 'string') {
			warnings.add('some raw rules');
			continue;
		}
		const inputs = Array.from(raw.inputs);
		const trigger = inputs.pop() ?? '';
		const after = inputs.join('');
		if (!after || !raw.output.startsWith(after) || raw.output.length === after.length) {
			warnings.add('raw rules that rewrite or delete earlier text');
			continue;
		}
		sectionFor(sections, trigger, true);
		addMagicRule(sections, trigger, after, raw.output.slice(after.length), warnings);
	}

	for (const raw of Array.isArray(value.adaptive_swaps) ? value.adaptive_swaps : []) {
		if (
			!isRecord(raw) ||
			!isSingleCharacter(raw.trigger) ||
			!Array.isArray(raw.swap) ||
			raw.swap.length !== 2 ||
			!isSingleCharacter(raw.swap[0]) ||
			!isSingleCharacter(raw.swap[1])
		) {
			warnings.add('some Adaptive swaps');
			continue;
		}
		const rule = createCreatorAdaptiveRule();
		rule.trigger = raw.trigger;
		rule.left = raw.swap[0];
		rule.right = raw.swap[1];
		adaptiveDraft.rules.push(rule);
	}

	return {
		includeMagicKey: sections.size > 0,
		includeAdaptiveKey: adaptiveDraft.rules.length > 0,
		magicDraft:
			sections.size > 0 ? { sections: [...sections.values()] } : createEmptyCreatorMagicDraft(),
		adaptiveDraft:
			adaptiveDraft.rules.length > 0 ? adaptiveDraft : createEmptyCreatorAdaptiveDraft()
	};
}

export function importAklTryPayload(value: unknown): AklTryImportResult {
	if (
		!isRecord(value) ||
		value.v !== 1 ||
		value.format !== 'spark/1' ||
		typeof value.name !== 'string' ||
		(value.board !== 'staggered' && value.board !== 'ortho') ||
		!isRecord(value.layout)
	) {
		return INVALID_AKL_TRY_RESULT;
	}
	const warnings = new Set<string>();
	const { keys, sparkKeys } = parseSparkKeys(value.layout.keys, warnings);
	if (!keys.some((key) => key.value)) {
		return {
			snapshot: null,
			notice: "Couldn't read this akl.gg link.",
			source: parseSource(value.source)
		};
	}
	const keyboardType = value.board as InputKeyboardType;
	const magic = importMagic(value.layout.magic, sparkKeys, warnings);
	const snapshot: CreatorUrlSnapshot = {
		...createDefaultCreatorUrlSnapshot(),
		name: value.name.trim() || 'New layout',
		author: typeof value.author === 'string' ? value.author.trim() : '',
		preview: true,
		...magic,
		keyConfig: buildKeyboardInputConfig({
			baseLayoutName: null,
			baseLayoutModified: true,
			keyboardType,
			keys
		})
	};
	const omitted = [...warnings];
	return {
		snapshot,
		notice:
			omitted.length > 0
				? `Imported from akl.gg without ${omitted.join(', ')}.`
				: 'Imported from akl.gg. Save the layout to keep it in this browser.',
		source: parseSource(value.source)
	};
}

export function readAklTryHash(hash: string): AklTryImportResult {
	if (!hash.startsWith(AKL_TRY_HASH_PREFIX)) {
		return { snapshot: null, notice: null, source: null };
	}
	const encoded = hash.slice(AKL_TRY_HASH_PREFIX.length);
	if (encoded.length > MAX_ENCODED_PAYLOAD_LENGTH) return INVALID_AKL_TRY_RESULT;
	const decoded = decodeBase64UrlUtf8(encoded);
	if (decoded === null) return INVALID_AKL_TRY_RESULT;
	try {
		return importAklTryPayload(JSON.parse(decoded));
	} catch {
		return INVALID_AKL_TRY_RESULT;
	}
}
