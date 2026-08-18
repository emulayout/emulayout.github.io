import { describe, expect, test } from 'bun:test';
import {
	REQUIRED_STATIC_FILES_BY_TASK,
	analyzerTasksForMissingStaticData,
	catalogSyncArgsForBootstrap
} from '../bin/ensure-static-data.js';

describe('local static-data bootstrap', () => {
	test('requires every configured dump-backed corpus artifact', () => {
		expect(REQUIRED_STATIC_FILES_BY_TASK.cmini).toEqual([
			'static/layout-stats-cmini-monkeyracer.json',
			'static/layout-stats-cmini-reddit.json'
		]);
		expect(REQUIRED_STATIC_FILES_BY_TASK.mana2).toEqual([
			'static/layout-stats-mana2-monkeyracer-rowstag-none.json',
			'static/layout-stats-mana2-reddit-rowstag-none.json'
		]);
	});

	test('runs only the analyzer whose artifact is missing', () => {
		expect(analyzerTasksForMissingStaticData(['static/layout-stats-cmini-reddit.json'])).toEqual([
			'cmini'
		]);
		expect(
			analyzerTasksForMissingStaticData(['static/layout-stats-mana2-monkeyracer-rowstag-none.json'])
		).toEqual(['mana2']);
	});

	test('refreshes every analyzer when the catalog must be rebuilt', () => {
		expect(analyzerTasksForMissingStaticData(['static/all-layouts.json'])).toEqual([
			'cmini',
			'cyanophage',
			'mana2'
		]);
	});

	test('uses offline catalog sync only when all cminibrowser inputs are cached', () => {
		expect(catalogSyncArgsForBootstrap(true)).toEqual(['--offline']);
		expect(catalogSyncArgsForBootstrap(false)).toEqual([]);
	});
});
