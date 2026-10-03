import {
	chiralMappingId,
	isChiralCharacter,
	type ChiralKeySource,
	type ChiralOutput
} from '$lib/chiralKeys';

export type ChiralOutputKind = 'key' | 'repeat' | 'char';
export interface CreatorChiralRule {
	id: string;
	key: string;
	sameKind: ChiralOutputKind;
	sameChar: string;
	oppositeKind: ChiralOutputKind;
	oppositeChar: string;
	except: string;
}
export interface CreatorChiralDraft {
	rules: CreatorChiralRule[];
}
let nextId = 0;
export function createCreatorChiralRule(): CreatorChiralRule {
	return {
		id: `chiral-${++nextId}`,
		key: '',
		sameKind: 'key',
		sameChar: '',
		oppositeKind: 'key',
		oppositeChar: '',
		except: ''
	};
}
export function createEmptyCreatorChiralDraft(): CreatorChiralDraft {
	return { rules: [] };
}
export function chiralDraftFromSource(source?: ChiralKeySource): CreatorChiralDraft {
	return {
		rules: (source?.keys ?? []).map((key) => ({
			...createCreatorChiralRule(),
			key: key.key,
			sameKind: key.same?.kind ?? 'key',
			sameChar: key.same?.kind === 'char' ? key.same.char : '',
			oppositeKind: key.opposite?.kind ?? 'key',
			oppositeChar: key.opposite?.kind === 'char' ? key.opposite.char : '',
			except: key.except?.join('') ?? ''
		}))
	};
}
export function creatorChiralRuleError(
	rule: CreatorChiralRule,
	availableKeys?: readonly string[]
): string | null {
	if (!rule.key) return null;
	if (!isChiralCharacter(rule.key)) return 'A chiral trigger must be one key.';
	if (availableKeys && !availableKeys.includes(rule.key))
		return 'The chiral trigger is not assigned to the keyboard.';
	for (const side of ['same', 'opposite'] as const)
		if (rule[`${side}Kind`] === 'char' && !isChiralCharacter(rule[`${side}Char`]))
			return 'Choose one output character for each hand.';
	if (Array.from(rule.except).some((char) => !isChiralCharacter(char)))
		return 'Exceptions may include Space, but not tabs or other whitespace.';
	return null;
}
export function chiralSourceFromDraft(
	draft: CreatorChiralDraft,
	availableKeys?: readonly string[]
): ChiralKeySource | undefined {
	const seen = new Set<string>();
	const keys = draft.rules.flatMap((rule) => {
		if (!rule.key || creatorChiralRuleError(rule, availableKeys) || seen.has(rule.key)) return [];
		seen.add(rule.key);
		const value = (side: 'same' | 'opposite'): ChiralOutput | undefined =>
			rule[`${side}Kind`] === 'repeat'
				? { kind: 'repeat' }
				: rule[`${side}Kind`] === 'char'
					? { kind: 'char', char: rule[`${side}Char`] }
					: undefined;
		return [
			{
				key: rule.key,
				same: value('same'),
				opposite: value('opposite'),
				except: Array.from(rule.except).filter(isChiralCharacter)
			}
		];
	});
	return keys.length ? { keys } : undefined;
}
export function chiralDraftEnabled(
	draft: CreatorChiralDraft,
	available: readonly string[],
	disabled: readonly string[]
) {
	return (
		chiralSourceFromDraft(draft, available)?.keys.some(
			(rule) => !disabled.includes(chiralMappingId(rule.key))
		) ?? false
	);
}
