/**
 * Trigger key -> one side of a swap -> the other side.
 *
 * The reverse direction is implicit: `{ "l": { "y": "j" } }` means that
 * immediately after `l`, `y` emits `j` and `j` emits `y`.
 */
export type AdaptiveSwapMappings = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface AdaptiveSwapSourceGroup {
	id: string;
	label: string;
	mappings: AdaptiveSwapMappings;
}

export interface AdaptiveSwapSource {
	mappings?: AdaptiveSwapMappings;
	groups?: readonly AdaptiveSwapSourceGroup[];
}

export interface AdaptiveSwapRule {
	trigger: string;
	left: string;
	right: string;
}

export interface AdaptiveSwapGroup {
	id: string;
	label: string;
	rules: readonly AdaptiveSwapRule[];
}

export interface AdaptiveSwapProfile {
	/** Every stored group is active; group metadata is presentation-only for now. */
	byTrigger: Readonly<Record<string, Readonly<Record<string, string>>>>;
	rules: readonly AdaptiveSwapRule[];
	groups: readonly AdaptiveSwapGroup[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSingleCharacter(value: string): boolean {
	return Array.from(value).length === 1;
}

function validateMappings(value: unknown, location: string): AdaptiveSwapMappings {
	if (!isRecord(value)) {
		throw new Error(`${location} must be an object`);
	}

	const mappings: Record<string, Record<string, string>> = Object.create(null);
	let ruleCount = 0;

	for (const [trigger, rawSwaps] of Object.entries(value)) {
		if (!isSingleCharacter(trigger)) {
			throw new Error(`${location} trigger ${JSON.stringify(trigger)} must be one character`);
		}
		if (!isRecord(rawSwaps)) {
			throw new Error(`${location} trigger ${JSON.stringify(trigger)} swaps must be an object`);
		}

		const swaps: Record<string, string> = Object.create(null);
		for (const [left, right] of Object.entries(rawSwaps)) {
			if (!isSingleCharacter(left)) {
				throw new Error(`${location} swap key ${JSON.stringify(left)} must be one character`);
			}
			if (typeof right !== 'string' || !isSingleCharacter(right)) {
				throw new Error(
					`${location} swap partner for ${JSON.stringify(left)} must be one character`
				);
			}
			if (left.toLowerCase() === right.toLowerCase()) {
				throw new Error(`${location} cannot swap ${JSON.stringify(left)} with itself`);
			}
			swaps[left] = right;
			ruleCount += 1;
		}

		if (Object.keys(swaps).length === 0) {
			throw new Error(`${location} trigger ${JSON.stringify(trigger)} must have at least one swap`);
		}
		mappings[trigger] = swaps;
	}

	if (ruleCount === 0) {
		throw new Error(`${location} must contain at least one swap`);
	}
	return mappings;
}

export function validateAdaptiveSwapSource(value: unknown): AdaptiveSwapSource {
	if (!isRecord(value)) {
		throw new Error('Adaptive-swap profile must be an object');
	}

	for (const key of Object.keys(value)) {
		if (key !== 'mappings' && key !== 'groups') {
			throw new Error(`Adaptive-swap profile has unknown field ${JSON.stringify(key)}`);
		}
	}

	const mappings =
		value.mappings === undefined
			? undefined
			: validateMappings(value.mappings, 'Adaptive-swap mappings');

	let groups: AdaptiveSwapSourceGroup[] | undefined;
	if (value.groups !== undefined) {
		if (!Array.isArray(value.groups)) {
			throw new Error('Adaptive-swap groups must be an array');
		}

		const ids = new Set<string>();
		groups = value.groups.map((rawGroup, index) => {
			if (!isRecord(rawGroup)) {
				throw new Error(`Adaptive-swap group ${index + 1} must be an object`);
			}
			for (const key of Object.keys(rawGroup)) {
				if (key !== 'id' && key !== 'label' && key !== 'mappings') {
					throw new Error(
						`Adaptive-swap group ${index + 1} has unknown field ${JSON.stringify(key)}`
					);
				}
			}
			if (typeof rawGroup.id !== 'string' || !rawGroup.id.trim()) {
				throw new Error(`Adaptive-swap group ${index + 1} must have a nonempty id`);
			}
			if (ids.has(rawGroup.id)) {
				throw new Error(`Adaptive-swap group id ${JSON.stringify(rawGroup.id)} is duplicated`);
			}
			ids.add(rawGroup.id);
			if (typeof rawGroup.label !== 'string' || !rawGroup.label.trim()) {
				throw new Error(
					`Adaptive-swap group ${JSON.stringify(rawGroup.id)} must have a nonempty label`
				);
			}

			return {
				id: rawGroup.id,
				label: rawGroup.label,
				mappings: validateMappings(
					rawGroup.mappings,
					`Adaptive-swap group ${JSON.stringify(rawGroup.id)} mappings`
				)
			};
		});
	}

	if (!mappings && (!groups || groups.length === 0)) {
		throw new Error('Adaptive-swap profile must contain mappings or at least one group');
	}

	return {
		...(mappings ? { mappings } : {}),
		...(groups ? { groups } : {})
	};
}

export function compileAdaptiveSwapSource(value: unknown): AdaptiveSwapProfile {
	const source = validateAdaptiveSwapSource(value);
	const byTrigger: Record<string, Record<string, string>> = Object.create(null);
	const seenPairs = new Set<string>();

	function compileMappings(mappings: AdaptiveSwapMappings | undefined): AdaptiveSwapRule[] {
		const rules: AdaptiveSwapRule[] = [];
		for (const [rawTrigger, swaps] of Object.entries(mappings ?? {})) {
			const trigger = rawTrigger.toLowerCase();
			const triggerMap = (byTrigger[trigger] ??= Object.create(null));

			for (const [rawLeft, rawRight] of Object.entries(swaps)) {
				const left = rawLeft.toLowerCase();
				const right = rawRight.toLowerCase();
				const pair = [left, right].sort().join('\0');
				const pairKey = `${trigger}\0${pair}`;
				if (seenPairs.has(pairKey)) {
					throw new Error(
						`Adaptive-swap trigger ${JSON.stringify(rawTrigger)} repeats swap ${JSON.stringify(rawLeft)} ↔ ${JSON.stringify(rawRight)}`
					);
				}
				if (triggerMap[left] !== undefined || triggerMap[right] !== undefined) {
					throw new Error(
						`Adaptive-swap trigger ${JSON.stringify(rawTrigger)} assigns a key to multiple swaps`
					);
				}

				seenPairs.add(pairKey);
				triggerMap[left] = right;
				triggerMap[right] = left;
				rules.push({ trigger, left, right });
			}
		}
		return rules;
	}

	const rules = compileMappings(source.mappings);
	const groups = (source.groups ?? []).map((group) => ({
		id: group.id,
		label: group.label,
		rules: compileMappings(group.mappings)
	}));

	return { byTrigger, rules, groups };
}

export function resolveAdaptiveSwap(
	profile: AdaptiveSwapProfile | undefined,
	previousOutput: string,
	inputText: string
): { text: string; matched: boolean } {
	if (!profile || Array.from(inputText).length !== 1) {
		return { text: inputText, matched: false };
	}

	const trigger = Array.from(previousOutput.toLowerCase()).at(-1);
	const normalizedInput = inputText.toLowerCase();
	const swapped = trigger ? profile.byTrigger[trigger]?.[normalizedInput] : undefined;
	if (!swapped) return { text: inputText, matched: false };

	const text = inputText !== normalizedInput ? swapped.toUpperCase() : swapped;
	return { text, matched: true };
}
