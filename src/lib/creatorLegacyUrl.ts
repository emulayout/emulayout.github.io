/**
 * Read-only compatibility for pre-document creator queries (keys/mappings v1).
 * Also used by share=1 and saved-layout/backup versions 1/2 through the URL reader.
 * Candidate for removal only after explicitly retiring those formats; keep fixed legacy fixtures.
 * This module only reads old formats; current writes use creator documents.
 */
import { createDefaultCreatorSnapshot, type CreatorContentSnapshot } from '$lib/creatorContent';
import { decodeBase64Url } from '$lib/creatorUrlEncoding';
import {
	buildKeyboardInputConfig,
	type InputKeyboardType,
	type KeyboardInputConfig,
	type KeyboardInputKey
} from '$lib/keyboardInputConfig';
import {
	createEmptyCreatorChiralDraft,
	createCreatorChiralRule,
	type ChiralOutputKind
} from '$lib/creatorChiralMappings';
import {
	createCreatorAdaptiveRule,
	createCreatorAdaptiveSection,
	createCreatorMagicRule,
	createCreatorMagicSection,
	createEmptyCreatorAdaptiveDraft,
	createEmptyCreatorMagicDraft,
	type CreatorAdaptiveDraft,
	type CreatorAdaptiveRule,
	type CreatorAdaptiveSection,
	type CreatorMagicDraft,
	type CreatorMagicSection
} from '$lib/layoutCreatorMappings';
import { typingPracticeLessonFromSearchParams } from '$lib/typingPracticeText';

const CREATOR_NAME_PARAM = 'name';
const CREATOR_AUTHOR_PARAM = 'author';
const CREATOR_BASE_PARAM = 'base';
const CREATOR_TYPE_PARAM = 'type';
const CREATOR_KEYS_PARAM = 'keys';
const CREATOR_MAGIC_PARAM = 'magic';
const CREATOR_ADAPTIVE_PARAM = 'adaptive';
const CREATOR_DISABLED_PARAM = 'off';

const KEYS_VERSION = 'v1';
const MAPPING_VERSION = 'v1';
const ENABLED_FLAG = '1';
const KEYS_MODIFIED_FLAG = 'm';
const KEYS_UNMODIFIED_FLAG = '-';
const DEFAULT_BASE_LAYOUT_NAME = 'QWERTY';

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function decodeJsonParam(value: string): unknown {
	if (!value.startsWith(`${MAPPING_VERSION}:`)) return null;
	const decoded = decodeBase64Url(value.slice(MAPPING_VERSION.length + 1));
	if (decoded === null) return null;
	try {
		return JSON.parse(decoded);
	} catch {
		return null;
	}
}

function parseKeyEntry(entry: string): KeyboardInputKey | null {
	const slotEnd = entry.indexOf(':');
	if (slotEnd <= 0) return null;
	const flagsEnd = entry.indexOf(':', slotEnd + 1);
	if (flagsEnd < 0) return null;
	const slot = entry.slice(0, slotEnd);
	if (!/^\d+,\d+$/.test(slot)) return null;
	const flags = entry.slice(slotEnd + 1, flagsEnd);
	let value: string;
	try {
		value = decodeURIComponent(entry.slice(flagsEnd + 1));
	} catch {
		return null;
	}
	const inert = flags.includes('i');
	const thumbHand = flags.includes('l') ? 'l' : flags.includes('r') ? 'r' : undefined;
	return {
		slot,
		value,
		...(flags.includes('p') ? { primary: true } : {}),
		...(flags.includes('L')
			? { hand: 'l' as const }
			: flags.includes('R')
				? { hand: 'r' as const }
				: {}),
		...(inert ? { inert: true } : {}),
		...(thumbHand ? { thumbHand } : {})
	};
}

function parseKeysParam(value: string): { modified: boolean; keys: KeyboardInputKey[] } | null {
	if (!value.startsWith(`${KEYS_VERSION}:`)) return null;
	const body = value.slice(KEYS_VERSION.length + 1);
	const separator = body.indexOf(';');
	const flag = separator < 0 ? body : body.slice(0, separator);
	if (flag !== KEYS_MODIFIED_FLAG && flag !== KEYS_UNMODIFIED_FLAG) return null;
	const entries =
		separator < 0
			? []
			: body
					.slice(separator + 1)
					.split(';')
					.filter(Boolean);
	const keys: KeyboardInputKey[] = [];
	const slots = new Set<string>();
	for (const entry of entries) {
		const key = parseKeyEntry(entry);
		if (!key || slots.has(key.slot)) return null;
		slots.add(key.slot);
		keys.push(key);
	}
	return { modified: flag === KEYS_MODIFIED_FLAG, keys };
}

function parseStringPairs(value: unknown): [string, string][] | null {
	if (!Array.isArray(value)) return null;
	const pairs: [string, string][] = [];
	for (const entry of value) {
		if (!Array.isArray(entry) || entry.length !== 2) return null;
		if (typeof entry[0] !== 'string' || typeof entry[1] !== 'string') return null;
		pairs.push([entry[0], entry[1]]);
	}
	return pairs;
}

function parseStringTriples(value: unknown): [string, string, string][] | null {
	if (!Array.isArray(value)) return null;
	const triples: [string, string, string][] = [];
	for (const entry of value) {
		if (!Array.isArray(entry) || entry.length !== 3) return null;
		if (
			typeof entry[0] !== 'string' ||
			typeof entry[1] !== 'string' ||
			typeof entry[2] !== 'string'
		) {
			return null;
		}
		triples.push([entry[0], entry[1], entry[2]]);
	}
	return triples;
}

function magicDraftFromPayload(value: unknown): CreatorMagicDraft | null {
	if (!isRecord(value) || !Array.isArray(value.s)) return null;
	const sections: CreatorMagicSection[] = [];
	for (const raw of value.s) {
		if (!isRecord(raw) || typeof raw.t !== 'string') return null;
		const rules = parseStringPairs(raw.r);
		if (!rules) return null;
		const fallbackKind =
			raw.f === 'repeat-last' || raw.f === 'emit' || raw.f === 'no-op' ? raw.f : 'no-op';
		const fallbackEmit = typeof raw.e === 'string' ? raw.e : '';
		const section = createCreatorMagicSection(raw.t);
		section.fallbackKind = fallbackKind;
		section.fallbackEmit = fallbackKind === 'emit' ? fallbackEmit : '';
		section.rules =
			rules.length > 0
				? rules.map(([after, emit]) => {
						const rule = createCreatorMagicRule();
						rule.after = after;
						rule.emit = emit;
						return rule;
					})
				: [createCreatorMagicRule()];
		sections.push(section);
	}
	return { sections: sections.length > 0 ? sections : [createCreatorMagicSection()] };
}

function adaptiveRulesFromPayload(value: unknown): CreatorAdaptiveRule[] | null {
	const triples = parseStringTriples(value);
	if (!triples) return null;
	if (triples.length === 0) return [];
	return triples.map(([trigger, left, right]) => {
		const rule = createCreatorAdaptiveRule();
		rule.trigger = trigger;
		rule.left = left;
		rule.right = right;
		return rule;
	});
}

function adaptiveDraftFromPayload(value: unknown): CreatorAdaptiveDraft | null {
	if (!isRecord(value)) return null;
	const rules = value.r === undefined ? [] : adaptiveRulesFromPayload(value.r);
	if (!rules) return null;
	const groups: CreatorAdaptiveSection[] = [];
	const groupIds = new Set<string>();
	if (value.g !== undefined) {
		if (!Array.isArray(value.g)) return null;
		for (const raw of value.g) {
			if (!isRecord(raw) || typeof raw.l !== 'string') return null;
			const groupRules = adaptiveRulesFromPayload(raw.r);
			if (!groupRules) return null;
			const group = createCreatorAdaptiveSection(raw.l);
			if (typeof raw.i === 'string' && raw.i.trim()) {
				if (groupIds.has(raw.i)) return null;
				group.id = raw.i;
			}
			groupIds.add(group.id);
			group.rules = groupRules.length > 0 ? groupRules : [createCreatorAdaptiveRule()];
			groups.push(group);
		}
	}
	if (rules.length === 0 && groups.length === 0) return createEmptyCreatorAdaptiveDraft();
	return {
		rules: rules.length > 0 ? rules : groups.length > 0 ? [] : [createCreatorAdaptiveRule()],
		groups
	};
}

function normalizeDisabledMappingIds(ids: readonly string[]): string[] {
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

function readDisabledMappingIds(searchParams: URLSearchParams): string[] {
	const raw = searchParams.get(CREATOR_DISABLED_PARAM);
	if (!raw) return [];
	const decoded = decodeJsonParam(raw);
	if (!Array.isArray(decoded)) return [];
	return normalizeDisabledMappingIds(decoded.filter((id): id is string => typeof id === 'string'));
}

export function readLegacyCreatorContent(
	searchParams: URLSearchParams,
	options: { defaultKeyConfig?: KeyboardInputConfig } = {}
): CreatorContentSnapshot {
	const defaults = {
		...createDefaultCreatorSnapshot(),
		...(options.defaultKeyConfig ? { keyConfig: options.defaultKeyConfig } : {})
	};
	const name = searchParams.get(CREATOR_NAME_PARAM)?.trim() || defaults.name;
	const author = searchParams.get(CREATOR_AUTHOR_PARAM)?.trim() || defaults.author;

	const typeParam = searchParams.get(CREATOR_TYPE_PARAM);
	const keyboardType: InputKeyboardType =
		typeParam === 'ortho' || typeParam === 'staggered'
			? typeParam
			: defaults.keyConfig.keyboardType;
	const baseParam = searchParams.get(CREATOR_BASE_PARAM)?.trim() ?? '';
	const parsedKeys = searchParams.has(CREATOR_KEYS_PARAM)
		? parseKeysParam(searchParams.get(CREATOR_KEYS_PARAM) ?? '')
		: null;
	const keyConfig = buildKeyboardInputConfig({
		baseLayoutName: baseParam
			? baseParam
			: parsedKeys?.modified
				? DEFAULT_BASE_LAYOUT_NAME
				: parsedKeys
					? null
					: defaults.keyConfig.baseLayoutName,
		baseLayoutModified: parsedKeys?.modified ?? false,
		keyboardType,
		keys: parsedKeys?.keys ?? defaults.keyConfig.keys
	});

	const magicParam = searchParams.get(CREATOR_MAGIC_PARAM);
	let includeMagicKey = false;
	let magicDraft = createEmptyCreatorMagicDraft();
	if (magicParam === ENABLED_FLAG) {
		includeMagicKey = true;
	} else if (magicParam) {
		const draft = magicDraftFromPayload(decodeJsonParam(magicParam));
		if (draft) {
			includeMagicKey = true;
			magicDraft = draft;
		}
	}
	const adaptiveParam = searchParams.get(CREATOR_ADAPTIVE_PARAM);
	let includeAdaptiveKey = false;
	let adaptiveDraft = createEmptyCreatorAdaptiveDraft();
	if (adaptiveParam === ENABLED_FLAG) {
		includeAdaptiveKey = true;
	} else if (adaptiveParam) {
		const draft = adaptiveDraftFromPayload(decodeJsonParam(adaptiveParam));
		if (draft) {
			includeAdaptiveKey = true;
			adaptiveDraft = draft;
		}
	}

	let chiralDraft = createEmptyCreatorChiralDraft();
	let includeChiralKey = false;
	const chirals = decodeJsonParam(searchParams.get('chiral') ?? '');
	if (
		Array.isArray(chirals) &&
		chirals.every(
			(rule) =>
				isRecord(rule) &&
				['key', 'sameChar', 'oppositeChar', 'except'].every(
					(field) => typeof rule[field] === 'string'
				) &&
				['sameKind', 'oppositeKind'].every((field) =>
					['key', 'repeat', 'char'].includes(String(rule[field]))
				)
		)
	) {
		chiralDraft = {
			rules: chirals.map((rule) => ({
				...createCreatorChiralRule(),
				key: rule.key as string,
				sameKind: rule.sameKind as ChiralOutputKind,
				sameChar: rule.sameChar as string,
				oppositeKind: rule.oppositeKind as ChiralOutputKind,
				oppositeChar: rule.oppositeChar as string,
				except: rule.except as string
			}))
		};
		includeChiralKey = true;
	}
	return {
		name,
		author,
		chiralDraft,
		includeChiralKey,
		includeMagicKey,
		includeAdaptiveKey,
		magicDraft,
		adaptiveDraft,
		keyConfig,
		practiceLesson: typingPracticeLessonFromSearchParams(searchParams),
		disabledMappingIds: readDisabledMappingIds(searchParams)
	};
}
