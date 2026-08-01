import { createDefaultViewSnapshot } from '$lib/filterSnapshot';
import { expect, test } from './fixtures/test';

function backupView(id: string, name: string) {
	return {
		id,
		name,
		snapshot: createDefaultViewSnapshot(),
		createdAt: 100
	};
}

test('selectively exports and replaces custom views from pasted backup text', async ({ page }) => {
	const localBackup = {
		version: 1,
		filters: [backupView('local-one', 'Local one'), backupView('local-two', 'Local two')]
	};
	await page.addInitScript((backup) => {
		localStorage.setItem('emulayout:saved-filters', JSON.stringify(backup));
	}, localBackup);
	await page.goto('/?stats=0&testArea=0&likes=0&newIndicator=0');

	await page.getByRole('button', { name: 'Settings' }).click();
	const dialog = page.getByRole('dialog', { name: 'Settings' });
	await expect(dialog).toBeVisible();

	await dialog.getByRole('tab', { name: 'Export views' }).click();
	const exportPanel = dialog.getByRole('tabpanel', { name: 'Export views' });
	await expect(exportPanel.getByRole('checkbox', { name: 'Local one' })).toBeChecked();
	await expect(
		exportPanel.getByRole('button', { name: 'Download file' }).locator('svg')
	).toHaveCount(1);
	await exportPanel.getByRole('checkbox', { name: 'Local two' }).uncheck();
	const exported = JSON.parse(await exportPanel.getByLabel('Backup JSON').inputValue()) as {
		filters: { name: string; snapshot: Record<string, unknown> }[];
	};
	expect(exported.filters.map((view) => view.name)).toEqual(['Local one']);
	expect(exported.filters[0].snapshot).toEqual({});
	const downloadStarted = page.waitForEvent('download');
	await exportPanel.getByRole('button', { name: 'Download file' }).click();
	const download = await downloadStarted;
	expect(download.suggestedFilename()).toMatch(/^emulayout-views-\d{4}-\d{2}-\d{2}\.json$/);

	await dialog.getByRole('tab', { name: 'Import views' }).click();
	const importPanel = dialog.getByRole('tabpanel', { name: 'Import views' });
	await expect(importPanel.locator('.views-file-button svg')).toHaveCount(1);
	const incomingBackup = {
		version: 1,
		filters: [backupView('new-one', 'New one'), backupView('new-two', 'New two')]
	};
	await importPanel.getByLabel('Backup JSON').fill(JSON.stringify(incomingBackup));
	await importPanel.getByRole('button', { name: 'Review pasted views' }).click();
	await importPanel.getByRole('checkbox', { name: 'New two' }).uncheck();
	await importPanel.getByRole('radio', { name: /Replace all views/ }).check();
	await importPanel.getByRole('button', { name: 'Import view' }).click();
	await expect(dialog.getByRole('status')).toContainText(
		'1 view imported, replacing the previous collection.'
	);
	await expect(importPanel.getByLabel('Backup JSON')).toHaveValue('');
	await expect(importPanel.getByLabel('Backup JSON')).toBeFocused();
	await expect(importPanel.getByRole('group', { name: 'Import behavior' })).toHaveCount(0);

	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(page.getByRole('tab', { name: 'New one' })).toBeVisible();
	await expect(page.getByRole('tab', { name: 'Local one' })).toHaveCount(0);
	await expect(page.getByRole('tab', { name: 'Local two' })).toHaveCount(0);

	await page.getByRole('button', { name: 'Settings' }).click();
	await dialog.getByRole('tab', { name: 'Import views' }).click();
	const fileBackup = {
		version: 1,
		filters: [backupView('new-one', 'New one'), backupView('added', 'Added from file')]
	};
	await importPanel.getByLabel('Choose JSON file').setInputFiles({
		name: 'views-backup.json',
		mimeType: 'application/json',
		buffer: Buffer.from(JSON.stringify(fileBackup))
	});
	await importPanel.getByRole('checkbox', { name: 'New one' }).uncheck();
	await importPanel.getByRole('button', { name: 'Import view' }).click();
	await expect(dialog.getByRole('status')).toHaveText('1 view imported.');
	await expect(importPanel.getByLabel('Backup JSON')).toHaveValue('');
	await dialog.getByRole('button', { name: 'Close' }).click();
	await expect(page.getByRole('tab', { name: 'New one' })).toBeVisible();
	await expect(page.getByRole('tab', { name: 'Added from file' })).toBeVisible();
});
