import { describe, expect, test } from 'bun:test';
import { layoutDetailNavigationState } from '../src/lib/layoutDetailTabs';

describe('layoutDetailNavigationState', () => {
	test('captures the untouched index URL when navigating from the index', () => {
		expect(
			layoutDetailNavigationState({}, '/', { pathname: '/', search: '?selected=lela' })
		).toEqual({ layoutIndexUrl: '/?selected=lela' });
	});

	test('recaptures the current index URL when the index is the current route', () => {
		expect(
			layoutDetailNavigationState({ layoutIndexUrl: '/?selected=lela' }, '/', {
				pathname: '/',
				search: ''
			})
		).toEqual({ layoutIndexUrl: '/' });
	});

	test('carries the captured URL through detail-to-detail navigation', () => {
		expect(
			layoutDetailNavigationState({ layoutIndexUrl: '/?selected=lela' }, '/layouts/[name]', {
				pathname: '/layouts/lela',
				search: '?tab=practice'
			})
		).toEqual({ layoutIndexUrl: '/?selected=lela' });
	});

	test('leaves the URL unset when the chain did not start on the index', () => {
		expect(
			layoutDetailNavigationState({}, '/layouts/[name]', {
				pathname: '/layouts/lela',
				search: '?tab=practice'
			})
		).toEqual({});
		expect(layoutDetailNavigationState({}, null, { pathname: '/', search: '' })).toEqual({});
	});
});
