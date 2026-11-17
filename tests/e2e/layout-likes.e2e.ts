import { expect, test } from './fixtures/test';

test.use({ catalogVariant: 'core' });

test('likes a layout locally and hides the liked view when the last like is removed', async ({
	page
}) => {
	await page.goto('/');

	const heart = page.getByRole('button', { name: 'Like Colemak-DH', exact: true });
	const likedTab = page.getByRole('tab', { name: 'Liked layouts (1)' });
	await expect(likedTab).toHaveCount(0);
	await expect(heart).toHaveAttribute('aria-pressed', 'false');
	const communityCount = Number(await heart.innerText());

	const localNote = page.getByText(
		'Likes are saved only in this browser. Clearing this site’s data will erase them.',
		{ exact: true }
	);
	await expect(localNote).toHaveCount(0);
	await heart.press('Space');
	await expect(heart).toHaveAttribute('aria-pressed', 'true');
	await expect(heart).toHaveText(String(communityCount + 1));

	await likedTab.click();
	await expect(localNote).toBeVisible();
	await expect(likedTab).toHaveAttribute('aria-selected', 'true');
	await expect(page.locator('[data-layout-name]')).toHaveCount(1);
	await page.reload();

	await expect(likedTab).toHaveAttribute('aria-selected', 'true');
	await expect(heart).toHaveAttribute('aria-pressed', 'true');
	await expect(heart).toHaveText(String(communityCount + 1));

	await heart.click();
	await expect(localNote).toHaveCount(0);
	await expect(page.getByRole('tab', { name: /Liked layouts/ })).toHaveCount(0);
	await expect(page.getByRole('tab', { name: 'All layouts' })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await expect(heart).toHaveText(String(communityCount));
	await expect(heart).toHaveAttribute('aria-pressed', 'false');
	await page.reload();
	await expect(heart).toHaveAttribute('aria-pressed', 'false');
});
