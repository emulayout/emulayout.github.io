import { validateSparkLayout, type SparkKey, type SparkMagic } from './sparkSchema';
import type { KeyboardInputKey } from './keyboardInputConfig';
import { validateChiralKeySource, isChiralCharacter, type ChiralKey } from './chiralKeys';
import { compileLayoutInputProfile, type LayoutInputVariantSource } from './layoutInputBehaviors';
import type { ExtendedMagicKeyTriggerSource } from './magicKeys';

const MAX_IMPORT_COLUMN = 12;
const MAX_IMPORT_ROW = 4;
type LoweredMagicSection = {
	trigger: string;
	rules: { after: string; emit: string }[];
	fallbackKind: 'no-op' | 'repeat-last' | 'emit';
	fallbackEmit: string;
};
function isSingleCharacter(value: unknown): value is string {
	return typeof value === 'string' && Array.from(value).length === 1 && !/\s/u.test(value);
}

function sectionFor(
	sections: Map<string, LoweredMagicSection>,
	trigger: string,
	preserveBaseOutput = false
): LoweredMagicSection {
	let section = sections.get(trigger);
	if (!section) {
		section = { trigger, rules: [], fallbackKind: 'no-op', fallbackEmit: '' };
		if (preserveBaseOutput) {
			section.fallbackKind = 'emit';
			section.fallbackEmit = trigger;
		}
		sections.set(trigger, section);
	}
	return section;
}

function addMagicRule(
	sections: Map<string, LoweredMagicSection>,
	trigger: string,
	after: string,
	emit: string,
	warnings: Set<string>
) {
	if (!trigger || !after || !emit) {
		warnings.add('some Magic rules');
		return;
	}
	const section = sectionFor(sections, trigger);
	if (section.rules.some((rule) => rule.after === after)) {
		warnings.add('overlapping Magic rules');
		return;
	}
	section.rules.push({ after, emit });
}

function projectSparkKeys(
	value: readonly SparkKey[],
	warnings: Set<string>
): {
	keys: KeyboardInputKey[];
	sparkKeys: SparkKey[];
} {
	const keys: KeyboardInputKey[] = [];
	const sparkKeys: SparkKey[] = [];
	for (const raw of value) {
		const { row, col } = raw;
		if (row < 0) {
			warnings.add('the number row');
			continue;
		}
		if (raw.char !== undefined && !isChiralCharacter(raw.char)) {
			warnings.add('whitespace keys');
			continue;
		}
		if (row > MAX_IMPORT_ROW || col > MAX_IMPORT_COLUMN) {
			warnings.add('keys outside supported keyboard bounds');
			continue;
		}
		const slot = `${row},${col}`;
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
			...(finger.startsWith('L')
				? { hand: 'l' as const }
				: finger.startsWith('R')
					? { hand: 'r' as const }
					: {}),
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

function lowerSparkBehavior(
	value: SparkMagic | undefined,
	sparkKeys: readonly SparkKey[],
	warnings: Set<string>
): LayoutInputVariantSource {
	const sections = new Map<string, LoweredMagicSection>();
	const adaptiveMappings: Record<string, Record<string, string>> = Object.create(null);
	const chiralKeys: ChiralKey[] = [];
	if (!value) return {};

	for (const raw of value.magic_keys ?? []) {
		// The conventional rule-free @ uses the dedicated Repeat model.
		if (
			raw.key === '@' &&
			raw.default?.kind === 'repeat' &&
			!raw.rules?.length &&
			!raw.except?.length
		)
			continue;
		if (!isSingleCharacter(raw.key)) {
			warnings.add('some Magic keys');
			continue;
		}
		const section = sectionFor(sections, raw.key);
		if (raw.default?.kind === 'repeat') {
			section.fallbackKind = 'repeat-last';
		} else if (raw.default?.kind === 'char') {
			section.fallbackKind = 'emit';
			section.fallbackEmit = raw.default.char;
		}
		for (const rule of raw.rules ?? []) {
			addMagicRule(sections, raw.key, rule.after, rule.emit, warnings);
		}
		for (const except of raw.except ?? []) {
			if (except) {
				addMagicRule(sections, raw.key, except, raw.key, warnings);
			} else warnings.add('some Magic exceptions');
		}
	}

	for (const raw of value.chiral_keys ?? []) {
		try {
			const source = validateChiralKeySource({
				keys: [{ ...raw, same: raw.same ?? undefined, opposite: raw.opposite ?? undefined }]
			});
			if (!sparkKeys.some((key) => key.char === source.keys[0].key)) {
				warnings.add('chiral triggers missing from the keyboard');
				continue;
			}
			if (chiralKeys.some((rule) => rule.key === source.keys[0].key)) {
				warnings.add('duplicate chiral triggers');
				continue;
			}
			chiralKeys.push(...source.keys);
		} catch {
			warnings.add('some chiral keys');
		}
	}

	for (const raw of value.rules ?? []) {
		const inputs = Array.from(raw.inputs);
		const trigger = inputs.pop() ?? '';
		if (!isSingleCharacter(trigger)) {
			warnings.add('whitespace raw triggers');
			continue;
		}
		const after = inputs.join('');
		if (!after || !raw.output.startsWith(after) || raw.output.length === after.length) {
			warnings.add('raw rules that rewrite or delete earlier text');
			continue;
		}
		sectionFor(sections, trigger, true);
		addMagicRule(sections, trigger, after, raw.output.slice(after.length), warnings);
	}

	for (const raw of value.adaptive_swaps ?? []) {
		if (
			!isSingleCharacter(raw.trigger) ||
			!isSingleCharacter(raw.swap[0]) ||
			!isSingleCharacter(raw.swap[1])
		) {
			warnings.add('some Adaptive swaps');
			continue;
		}
		const trigger = raw.trigger.toLowerCase(),
			left = raw.swap[0].toLowerCase(),
			right = raw.swap[1].toLowerCase();
		if (![trigger, left, right].every(isSingleCharacter)) {
			warnings.add('some Adaptive swaps');
			continue;
		}
		// Identity swaps do not change behavior.
		if (left === right) continue;
		const swaps = (adaptiveMappings[trigger] ??= Object.create(null));
		if (Object.entries(swaps).some(([a, b]) => [a, b].includes(left) || [a, b].includes(right))) {
			warnings.add('conflicting Adaptive swaps');
			continue;
		}
		swaps[left] = right;
	}

	const mappings: Record<string, ExtendedMagicKeyTriggerSource> = Object.create(null);
	for (const section of sections.values()) {
		if (!section.rules.length && section.fallbackKind === 'no-op') continue;
		mappings[section.trigger] = {
			rules: Object.fromEntries(section.rules.map((rule) => [rule.after, rule.emit])),
			...(section.fallbackKind === 'repeat-last'
				? { fallback: 'repeat-last' as const }
				: section.fallbackKind === 'emit'
					? { fallback: { emit: section.fallbackEmit } }
					: {})
		};
	}
	const hands: Record<string, 'l' | 'r'> = Object.create(null);
	for (const key of sparkKeys)
		if (key.char && !Object.hasOwn(hands, key.char))
			hands[key.char] = key.finger.startsWith('L') ? 'l' : 'r';
	return {
		...(Object.keys(mappings).length ? { magicKeys: { mappings } } : {}),
		...(chiralKeys.length ? { chiralKeys: { keys: chiralKeys, hands } } : {}),
		...(Object.values(adaptiveMappings).some((swaps) => Object.keys(swaps).length)
			? {
					adaptiveSwaps: {
						mappings: Object.fromEntries(
							Object.entries(adaptiveMappings).filter(([, swaps]) => Object.keys(swaps).length)
						)
					}
				}
			: {})
	};
}

/** Compile the supported subset without mutating or discarding the validated source document. */
export function compileSparkLayout(value: unknown) {
	const document = validateSparkLayout(value);
	const warnings = new Set<string>();
	const { keys, sparkKeys } = projectSparkKeys(document.keys, warnings);
	const source = lowerSparkBehavior(document.magic, sparkKeys, warnings);
	const rawKeys: Record<string, { row: number; col: number; hand: 'l' | 'r' }> =
		Object.create(null);
	for (const key of sparkKeys)
		if (key.char && !Object.hasOwn(rawKeys, key.char))
			rawKeys[key.char] = {
				row: key.row,
				col: key.col,
				hand: key.finger.startsWith('L') ? 'l' : 'r'
			};
	const magicAt = document.magic?.magic_keys?.find((key) => key.key === '@');
	const claimedAt = Boolean(magicAt || document.magic?.chiral_keys?.some((key) => key.key === '@'));
	const conventionalAt =
		magicAt?.default?.kind === 'repeat' && !magicAt.rules?.length && !magicAt.except?.length;
	const repeatEnabled = Object.hasOwn(rawKeys, '@') && (!claimedAt || conventionalAt);
	const hasBehavior =
		source.magicKeys || source.adaptiveSwaps || source.chiralKeys || repeatEnabled;
	const profile = hasBehavior
		? compileLayoutInputProfile(source, rawKeys, repeatEnabled)
		: undefined;
	return { document, keys, source, profile, warnings: [...warnings] };
}
