import { compileSparkLayout } from '../src/lib/sparkCompiler.ts';

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
	return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Mana2 expansion is an analyzer adapter only. It never supplies client behavior.
 * @param {import('./akldb-cache.js').AkldbLayout} layout
 */
function analyzerMappingsFromAkldbLayout(layout) {
	const triggerKeys = new Set(
		[...(layout.magic?.magic_keys ?? []), ...(layout.magic?.chiral_keys ?? [])]
			.filter(isRecord)
			.map((key) => key.key)
	);
	for (const key of layout.magic?.magic_keys ?? []) {
		if (
			isRecord(key) &&
			key.key === '@' &&
			isRecord(key.default) &&
			key.default.kind === 'repeat' &&
			(!Array.isArray(key.rules) || !key.rules.length) &&
			(!Array.isArray(key.except) || !key.except.length)
		)
			triggerKeys.delete('@');
	}
	/** @type {Record<string, { rules: Record<string, string> }>} */
	const mappings = Object.create(null);
	for (const rule of layout.manaMagic?.rules ?? []) {
		const inputs = Array.from(rule.inputs);
		const trigger = inputs.pop();
		if (!trigger || !triggerKeys.has(trigger)) continue;
		const after = inputs.join('');
		if (!after || !rule.output.startsWith(after)) {
			throw new Error(
				`AKLDB Magic rule for ${JSON.stringify(layout.name)} rewrites its context and cannot be represented`
			);
		}
		const emit = rule.output.slice(after.length);
		if (!emit) throw new Error(`AKLDB Magic rule for ${JSON.stringify(layout.name)} emits no text`);
		const mapping = (mappings[trigger] ??= { rules: Object.create(null) });
		if (Object.hasOwn(mapping.rules, after)) {
			throw new Error(`AKLDB Magic rules repeat ${JSON.stringify(after + trigger)}`);
		}
		mapping.rules[after] = emit;
	}

	return Object.keys(mappings).length ? mappings : undefined;
}

/** Publish preserved Spark content; compile it only to derive catalog feature flags.
 * @param {import('./akldb-cache.js').AkldbLayout} layout
 */
export function supplementalFromAkldbLayout(layout) {
	const compiled = compileSparkLayout(
		layout.spark ?? {
			keys: layout.keys,
			...(layout.magic ? { magic: layout.magic } : {})
		}
	);
	return {
		supplemental: compiled.document.magic
			? { format: /** @type {const} */ ('spark/1'), layout: compiled.document }
			: undefined,
		source: compiled.source,
		repeatTrigger: Boolean(compiled.profile?.repeatKey),
		warnings: compiled.warnings,
		analyzerMappings: analyzerMappingsFromAkldbLayout(layout)
	};
}
