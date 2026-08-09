import type { LayoutInputProfile } from '$lib/layoutInputBehaviors';
import { resolveLayoutInput } from '$lib/layoutInputBehaviors';

/**
 * Find characters in one lesson word that can be produced through an
 * Adaptive match. The marked group includes the preceding trigger and the
 * final emitted text after the remaining contextual behaviors resolve.
 */
export function buildTypingPracticeAdaptiveGroupIndexes(
	word: string,
	profile: LayoutInputProfile | undefined,
	disabledMappingIds: readonly string[] = []
): ReadonlySet<number> {
	const indexes = new Set<number>();
	if (!profile?.adaptiveSwaps) return indexes;

	const characters = Array.from(word);
	const disabledMappings = new Set(disabledMappingIds);
	for (let boundary = 1; boundary < characters.length; boundary += 1) {
		const history = characters.slice(0, boundary).join('');
		const trigger = characters[boundary - 1]?.toLowerCase();
		const remaining = characters.slice(boundary).join('');
		if (!trigger || !remaining) continue;

		for (const key of Object.keys(profile.adaptiveSwaps.byTrigger[trigger] ?? {})) {
			const candidates = key.toUpperCase() === key ? [key] : [key, key.toUpperCase()];
			const result = candidates
				.map((candidate) => resolveLayoutInput(profile, history, candidate, disabledMappings))
				.find(
					(candidate) =>
						candidate.applied.includes('adaptive-swap') &&
						candidate.text.length > 0 &&
						remaining.startsWith(candidate.text)
				);
			if (!result) continue;

			const end = boundary + Array.from(result.text).length;
			for (let index = boundary - 1; index < end; index += 1) indexes.add(index);
			break;
		}
	}

	return indexes;
}
