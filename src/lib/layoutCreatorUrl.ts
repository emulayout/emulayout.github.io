import {
	buildCreatorDocument,
	readCreatorDocument,
	creatorDocumentSignature
} from '$lib/creatorDocument';
import type { SparkLayout } from '$lib/sparkSchema';
import {
	buildKeyboardInputConfig,
	createKeyboardInputConfigFromLayout,
	type InputKeyboardType,
	type KeyboardInputConfig,
	type KeyboardInputKey
} from '$lib/keyboardInputConfig';
import type { LayoutData } from '$lib/layout';
import {
	createEmptyCreatorChiralDraft,
	createCreatorChiralRule,
	type ChiralOutputKind,
	type CreatorChiralDraft
} from '$lib/creatorChiralMappings';
import { LAYOUT_CREATOR_NEW_LAYOUT_NAME, createDefaultCreatorKeyConfig } from '$lib/layoutCreator';
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
import {
	DEFAULT_LAYOUT_DETAIL_SECTION,
	LAYOUT_DETAIL_TAB_PARAM,
	parseCreatorDetailSection,
	type LayoutDetailSection
} from '$lib/layoutDetailTabs';
import {
	normalizeTypingPracticeLessonSettings,
	resolveTypingPracticeLessonSettings,
	typingPracticeLessonOverridesFromSearchParams,
	typingPracticeLessonFromSearchParams,
	type TypingPracticeLessonSettings
} from '$lib/typingPracticeText';

export const CREATOR_ID_PARAM = 'id';
export const CREATOR_NAME_PARAM = 'name';
export const CREATOR_AUTHOR_PARAM = 'author';
export const CREATOR_BASE_PARAM = 'base';
export const CREATOR_TYPE_PARAM = 'type';
export const CREATOR_KEYS_PARAM = 'keys';
export const CREATOR_MAGIC_PARAM = 'magic';
export const CREATOR_ADAPTIVE_PARAM = 'adaptive';
export const CREATOR_EDIT_PARAM = 'edit';
export const CREATOR_PREVIEW_PARAM = 'preview';
export const CREATOR_DISABLED_PARAM = 'off';
const CREATOR_PREVIEW_PARAM_LEGACY = 'locked';

const KEYS_VERSION = 'v1';
const MAPPING_VERSION = 'v1';
const ENABLED_FLAG = '1';
const KEYS_MODIFIED_FLAG = 'm';
const KEYS_UNMODIFIED_FLAG = '-';
const DEFAULT_BASE_LAYOUT_NAME = 'QWERTY';

export type CreatorContentSnapshot = {
	sparkSource?: SparkLayout;
	sparkEditorBaseline?: SparkLayout;
	name: string;
	author: string;
	includeMagicKey: boolean;
	includeAdaptiveKey: boolean;
	magicDraft: CreatorMagicDraft;
	adaptiveDraft: CreatorAdaptiveDraft;
	chiralDraft?: CreatorChiralDraft;
	includeChiralKey?: boolean;
	keyConfig: KeyboardInputConfig;
	practiceLesson: TypingPracticeLessonSettings;
	disabledMappingIds: string[];
};

export type CreatorViewState = {
	preview: boolean;
	section: Exclude<LayoutDetailSection, 'stats'>;
};

export type CreatorUrlSnapshot = CreatorContentSnapshot & CreatorViewState;

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function encodeBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeBase64Url(value: string): string | null {
	try {
		const padded = value.replace(/-/g, '+').replace(/_/g, '/');
		const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
		const binary = atob(padded + pad);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
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

function keySignature(key: KeyboardInputKey): string {
	return `${key.slot}\0${key.value}\0${key.inert ? '1' : '0'}\0${key.thumbHand ?? ''}\0${key.primary ? '1' : '0'}\0${key.hand ?? ''}`;
}

function keysEqual(left: readonly KeyboardInputKey[], right: readonly KeyboardInputKey[]): boolean {
	if (left.length !== right.length) return false;
	const signatures = left.map(keySignature).sort();
	return right
		.map(keySignature)
		.sort()
		.every((signature, index) => signature === signatures[index]);
}

/** True when `base` is set but the key grid is still the default QWERTY canvas. */
export function creatorKeyConfigNeedsCatalogBaseSeed(config: KeyboardInputConfig): boolean {
	const defaults = createDefaultCreatorKeyConfig();
	const baseName = config.baseLayoutName?.trim() ?? '';
	if (!baseName || baseName === defaults.baseLayoutName) return false;
	if (config.baseLayoutModified) return false;
	return keysEqual(config.keys, defaults.keys);
}

/** New Edit canvas named New layout, with this catalog layout as the selected base. */
export function createCreatorEditSnapshotFromLayout(
	layout: LayoutData,
	keyboardType: InputKeyboardType = 'staggered'
): CreatorUrlSnapshot {
	return {
		...createDefaultCreatorUrlSnapshot(),
		preview: false,
		includeMagicKey: layout.hasMagicKey,
		includeAdaptiveKey: layout.hasAdaptiveSwap,
		keyConfig: createKeyboardInputConfigFromLayout(layout, keyboardType)
	};
}

export function creatorEditSearchFromLayout(
	layout: LayoutData,
	keyboardType: InputKeyboardType = 'staggered'
): string {
	return `?${writeCreatorUrlParams(createCreatorEditSnapshotFromLayout(layout, keyboardType)).toString()}`;
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

export function normalizeDisabledMappingIds(ids: readonly string[]): string[] {
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

function readDisabledMappingIds(searchParams: URLSearchParams): string[] {
	const raw = searchParams.get(CREATOR_DISABLED_PARAM);
	if (!raw) return [];
	const decoded = decodeJsonParam(raw);
	if (!Array.isArray(decoded)) return [];
	return normalizeDisabledMappingIds(decoded.filter((id): id is string => typeof id === 'string'));
}

function writeCreatorSectionParam(params: URLSearchParams, section: CreatorUrlSnapshot['section']) {
	const resolved = parseCreatorDetailSection(section);
	if (resolved === DEFAULT_LAYOUT_DETAIL_SECTION) return;
	params.set(LAYOUT_DETAIL_TAB_PARAM, resolved);
}

export function createDefaultCreatorUrlSnapshot(): CreatorUrlSnapshot {
	return {
		name: LAYOUT_CREATOR_NEW_LAYOUT_NAME,
		author: '',
		preview: false,
		section: DEFAULT_LAYOUT_DETAIL_SECTION,
		includeMagicKey: false,
		includeAdaptiveKey: false,
		magicDraft: createEmptyCreatorMagicDraft(),
		adaptiveDraft: createEmptyCreatorAdaptiveDraft(),
		chiralDraft: createEmptyCreatorChiralDraft(),
		includeChiralKey: false,
		keyConfig: createDefaultCreatorKeyConfig(),
		practiceLesson: normalizeTypingPracticeLessonSettings(null),
		disabledMappingIds: []
	};
}

export const CREATOR_DOCUMENT_PARAM = 'document';
const MAX_CREATOR_DOCUMENT_LENGTH = 1024 * 1024;

export function writeCreatorUrlParams(snapshot: CreatorUrlSnapshot): URLSearchParams {
	const params = new URLSearchParams();
	if (
		creatorDocumentSignature(snapshot) !==
		creatorDocumentSignature(createDefaultCreatorUrlSnapshot())
	)
		params.set(
			CREATOR_DOCUMENT_PARAM,
			encodeBase64Url(JSON.stringify(buildCreatorDocument(snapshot)))
		);
	writeCreatorSectionParam(params, snapshot.section);
	if (!snapshot.preview) params.set(CREATOR_EDIT_PARAM, ENABLED_FLAG);
	return params;
}

export function readCreatorDocumentFromSearch(
	searchParams: URLSearchParams
): CreatorContentSnapshot | null {
	const encoded = searchParams.get(CREATOR_DOCUMENT_PARAM) ?? '';
	let content: CreatorContentSnapshot | null = null;
	try {
		if (encoded.length <= MAX_CREATOR_DOCUMENT_LENGTH) {
			const text = decodeBase64Url(encoded);
			if (text !== null) content = readCreatorDocument(JSON.parse(text));
		}
	} catch {
		/* Invalid document content never falls back to legacy draft fields. */
	}
	return content;
}

export function readCreatorUrlSnapshot(
	searchParams: URLSearchParams,
	options: { defaultKeyConfig?: KeyboardInputConfig } = {}
): CreatorUrlSnapshot {
	if (!searchParams.has(CREATOR_DOCUMENT_PARAM))
		return readLegacyCreatorUrlSnapshot(searchParams, options);
	const content = readCreatorDocumentFromSearch(searchParams);
	return {
		...(content ?? createDefaultCreatorUrlSnapshot()),
		practiceLesson: resolveTypingPracticeLessonSettings(
			content?.practiceLesson ?? createDefaultCreatorUrlSnapshot().practiceLesson,
			typingPracticeLessonOverridesFromSearchParams(searchParams)
		),
		preview: readCreatorPreviewFlag(searchParams),
		section: parseCreatorDetailSection(searchParams.get(LAYOUT_DETAIL_TAB_PARAM))
	};
}

export function creatorUrlSnapshotSignature(snapshot: CreatorUrlSnapshot): string {
	return `${creatorDocumentSignature(snapshot)}\0${snapshot.preview}\0${snapshot.section}`;
}

export function cloneCreatorUrlSnapshot(snapshot: CreatorUrlSnapshot): CreatorUrlSnapshot {
	const content = readCreatorDocument(buildCreatorDocument(snapshot));
	if (!content) throw new Error('Cannot clone an invalid creator document');
	return {
		...content,
		preview: snapshot.preview,
		section: parseCreatorDetailSection(snapshot.section)
	};
}

export function creatorContentFromSnapshot(snapshot: CreatorUrlSnapshot): CreatorContentSnapshot {
	const { preview, section, ...content } = cloneCreatorUrlSnapshot(snapshot);
	void preview;
	void section;
	return content;
}

export function creatorSnapshotFromContent(
	content: CreatorContentSnapshot,
	view: CreatorViewState = { preview: true, section: DEFAULT_LAYOUT_DETAIL_SECTION }
): CreatorUrlSnapshot {
	return cloneCreatorUrlSnapshot({ ...content, ...view });
}

export function creatorContentSnapshotSignature(content: CreatorContentSnapshot): string {
	return creatorDocumentSignature(content);
}

export function creatorUrlSnapshotsEqual(
	left: CreatorUrlSnapshot,
	right: CreatorUrlSnapshot
): boolean {
	return creatorUrlSnapshotSignature(left) === creatorUrlSnapshotSignature(right);
}

export function creatorUrlContentEqual(
	left: CreatorUrlSnapshot | CreatorContentSnapshot,
	right: CreatorUrlSnapshot | CreatorContentSnapshot
): boolean {
	return creatorContentSnapshotSignature(left) === creatorContentSnapshotSignature(right);
}

export function readCreatorEditFlag(searchParams: URLSearchParams): boolean {
	return searchParams.get(CREATOR_EDIT_PARAM) === ENABLED_FLAG;
}

/** Preview is the default view. `edit=1` is Edit. Legacy `preview=1` / `locked=1` stay Preview. */
export function readCreatorPreviewFlag(searchParams: URLSearchParams): boolean {
	return !readCreatorEditFlag(searchParams);
}

function isCreatorViewParam(key: string): boolean {
	return (
		key === CREATOR_ID_PARAM ||
		key === CREATOR_EDIT_PARAM ||
		key === CREATOR_PREVIEW_PARAM ||
		key === CREATOR_PREVIEW_PARAM_LEGACY ||
		key === LAYOUT_DETAIL_TAB_PARAM
	);
}

export function readCreatorSavedId(searchParams: URLSearchParams): string | null {
	const id = searchParams.get(CREATOR_ID_PARAM)?.trim();
	return id || null;
}

export function creatorUrlHasDraftParams(searchParams: URLSearchParams): boolean {
	for (const key of searchParams.keys()) {
		if (!isCreatorViewParam(key)) return true;
	}
	return false;
}

export type CreatorSearchOptions = {
	savedId?: string | null;
	savedSnapshot?: CreatorContentSnapshot | null;
};

export function creatorSearchFromSnapshot(
	snapshot: CreatorUrlSnapshot,
	options: CreatorSearchOptions = {}
): string {
	const savedId = options.savedId?.trim() || '';
	const omitDraft =
		Boolean(savedId) &&
		Boolean(options.savedSnapshot) &&
		creatorUrlContentEqual(snapshot, options.savedSnapshot as CreatorContentSnapshot);
	const params = omitDraft ? new URLSearchParams() : writeCreatorUrlParams(snapshot);
	if (savedId) params.set(CREATOR_ID_PARAM, savedId);
	if (omitDraft && !snapshot.preview) params.set(CREATOR_EDIT_PARAM, ENABLED_FLAG);
	if (omitDraft) writeCreatorSectionParam(params, snapshot.section);
	const query = params.toString();
	return query ? `?${query}` : '';
}

export function readLegacyCreatorUrlSnapshot(
	searchParams: URLSearchParams,
	options: { defaultKeyConfig?: KeyboardInputConfig } = {}
): CreatorUrlSnapshot {
	const defaults = {
		...createDefaultCreatorUrlSnapshot(),
		...(options.defaultKeyConfig ? { keyConfig: options.defaultKeyConfig } : {})
	};
	const name = searchParams.get(CREATOR_NAME_PARAM)?.trim() || defaults.name;
	const author = searchParams.get(CREATOR_AUTHOR_PARAM)?.trim() || defaults.author;
	const preview = readCreatorPreviewFlag(searchParams);

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
		preview,
		chiralDraft,
		includeChiralKey,
		section: parseCreatorDetailSection(searchParams.get(LAYOUT_DETAIL_TAB_PARAM)),
		includeMagicKey,
		includeAdaptiveKey,
		magicDraft,
		adaptiveDraft,
		keyConfig,
		practiceLesson: typingPracticeLessonFromSearchParams(searchParams),
		disabledMappingIds: readDisabledMappingIds(searchParams)
	};
}
