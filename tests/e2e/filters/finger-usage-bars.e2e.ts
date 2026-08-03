import { expect, test } from '../fixtures/test';
import { MANA2_STAT_KEYS } from '$lib/statsDerivation';

function mana2Stats(values: Partial<Record<(typeof MANA2_STAT_KEYS)[number], number>>): number[] {
	return MANA2_STAT_KEYS.map((key) => Math.round((values[key] ?? 0) * 10_000));
}

test('opens the selected analyzer finger filter and Shift-click sets its maximum', async ({
	page
}) => {
	await page.route('**/layout-stats-mana2.json', async (route) => {
		await route.fulfill({
			json: {
				QWERTY: mana2Stats({
					'finger-usage-LP': 5.3,
					'finger-usage-LR': 7,
					'finger-usage-LM': 15,
					'finger-usage-LI': 18,
					'finger-usage-RI': 18,
					'finger-usage-RM': 15,
					'finger-usage-RR': 7,
					'finger-usage-RP': 5.3,
					sfb: 1
				})
			}
		});
	});
	await page.goto('/?name=QWERTY&analyzer=mana2&stats=1&testArea=0&likes=0&newIndicator=0');

	const qwertyCard = page.locator('[data-layout-name="QWERTY"]');
	const leftPinkyBar = qwertyCard.getByRole('button', {
		name: /Open Left pinky usage filter/
	});
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
