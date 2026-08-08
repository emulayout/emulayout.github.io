import { describe, expect, test } from 'bun:test';
import { parseSyncArgs } from '../bin/sync.js';

describe('sync command arguments', () => {
	test('parses supported targets and refresh modes', () => {
		expect(parseSyncArgs(['--cmini-stats', '--mana2-stats', '--offline'])).toMatchObject({
			targets: ['cmini-stats', 'mana2-stats'],
			mode: 'offline',
			interactive: false
		});
	});

	test('rejects corpus selection with a direct-script explanation', () => {
		expect(() => parseSyncArgs(['--cmini-stats', '--corpus=reddit'])).toThrow(
			'Use --corpus=NAME with the individual cmini-stats-sync or mana2-stats-sync script.'
		);
	});

	test('rejects other unsupported options instead of silently ignoring them', () => {
		expect(() => parseSyncArgs(['--all', '--unknown'])).toThrow(
			'Unsupported sync option: --unknown.'
		);
	});
});
