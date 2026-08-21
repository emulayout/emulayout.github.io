import {
	buildKeyboardInputConfig,
	createKeyboardInputConfigFromLayout,
	type InputKeyboardType,
	type KeyboardInputConfig,
	type KeyboardInputKey
} from '$lib/keyboardInputConfig';
import type { LayoutData } from '$lib/layout';
import { LAYOUT_CREATOR_NEW_LAYOUT_NAME, createDefaultCreatorKeyConfig } from '$lib/layoutCreator';
import {
	createCreatorAdaptiveRule,
	createCreatorAdaptiveSection,
	createCreatorMagicRule,
	createCreatorMagicSection,
	createEmptyCreatorAdaptiveDraft,
	createEmptyCreatorMagicDraft,
	isDefaultCreatorMagicDraft,
	type CreatorAdaptiveDraft,
	type CreatorAdaptiveRule,
	type CreatorAdaptiveSection,
	type CreatorMagicDraft,
	type CreatorMagicFallbackKind,
	type CreatorMagicRule,
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
	typingPracticeLessonFromSearchParams,
	writeTypingPracticeLessonParams,
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
	name: string;
	author: string;
	includeMagicKey: boolean;
	includeAdaptiveKey: boolean;
	magicDraft: CreatorMagicDraft;
	adaptiveDraft: CreatorAdaptiveDraft;
	keyConfig: KeyboardInputConfig;
	practiceLesson: TypingPracticeLessonSettings;
	disabledMappingIds: string[];
};

export type CreatorViewState = {
	preview: boolean;
	section: Exclude<LayoutDetailSection, 'stats'>;
};

export type CreatorUrlSnapshot = CreatorContentSnapshot & CreatorViewState;

type MagicUrlSection = {
	t: string;
	r: [string, string][];
	f?: CreatorMagicFallbackKind;
	e?: string;
};

type AdaptiveUrlGroup = {
	i?: string;
	l: string;
	r: [string, string, string][];
};

type AdaptiveUrlPayload = {
	r?: [string, string, string][];
	g?: AdaptiveUrlGroup[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function encodeBase64Url(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string | null {
	try {
		const padded = value.replace(/-/g, '+').replace(/_/g, '/');
		const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
		const binary = atob(padded + pad);
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder().decode(bytes);
	} catch {
		return null;
	}
}

function encodeJsonParam(value: unknown): string {
	return `${MAPPING_VERSION}:${encodeBase64Url(JSON.stringify(value))}`;
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
	return `${key.slot}\0${key.value}\0${key.inert ? '1' : '0'}\0${key.thumbHand ?? ''}`;
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
export function createCreatorEditSnapshotFromLayout(layout: LayoutData): CreatorUrlSnapshot {
	return {
		...createDefaultCreatorUrlSnapshot(),
		preview: false,
		includeMagicKey: layout.hasMagicKey,
		includeAdaptiveKey: layout.hasAdaptiveSwap,
		keyConfig: createKeyboardInputConfigFromLayout(layout)
	};
}

export function creatorEditSearchFromLayout(layout: LayoutData): string {
	return `?${writeCreatorUrlParams(createCreatorEditSnapshotFromLayout(layout)).toString()}`;
}

function magicRulePayload(rule: CreatorMagicRule): [string, string] {
	return [rule.after, rule.emit];
}

function magicSectionPayload(section: CreatorMagicSection): MagicUrlSection {
	const payload: MagicUrlSection = {
		t: section.trigger,
		r: section.rules.map(magicRulePayload)
	};
	if (section.fallbackKind !== 'no-op') payload.f = section.fallbackKind;
	if (section.fallbackKind === 'emit' && section.fallbackEmit) payload.e = section.fallbackEmit;
	return payload;
}

function adaptiveRulePayload(rule: CreatorAdaptiveRule): [string, string, string] {
	return [rule.trigger, rule.left, rule.right];
}

function isDefaultAdaptiveDraft(draft: CreatorAdaptiveDraft): boolean {
	return (
		draft.groups.length === 0 &&
		draft.rules.length === 1 &&
		draft.rules[0].trigger === '' &&
		draft.rules[0].left === '' &&
		draft.rules[0].right === ''
	);
}

function emptyTopologyKeyIdentity(key: KeyboardInputKey): string {
	return `${key.slot}\0${key.inert ? '1' : '0'}\0${key.thumbHand ?? ''}`;
}

const RECONSTRUCTIBLE_EMPTY_KEY_IDENTITIES = new Set(
	buildKeyboardInputConfig({
		baseLayoutName: null,
		baseLayoutModified: false,
		keyboardType: 'staggered',
		keys: []
	})
		.keys.filter((key) => key.value === '' && !key.inert)
		.map(emptyTopologyKeyIdentity)
);

function shouldEncodeKey(key: KeyboardInputKey): boolean {
	if (key.value !== '' || key.inert) return true;
	return !RECONSTRUCTIBLE_EMPTY_KEY_IDENTITIES.has(emptyTopologyKeyIdentity(key));
}

function encodeKeyEntry(key: KeyboardInputKey): string {
	const flags = `${key.inert ? 'i' : ''}${key.thumbHand ?? ''}`;
	return `${key.slot}:${flags}:${encodeURIComponent(key.value)}`;
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
		...(inert ? { inert: true } : {}),
		...(thumbHand ? { thumbHand } : {})
	};
}

function encodeKeysParam(config: KeyboardInputConfig): string {
	const flag = config.baseLayoutModified ? KEYS_MODIFIED_FLAG : KEYS_UNMODIFIED_FLAG;
	const entries = config.keys.filter(shouldEncodeKey).map(encodeKeyEntry);
	return entries.length > 0
		? `${KEYS_VERSION}:${flag};${entries.join(';')}`
		: `${KEYS_VERSION}:${flag}`;
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

function writeMagicParam(params: URLSearchParams, snapshot: CreatorUrlSnapshot) {
	if (!snapshot.includeMagicKey) return;
	if (isDefaultCreatorMagicDraft(snapshot.magicDraft)) {
		params.set(CREATOR_MAGIC_PARAM, ENABLED_FLAG);
		return;
	}
	params.set(
		CREATOR_MAGIC_PARAM,
		encodeJsonParam({ s: snapshot.magicDraft.sections.map(magicSectionPayload) })
	);
}

export function normalizeDisabledMappingIds(ids: readonly string[]): string[] {
	return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort();
}

function writeDisabledParam(params: URLSearchParams, snapshot: CreatorUrlSnapshot) {
	const ids = normalizeDisabledMappingIds(snapshot.disabledMappingIds ?? []);
	if (ids.length === 0) return;
	params.set(CREATOR_DISABLED_PARAM, encodeJsonParam(ids));
}

function readDisabledMappingIds(searchParams: URLSearchParams): string[] {
	const raw = searchParams.get(CREATOR_DISABLED_PARAM);
	if (!raw) return [];
	const decoded = decodeJsonParam(raw);
	if (!Array.isArray(decoded)) return [];
	return normalizeDisabledMappingIds(decoded.filter((id): id is string => typeof id === 'string'));
}

function writeAdaptiveParam(params: URLSearchParams, snapshot: CreatorUrlSnapshot) {
	if (!snapshot.includeAdaptiveKey) return;
	if (isDefaultAdaptiveDraft(snapshot.adaptiveDraft)) {
		params.set(CREATOR_ADAPTIVE_PARAM, ENABLED_FLAG);
		return;
	}
	const payload: AdaptiveUrlPayload = {};
	if (snapshot.adaptiveDraft.rules.length > 0) {
		payload.r = snapshot.adaptiveDraft.rules.map(adaptiveRulePayload);
	}
	if (snapshot.adaptiveDraft.groups.length > 0) {
		payload.g = snapshot.adaptiveDraft.groups.map((group) => ({
			i: group.id,
			l: group.label,
			r: group.rules.map(adaptiveRulePayload)
		}));
	}
	params.set(CREATOR_ADAPTIVE_PARAM, encodeJsonParam(payload));
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
		keyConfig: createDefaultCreatorKeyConfig(),
		practiceLesson: normalizeTypingPracticeLessonSettings(null),
		disabledMappingIds: []
	};
}

export function writeCreatorUrlParams(snapshot: CreatorUrlSnapshot): URLSearchParams {
	const params = new URLSearchParams();
	const defaults = createDefaultCreatorUrlSnapshot();
	const name = snapshot.name.trim();
	if (name && name !== LAYOUT_CREATOR_NEW_LAYOUT_NAME) {
		params.set(CREATOR_NAME_PARAM, name);
	}
	const author = snapshot.author.trim();
	if (author) params.set(CREATOR_AUTHOR_PARAM, author);

	const baseName = snapshot.keyConfig.baseLayoutName?.trim() ?? '';
	if (baseName && baseName !== defaults.keyConfig.baseLayoutName) {
		params.set(CREATOR_BASE_PARAM, baseName);
	}
	if (snapshot.keyConfig.keyboardType !== defaults.keyConfig.keyboardType) {
		params.set(CREATOR_TYPE_PARAM, snapshot.keyConfig.keyboardType);
	}
	if (
		snapshot.keyConfig.baseLayoutModified ||
		!keysEqual(snapshot.keyConfig.keys, defaults.keyConfig.keys)
	) {
		params.set(CREATOR_KEYS_PARAM, encodeKeysParam(snapshot.keyConfig));
	}

	writeMagicParam(params, snapshot);
	writeAdaptiveParam(params, snapshot);
	writeDisabledParam(params, snapshot);
	writeTypingPracticeLessonParams(params, snapshot.practiceLesson);
	writeCreatorSectionParam(params, snapshot.section);
	if (!snapshot.preview) params.set(CREATOR_EDIT_PARAM, ENABLED_FLAG);
	return params;
}

export function creatorUrlSnapshotSignature(snapshot: CreatorUrlSnapshot): string {
	return writeCreatorUrlParams(snapshot).toString();
}

export function cloneCreatorUrlSnapshot(snapshot: CreatorUrlSnapshot): CreatorUrlSnapshot {
	return readCreatorUrlSnapshot(writeCreatorUrlParams(snapshot));
}

export function creatorContentFromSnapshot(snapshot: CreatorUrlSnapshot): CreatorContentSnapshot {
	const normalized = cloneCreatorUrlSnapshot({
		...snapshot,
		preview: true,
		section: DEFAULT_LAYOUT_DETAIL_SECTION
	});
	return {
		name: normalized.name,
		author: normalized.author,
		includeMagicKey: normalized.includeMagicKey,
		includeAdaptiveKey: normalized.includeAdaptiveKey,
		magicDraft: normalized.magicDraft,
		adaptiveDraft: normalized.adaptiveDraft,
		keyConfig: normalized.keyConfig,
		practiceLesson: normalized.practiceLesson,
		disabledMappingIds: normalized.disabledMappingIds
	};
}

export function creatorSnapshotFromContent(
	content: CreatorContentSnapshot,
	view: CreatorViewState = {
		preview: true,
		section: DEFAULT_LAYOUT_DETAIL_SECTION
	}
): CreatorUrlSnapshot {
	return cloneCreatorUrlSnapshot({ ...content, ...view });
}

export function creatorContentSnapshotSignature(content: CreatorContentSnapshot): string {
	return creatorUrlSnapshotSignature({
		...content,
		preview: true,
		section: DEFAULT_LAYOUT_DETAIL_SECTION
	});
}

export function creatorUrlSnapshotsEqual(
	left: CreatorUrlSnapshot,
	right: CreatorUrlSnapshot
): boolean {
	return creatorUrlSnapshotSignature(left) === creatorUrlSnapshotSignature(right);
}

/** Compare saved-layout content, ignoring Edit/Preview view state. */
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

export function readCreatorUrlSnapshot(
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

	return {
		name,
		author,
		preview,
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
