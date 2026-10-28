/** Spark schema/1 layout content. Transport metadata and editor state are separate. */
export const SPARK_FORMAT = 'spark/1';
export const SPARK_FINGERS = ['LP', 'LR', 'LM', 'LI', 'RI', 'RM', 'RR', 'RP', 'LT', 'RT'] as const;
export type SparkFinger = (typeof SPARK_FINGERS)[number];
type Extensions = { [key: string]: unknown };
export type SparkKey = Extensions & {
	char?: string;
	row: number;
	col: number;
	finger: SparkFinger;
};
export type SparkOutput = ({ kind: 'repeat' } | { kind: 'char'; char: string }) & Extensions;
export type SparkMagicKey = Extensions & {
	key: string;
	default?: SparkOutput;
	rules?: (Extensions & { after: string; emit: string })[];
	except?: string[];
};
export type SparkChiralKey = Extensions & {
	key: string;
	same?: SparkOutput | null;
	opposite?: SparkOutput | null;
	except?: string[];
};
export type SparkAdaptiveSwap = Extensions & { trigger: string; swap: [string, string] };
export type SparkRawRule = Extensions & {
	inputs: string;
	output: string;
	type?: string;
	note?: string;
};
export type SparkMagic = Extensions & {
	magic_keys?: SparkMagicKey[];
	chiral_keys?: SparkChiralKey[];
	adaptive_swaps?: SparkAdaptiveSwap[];
	rules?: SparkRawRule[];
};
export type SparkLayout = Extensions & { keys: SparkKey[]; magic?: SparkMagic };

function record(value: unknown, path: string): asserts value is Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value))
		throw new Error(`${path} must be an object`);
}
function character(value: unknown, path: string) {
	if (typeof value !== 'string' || Array.from(value).length !== 1)
		throw new Error(`${path} must be one character`);
}
function text(value: unknown, path: string) {
	if (typeof value !== 'string' || !value) throw new Error(`${path} must be nonempty text`);
}
function array(value: unknown, path: string): unknown[] {
	if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
	return value;
}
function output(value: unknown, path: string) {
	record(value, path);
	if (value.kind === 'char') character(value.char, `${path}.char`);
	else if (typeof value.kind !== 'string') throw new Error(`${path} must be a tagged Magic value`);
	return value.kind === 'char' || value.kind === 'repeat';
}
function exceptions(value: unknown, path: string) {
	if (value === undefined) return;
	for (const entry of array(value, path))
		if (typeof entry !== 'string') throw new Error(`${path} must be an array of strings`);
}

export type SparkDrop = { path: string; reason: string };

/** Sanitize unknown behavior values in an independent clone; reject broken structure. */
export function validateSparkLayout(value: unknown, path = 'Spark layout') {
	record(value, path);
	value = structuredClone(value);
	record(value, path);
	const dropped: SparkDrop[] = [];
	function sanitizeOutput(entry: Record<string, unknown>, field: string, at: string) {
		if (!output(entry[field], `${at}.${field}`)) {
			const kind = (entry[field] as Record<string, unknown>).kind;
			dropped.push({
				path: `${at}.${field}`,
				reason: kind === 'skip_repeat' ? 'skip magic' : 'unknown Magic outputs'
			});
			delete entry[field];
		}
	}
	if (value.schema !== undefined && value.schema !== 1)
		throw new Error('Only Spark schema version 1 is supported');
	const slots = new Set<string>();
	for (const [index, key] of array(value.keys, `${path}.keys`).entries()) {
		const at = `${path}.keys[${index}]`;
		record(key, at);
		if (!Number.isSafeInteger(key.row) || !Number.isSafeInteger(key.col) || (key.col as number) < 0)
			throw new Error(`${at} must have integer row and non-negative col coordinates`);
		if (!SPARK_FINGERS.includes(key.finger as SparkFinger))
			throw new Error(`${at}.finger is not recognized`);
		if (key.char !== undefined) character(key.char, `${at}.char`);
		const slot = `${key.row},${key.col}`;
		if (slots.has(slot)) throw new Error(`${path} repeats position ${slot}`);
		slots.add(slot);
	}
	if (value.magic !== undefined) {
		const magic = value.magic;
		record(magic, `${path}.magic`);
		for (const field of ['magic_keys', 'chiral_keys', 'adaptive_swaps', 'rules'] as const) {
			if (magic[field] === undefined) continue;
			const kept: unknown[] = [];
			for (const [index, entry] of array(magic[field], `${path}.magic.${field}`).entries()) {
				const at = `${path}.magic.${field}[${index}]`;
				record(entry, at);
				if (field === 'chiral_keys' && entry.skip === true) {
					dropped.push({ path: at, reason: 'skip chiral keys' });
					continue;
				}
				kept.push(entry);
				if (field === 'rules') {
					text(entry.inputs, `${at}.inputs`);
					if (Array.from(entry.inputs as string).length < 2)
						throw new Error(`${at}.inputs must contain at least two characters`);
					if (typeof entry.output !== 'string') throw new Error(`${at}.output must be text`);
					for (const field of ['type', 'note'])
						if (entry[field] !== undefined && typeof entry[field] !== 'string')
							throw new Error(`${at}.${field} must be text`);
				} else if (field === 'adaptive_swaps') {
					character(entry.trigger, `${at}.trigger`);
					const swap = array(entry.swap, `${at}.swap`);
					if (swap.length !== 2) throw new Error(`${at}.swap must contain two characters`);
					for (const key of swap) character(key, `${at}.swap`);
				} else {
					character(entry.key, `${at}.key`);
					exceptions(entry.except, `${at}.except`);
					if (field === 'magic_keys') {
						if (entry.default !== undefined) sanitizeOutput(entry, 'default', at);
						if (entry.rules !== undefined) {
							entry.rules = array(entry.rules, `${at}.rules`).filter((rule, index) => {
								const ruleAt = `${at}.rules[${index}]`;
								record(rule, ruleAt);
								if (typeof rule.after !== 'string') {
									dropped.push({ path: ruleAt, reason: 'unsupported Magic contexts' });
									return false;
								}
								text(rule.after, `${ruleAt}.after`);
								text(rule.emit, `${ruleAt}.emit`);
								return true;
							});
						}
					} else
						for (const side of ['same', 'opposite'])
							if (entry[side] != null) sanitizeOutput(entry, side, at);
				}
			}
			magic[field] = kept;
		}
	}
	return { layout: value as SparkLayout, dropped };
}
