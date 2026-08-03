import { expect, test } from '../fixtures/test';

test('opens the selected analyzer finger filter and Shift-click sets its maximum', async ({
	page
}) => {
	await page.goto('/?name=QWERTY&analyzer=mana2&stats=1&testArea=0&likes=0&newIndicator=0');

	const qwertyCard = page.locator('[data-layout-name="QWERTY"]');
	const leftPinkyBar = qwertyCard.getByRole('button', {
		name: /Open Left pinky usage filter/
	});
	await leftPinkyBar.scrollIntoViewIfNeeded();
	await expect(leftPinkyBar).toBeVisible();

	const accessibleName = await leftPinkyBar.getAttribute('aria-label');
	const displayedValue = accessibleName?.match(/\(([\d.]+)%\)$/)?.[1];
	expect(displayedValue).toBeTruthy();

	await leftPinkyBar.click();

	const filterInput = page.locator('[data-stat-limit-key="mana-LP"]');
	await expect(page.locator('#stat-filters-tab-mana2')).toHaveAttribute('aria-selected', 'true');
	await expect(filterInput).toBeFocused();
	await expect(filterInput).toHaveValue('');
	const fingerUsageAccordion = page.locator('#stat-filters-mana2-finger-usage-accordion');
	const horizontalBounds = await fingerUsageAccordion.evaluate((accordion) => ({
		containerRight: accordion.getBoundingClientRect().right,
		controlRights: [
			...accordion.querySelectorAll('.stat-limit-operator, .stat-limit-value, .stat-limit-unit')
		].map((control) => control.getBoundingClientRect().right)
	}));
	expect(Math.max(...horizontalBounds.controlRights)).toBeLessThanOrEqual(
		horizontalBounds.containerRight
	);

	await leftPinkyBar.click({ modifiers: ['Shift'] });

	await expect(filterInput).toBeFocused();
	await expect(filterInput).toHaveValue(displayedValue!);
	await expect(
		page.locator('[data-stat-limit-control="mana-LP"] .stat-limit-operator')
	).toHaveValue('lt');
});
