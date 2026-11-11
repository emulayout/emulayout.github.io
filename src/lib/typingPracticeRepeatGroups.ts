import { repeatKeyMappingId } from '$lib/inputMappingControls';
import { resolveLayoutInput, type LayoutInputProfile } from '$lib/layoutInputBehaviors';

/** Mark both characters of each doubled letter that the enabled Repeat key can type. */
export function buildTypingPracticeRepeatGroupIndexes(
	word: string,
	profile: LayoutInputProfile | undefined,
	disabledMappingIds: readonly string[] = []
): ReadonlySet<number> {
	const indexes = new Set<number>();
	const trigger = profile?.repeatKey?.trigger;
	const disabled = new Set(disabledMappingIds);
	if (!trigger || disabled.has(repeatKeyMappingId(trigger))) return indexes;

	let history = '';
	let previous = '';
	let index = 0;
	for (const character of word) {
		if (character === previous) {
			const result = resolveLayoutInput(profile, history, trigger, disabled);
			if (result.applied.includes('repeat-key') && result.text === character) {
				indexes.add(index - 1);
				indexes.add(index);
			}
		}
		history += character;
		previous = character;
		index += 1;
	}
	return indexes;
}
