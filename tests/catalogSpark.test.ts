import { describe, expect, spyOn, test } from 'bun:test';
import { readCatalogSparkContent } from '$lib/catalogSpark';
import { compileLayoutInputRegistry, resolveLayoutInput } from '$lib/layoutInputBehaviors';
import { creatorDraftsFromSupplemental } from '$lib/layoutCreatorMappings';

const content = {
	format: 'spark/1' as const,
	layout: {
		keys: [],
		custom: { notes: 'Retained source metadata' },
		magic: { magic_keys: [{ key: '*', rules: [{ after: 'c', emit: 'k' }] }] }
	}
};

describe('Spark catalog boundary', () => {
	test('validates and independently preserves Spark content and extensions', () => {
		const result = readCatalogSparkContent(content);
		expect(result).toEqual(content);
		expect(result.layout).not.toBe(content.layout);
		expect(result.layout.custom).not.toBe(content.layout.custom);
	});

	test('rejects retired catalog formats, unsupported versions, and malformed Spark', () => {
		for (const value of [
			{ schema: 1, magicKeys: { mappings: { '*': { c: 'k' } } } },
			{ schema: 1, variants: [{ id: 'default', magicKeys: { mappings: { '*': { c: 'k' } } } }] },
			{ schema: 1, meta: { homepage: 'https://example.com' } },
			{ ...content, format: 'spark/2' },
			{ format: 'spark/1' },
			null,
			[]
		])
			expect(() => readCatalogSparkContent(value)).toThrow('Unsupported catalog Spark transport');
		expect(() => readCatalogSparkContent({ format: 'spark/1', layout: { keys: null } })).toThrow();
	});

	test('isolates rejected entries and seeds the creator from the same Spark behavior', () => {
		const warning = spyOn(console, 'warn').mockImplementation(() => {});
		try {
			const profiles = compileLayoutInputRegistry({
				valid: content,
				legacy: { schema: 1, magicKeys: { mappings: { '*': { c: 'x' } } } },
				invalid: { format: 'spark/1', layout: { keys: null } }
			});
			expect([...profiles.keys()]).toEqual(['valid']);
			expect(resolveLayoutInput(profiles.get('valid'), 'c', '*').text).toBe('k');
			expect(warning).toHaveBeenCalledTimes(2);
			const drafts = creatorDraftsFromSupplemental(
				{ valid: readCatalogSparkContent(content) },
				'valid'
			);
			expect(drafts.hasMagicMappings).toBe(true);
			expect(drafts.magicDraft.sections[0].rules[0]).toMatchObject({ after: 'c', emit: 'k' });
		} finally {
			warning.mockRestore();
		}
	});
});
