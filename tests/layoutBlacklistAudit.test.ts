import { describe, expect, test } from 'bun:test';
import {
	findAbsentBlacklistEntries,
	parseBlacklistEntries
} from '../bin/audit-layout-blacklist.js';

describe('layout blacklist audit', () => {
	test('parses entries while ignoring comments and whitespace', () => {
		expect(parseBlacklistEntries('# explanation\nalpha\n\n beta.json \n')).toEqual([
			'alpha',
			'beta.json'
		]);
	});

	test('finds absent entries with filename normalization and stable ordering', () => {
		expect(
			findAbsentBlacklistEntries(
				['missing-z', 'present', 'present-json.json', 'missing-a', 'missing-z'],
				['present.json', 'present-json.json', 'notes.txt']
			)
		).toEqual(['missing-a', 'missing-z']);
	});
});
