import { creatorSparkProjection } from '$lib/creatorDocumentEdits';
import { buildKeyboardInputConfig, type InputKeyboardType } from '$lib/keyboardInputConfig';
import { magicDraftFromSource, adaptiveDraftFromSource } from '$lib/layoutCreatorMappings';
import { compileSparkLayout } from '$lib/sparkCompiler';
import { createDefaultCreatorSnapshot, type CreatorSnapshot } from '$lib/creatorContent';
import { chiralDraftFromSource } from '$lib/creatorChiralMappings';

export const AKL_TRY_HASH_PREFIX = '#akl=';
const MAX_ENCODED_PAYLOAD_LENGTH = 64 * 1024;

export type AklTryImportResult = {
	snapshot: CreatorSnapshot | null;
	notice: string | null;
	source: string | null;
};

const INVALID_AKL_TRY_RESULT: AklTryImportResult = {
	snapshot: null,
	notice: "Couldn't read this akl.gg link.",
	source: null
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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
	let compiled: ReturnType<typeof compileSparkLayout>;
	try {
		compiled = compileSparkLayout(value.layout);
	} catch {
		return INVALID_AKL_TRY_RESULT;
	}
	const { keys, source: behaviors, warnings } = compiled;
	if (!keys.some((key) => key.value)) {
		return {
			snapshot: null,
			notice: "Couldn't read this akl.gg link.",
			source: parseSource(value.source)
		};
	}
	const keyboardType = value.board as InputKeyboardType;

	const snapshot: CreatorSnapshot = {
		sparkSource: compiled.document,
		...createDefaultCreatorSnapshot(),
		name: value.name.trim() || 'New layout',
		author: typeof value.author === 'string' ? value.author.trim() : '',
		preview: true,
		includeMagicKey: Boolean(behaviors.magicKeys),
		includeAdaptiveKey: Boolean(behaviors.adaptiveSwaps),
		includeChiralKey: Boolean(behaviors.chiralKeys),
		magicDraft: magicDraftFromSource(behaviors.magicKeys),
		adaptiveDraft: adaptiveDraftFromSource(behaviors.adaptiveSwaps),
		chiralDraft: chiralDraftFromSource(behaviors.chiralKeys),
		keyConfig: buildKeyboardInputConfig({
			baseLayoutName: null,
			baseLayoutModified: true,
			keyboardType,
			keys
		})
	};
	snapshot.sparkEditorBaseline = creatorSparkProjection(snapshot);
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

/** Plain JSON import; link transport decoding remains exclusive to readAklTryHash. */
export function readSparkImportText(
	text: string,
	defaults: { name: string; author: string; board: InputKeyboardType }
): AklTryImportResult {
	const invalid = (notice: string): AklTryImportResult => ({
		snapshot: null,
		notice,
		source: null
	});
	if (
		text.length > MAX_ENCODED_PAYLOAD_LENGTH ||
		new TextEncoder().encode(text).length > MAX_ENCODED_PAYLOAD_LENGTH
	)
		return invalid('Spark JSON must be 64 KiB or smaller.');
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return invalid('Paste valid JSON for a Spark schema/1 layout.');
	}
	if (!isRecord(value)) return invalid('Expected a Spark layout object.');
	// A wrapper must pass the existing version/format checks; never silently unwrap unknown versions.
	const wrapped = 'layout' in value || 'v' in value || 'format' in value;
	if (!wrapped && 'schema' in value && value.schema !== 1)
		return invalid('Only Spark schema version 1 is supported.');
	const result = importAklTryPayload(
		wrapped ? value : { v: 1, format: 'spark/1', ...defaults, layout: value }
	);
	if (!result.snapshot)
		return invalid('Could not read this Spark schema/1 layout. Check the version and keys.');
	return {
		...result,
		notice: result.notice?.startsWith('Imported from akl.gg without ')
			? result.notice.replace('Imported from akl.gg without ', 'Will import without ')
			: 'Ready to import keys and mappings.'
	};
}
