import { magicFallbackMappingId, magicRuleMappingId } from '$lib/inputMappingControls';
import { resolveMagicKeyOutput, type MagicKeyProfile } from '$lib/magicKeys';

/**
 * Find characters in one lesson word that can be produced as a Magic group.
 * Explicit rules include their preceding context; emitting fallbacks include
 * only the characters they produce, except repeat-last also includes the
 * repeated character that provides its context.
 */
export function buildTypingPracticeMagicGroupIndexes(
	word: string,
	profile: MagicKeyProfile | undefined,
	disabledMappingIds: readonly string[] = []
): ReadonlySet<number> {
	const indexes = new Set<number>();
	if (!profile) return indexes;

	const characters = Array.from(word);
	const disabledMappings = new Set(disabledMappingIds);
	for (let boundary = 0; boundary < characters.length; boundary += 1) {
		const history = characters.slice(0, boundary).join('');
		const normalizedHistory = history.toLowerCase();
		const remaining = characters.slice(boundary).join('');

		for (const [trigger, definition] of Object.entries(profile.triggers)) {
			const result = resolveMagicKeyOutput(profile, history, trigger, disabledMappings);
			if (!result.matched || !result.text || !remaining.startsWith(result.text)) continue;

			const rule = definition.rules.find(
				(candidate) =>
					!disabledMappings.has(magicRuleMappingId(trigger, candidate.after)) &&
					normalizedHistory.endsWith(candidate.after)
			);
			let start = boundary;
			if (rule) {
				start = boundary - Array.from(rule.after).length;
			} else if (
				definition.fallback?.kind === 'repeat-last' &&
				!disabledMappings.has(magicFallbackMappingId(trigger))
			) {
				start = boundary - 1;
			}

			const end = boundary + Array.from(result.text).length;
			for (let index = Math.max(start, 0); index < end; index += 1) indexes.add(index);
		}
	}

	return indexes;
}
