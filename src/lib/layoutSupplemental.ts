import { validateAdaptiveSwapSource, type AdaptiveSwapSource } from '$lib/adaptiveSwaps';
import { validateMagicKeyMappings, type MagicKeyMappings } from '$lib/magicKeys';

/** Version of the generated supplemental payload consumed by the client. */
export const LAYOUT_SUPPLEMENTAL_SCHEMA = 1;

/** Variant id given to a file that declares one mapping set without `variants`. */
export const IMPLICIT_VARIANT_ID = 'default';

/**
 * Both features share the `{ mappings, groups? }` shape. Magic-key groups are
 * reserved rather than supported, so the wrapper currently holds only mappings.
 */
export interface MagicKeySource {
	mappings: MagicKeyMappings;
}

/**
 * Open container for facts about a layout that are not input behavior, such as
 * `homepage`, `repo`, `discussion`, or `notes`. Unrecognized keys are preserved
 * and published so new metadata does not need a schema change.
 */
export type LayoutSupplementalMeta = Readonly<Record<string, string>>;

export interface LayoutSupplementalVariant {
	id: string;
	label?: string;
	description?: string;
	/** Source-declared: still valid, but no longer the preferred variant. */
	outdated?: boolean;
	/** Derived during sync: references a key the layout no longer has. */
	stale?: boolean;
	magicKeys?: MagicKeySource;
	adaptiveSwaps?: AdaptiveSwapSource;
}

/**
 * Normalized form. Source shorthand is expanded into a single variant, and
 * `schema` is carried through so the published payload validates on the way
 * back in.
 */
export interface LayoutSupplemental {
	schema: typeof LAYOUT_SUPPLEMENTAL_SCHEMA;
	meta?: LayoutSupplementalMeta;
	variants: readonly LayoutSupplementalVariant[];
}

export type LayoutSupplementalByLayout = Readonly<Record<string, LayoutSupplemental>>;

export interface ValidateLayoutSupplementalOptions {
	/**
	 * Accept fields that may appear only in generated payloads.
	 */
	derived?: boolean;
}

const TOP_LEVEL_KEYS = ['schema', 'meta', 'magicKeys', 'adaptiveSwaps', 'variants'];
const VARIANT_KEYS = ['id', 'label', 'description', 'outdated', 'magicKeys', 'adaptiveSwaps'];

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownKeys(
	value: Record<string, unknown>,
	allowed: readonly string[],
	location: string
): void {
	for (const key of Object.keys(value)) {
		if (!allowed.includes(key)) {
			throw new Error(`${location} has unknown field ${JSON.stringify(key)}`);
		}
	}
}

function validateMeta(value: unknown): LayoutSupplementalMeta {
	if (!isRecord(value)) {
		throw new Error('Supplemental meta must be an object');
	}
	const meta: Record<string, string> = Object.create(null);
	for (const [key, entry] of Object.entries(value)) {
		if (!key.trim()) throw new Error('Supplemental meta keys cannot be empty');
		if (typeof entry !== 'string' || !entry.trim()) {
			throw new Error(`Supplemental meta ${JSON.stringify(key)} must be a nonempty string`);
		}
		meta[key] = entry;
	}
	if (Object.keys(meta).length === 0) {
		throw new Error('Supplemental meta must contain at least one entry');
	}
	return meta;
}

function validateMagicKeySource(value: unknown, location: string): MagicKeySource {
	if (!isRecord(value)) {
		throw new Error(`${location} magicKeys must be an object`);
	}
	if ('groups' in value) {
		throw new Error(`${location} magicKeys groups are reserved and not supported yet`);
	}
	rejectUnknownKeys(value, ['mappings'], `${location} magicKeys`);
	if (value.mappings === undefined) {
		throw new Error(`${location} magicKeys must contain mappings`);
	}
	return { mappings: validateMagicKeyMappings(value.mappings) };
}

function validateVariantFeatures(
	value: Record<string, unknown>,
	location: string
): Pick<LayoutSupplementalVariant, 'magicKeys' | 'adaptiveSwaps'> {
	const magicKeys =
		value.magicKeys === undefined ? undefined : validateMagicKeySource(value.magicKeys, location);
	const adaptiveSwaps =
		value.adaptiveSwaps === undefined ? undefined : validateAdaptiveSwapSource(value.adaptiveSwaps);
	if (!magicKeys && !adaptiveSwaps) {
		throw new Error(`${location} must define magicKeys or adaptiveSwaps`);
	}
	return {
		...(magicKeys ? { magicKeys } : {}),
		...(adaptiveSwaps ? { adaptiveSwaps } : {})
	};
}

function validateVariants(
	value: unknown,
	options: ValidateLayoutSupplementalOptions
): LayoutSupplementalVariant[] {
	if (!Array.isArray(value)) {
		throw new Error('Supplemental variants must be an array');
	}
	if (value.length === 0) {
		throw new Error('Supplemental variants must contain at least one variant');
	}

	// A label only exists to tell alternatives apart, so a lone variant may omit
	// it. This also lets the normalized shorthand validate again on the way back
	// in from the published payload.
	const requireLabel = value.length > 1;
	const ids = new Set<string>();
	return value.map((rawVariant, index) => {
		if (!isRecord(rawVariant)) {
			throw new Error(`Supplemental variant ${index + 1} must be an object`);
		}
		if (typeof rawVariant.id !== 'string' || !rawVariant.id.trim()) {
			throw new Error(`Supplemental variant ${index + 1} must have a nonempty id`);
		}
		const location = `Supplemental variant ${JSON.stringify(rawVariant.id)}`;
		rejectUnknownKeys(
			rawVariant,
			options.derived ? [...VARIANT_KEYS, 'stale'] : VARIANT_KEYS,
			location
		);
		if (ids.has(rawVariant.id)) {
			throw new Error(`Supplemental variant id ${JSON.stringify(rawVariant.id)} is duplicated`);
		}
		ids.add(rawVariant.id);

		const label = rawVariant.label;
		if (requireLabel || label !== undefined) {
			if (typeof label !== 'string' || !label.trim()) {
				throw new Error(`${location} must have a nonempty label`);
			}
		}
		const description = rawVariant.description;
		if (description !== undefined && (typeof description !== 'string' || !description.trim())) {
			throw new Error(`${location} description must be a nonempty string`);
		}
		for (const flag of ['outdated', 'stale'] as const) {
			if (rawVariant[flag] !== undefined && typeof rawVariant[flag] !== 'boolean') {
				throw new Error(`${location} ${flag} must be a boolean`);
			}
		}

		return {
			id: rawVariant.id,
			...(typeof label === 'string' ? { label } : {}),
			...(description ? { description } : {}),
			...(rawVariant.outdated ? { outdated: true } : {}),
			...(rawVariant.stale ? { stale: true } : {}),
			...validateVariantFeatures(rawVariant, location)
		};
	});
}

/**
 * Validate generated supplemental data, normalizing the single-mapping-set
 * shorthand used by sync into one variant.
 */
export function validateLayoutSupplemental(
	value: unknown,
	options: ValidateLayoutSupplementalOptions = {}
): LayoutSupplemental {
	if (!isRecord(value)) {
		throw new Error('Supplemental layout data must be an object');
	}
	rejectUnknownKeys(value, TOP_LEVEL_KEYS, 'Supplemental layout data');

	if (value.schema !== LAYOUT_SUPPLEMENTAL_SCHEMA) {
		throw new Error(`Supplemental layout data must set "schema": ${LAYOUT_SUPPLEMENTAL_SCHEMA}`);
	}

	const shorthand = value.magicKeys !== undefined || value.adaptiveSwaps !== undefined;
	if (shorthand && value.variants !== undefined) {
		throw new Error(
			'Supplemental layout data cannot mix top-level mappings with variants; move the mappings into a variant'
		);
	}

	const meta = value.meta === undefined ? undefined : validateMeta(value.meta);

	let variants: LayoutSupplementalVariant[];
	if (shorthand) {
		variants = [
			{
				id: IMPLICIT_VARIANT_ID,
				...validateVariantFeatures(value, 'Supplemental layout data')
			}
		];
	} else if (value.variants !== undefined) {
		variants = validateVariants(value.variants, options);
	} else {
		variants = [];
	}

	if (!meta && variants.length === 0) {
		throw new Error('Supplemental layout data must contain meta, mappings, or variants');
	}

	return {
		schema: LAYOUT_SUPPLEMENTAL_SCHEMA,
		...(meta ? { meta } : {}),
		variants
	};
}

/** The variant the runtime loads by default: the first one the file lists. */
export function defaultVariant(
	supplemental: LayoutSupplemental | undefined
): LayoutSupplementalVariant | undefined {
	return supplemental?.variants[0];
}
