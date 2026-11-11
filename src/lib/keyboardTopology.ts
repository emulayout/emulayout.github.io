import { CATALOG_KEYBOARD_TOPOLOGIES } from '$lib/catalogKeyboardTopologies';
import { QWERTY_KEY_MAP } from '$lib/cmini/keyboard';
import type { LayoutData } from '$lib/layout';

export type KeyboardTopologyId = 'ansi' | 'iso' | 'ortho';
export type MissingKeyPolicy = 'preserve' | 'shift';
export interface PhysicalKey {
	id: string;
	/** Stable input configuration slot; independent of display order. */
	slot: string;
	row: number;
	column: number;
}
export interface KeyboardTopology {
	id: KeyboardTopologyId;
	label: string;
	keys: readonly PhysicalKey[];
}
const ansiKeys: PhysicalKey[] = Object.entries(QWERTY_KEY_MAP).map(([id, { row, col }]) => ({
	id,
	slot: `${row},${col}`,
	row,
	column: col
}));
export const KEYBOARD_TOPOLOGIES: Record<KeyboardTopologyId, KeyboardTopology> = {
	ortho: { id: 'ortho', label: 'Ortholinear', keys: ansiKeys },
	ansi: { id: 'ansi', label: 'ANSI', keys: ansiKeys },
	iso: {
		id: 'iso',
		label: 'ISO',
		keys: [...ansiKeys, { id: 'IntlBackslash', slot: '2,10', row: 2, column: -1 }]
	}
};
export function isKeyboardTopology(value: unknown): value is KeyboardTopologyId {
	return typeof value === 'string' && Object.hasOwn(KEYBOARD_TOPOLOGIES, value);
}
export interface LayoutPhysicalTopology {
	topology: KeyboardTopologyId;
	/** Authored slot → physical key identity. Never rewrites catalog/analyzer coordinates. */
	keyBySlot: ReadonlyMap<string, string>;
}

/**
 * Verified catalog adapters. Match the complete main-row occupied-slot signature, not a name suffix or
 * inferred fingering. Character changes retain the adapter; changed shapes keep their original interpretation.
 * Future catalog metadata can supply LayoutPhysicalTopology directly.
 */
export function catalogPhysicalTopology(
	name: string,
	positions: ReadonlyMap<string, string>
): LayoutPhysicalTopology | undefined {
	const adapter = CATALOG_KEYBOARD_TOPOLOGIES[name];
	if (!adapter) return undefined;
	for (let row = 0; row < 3; row++) {
		const expected = adapter.rows[row];
		const actual = [...positions].filter(([slot]) => Number(slot.split(',')[0]) === row);
		if (
			actual.length !== [...expected].filter((c) => c !== ' ').length ||
			actual.some(([slot]) => {
				const column = Number(slot.split(',')[1]);
				return expected[column] === undefined || expected[column] === ' ';
			})
		)
			return undefined;
	}
	const keyBySlot = new Map<string, string>();
	for (const slot of positions.keys()) {
		const [row, col] = slot.split(',').map(Number);
		if (row >= 3) continue;
		const key =
			col === 0 && row === 2 && adapter.topology === 'iso'
				? KEYBOARD_TOPOLOGIES.iso.keys.find((key) => key.id === 'IntlBackslash')
				: ansiKeys.find((key) => key.row === row && key.column === col - 1);
		if (key) keyBySlot.set(slot, key.id);
	}
	return { topology: adapter.topology, keyBySlot };
}

export interface ResolvedPhysicalKey {
	physicalId?: string;
	inputSlot?: string;
	row: number;
	column: number;
	reason?: string;
}

/** Mapping policies operate on key identities. Only the ISO→ANSI policy shifts a row. */
const fitPolicies: Partial<
	Record<`${KeyboardTopologyId}:${KeyboardTopologyId}`, ReadonlyMap<string, string | undefined>>
> = {
	'iso:ansi': new Map([
		['IntlBackslash', 'KeyZ'],
		...ansiKeys
			.filter((key) => key.row === 2)
			.map((key, index, keys) => [key.id, keys[index + 1]?.id] as const)
	])
};

export function resolvePhysicalKeys(
	layout: LayoutData,
	inputTopology: KeyboardTopologyId = 'ansi',
	policy: MissingKeyPolicy = 'preserve'
): ReadonlyMap<string, ResolvedPhysicalKey> {
	const target = layout.physicalTopology;
	const sourceKeys = KEYBOARD_TOPOLOGIES[inputTopology].keys;
	const fit =
		target && policy === 'shift' ? fitPolicies[`${target.topology}:${inputTopology}`] : undefined;
	return new Map<string, ResolvedPhysicalKey>(
		[...layout.positionBySlot.keys()].map((slot) => {
			const [row, column] = slot.split(',').map(Number);
			// Generic grids and thumbs retain their stable slots and existing correspondence.
			if (inputTopology === 'ortho' || !target || row >= 3)
				return [slot, { row, column, inputSlot: slot }];
			const id = target.keyBySlot.get(slot);
			const original = KEYBOARD_TOPOLOGIES[target.topology].keys.find((key) => key.id === id);
			const mappedId = id && fit?.has(id) ? fit.get(id) : id;
			const mapped = sourceKeys.find((key) => key.id === mappedId);
			return [
				slot,
				{
					physicalId: id,
					inputSlot: mapped?.slot,
					row,
					column: fit
						? (mapped?.column ?? (original?.column ?? column) + 1)
						: (original?.column ?? column),
					...(!mapped
						? {
								reason: fit
									? 'Shifting this row to fit leaves this key beyond your keyboard. Choose Preserve positions in Input layout to keep its original position.'
									: `This ${KEYBOARD_TOPOLOGIES[target.topology].label} key has no counterpart on your ${KEYBOARD_TOPOLOGIES[inputTopology].label} keyboard. Change the topology or choose Shift to fit in Input layout.`
							}
						: {})
				}
			];
		})
	);
}

/** Project presentation only; feedback/fingers continue to address authored slots. */
export function topologyPreviewRows(
	layout: LayoutData,
	rows: readonly (readonly import('$lib/layoutDisplay').DisplayCell[])[],
	topology: KeyboardTopologyId = 'ansi',
	policy: MissingKeyPolicy = 'preserve'
): import('$lib/layoutDisplay').DisplayCell[][] | undefined {
	if (topology === 'ortho' || !layout.physicalTopology) return undefined;
	const mapping = resolvePhysicalKeys(layout, topology, policy);
	return rows.map((row) => {
		const real = row.filter((cell) => cell.slot !== null);
		if (!real.length || Number(real[0].slot!.split(',')[0]) >= 3) return [...row];
		const rowNumber = Number(real[0].slot!.split(',')[0]);
		const projected = real.map((cell) => {
			const resolved = mapping.get(cell.slot!);
			return {
				...cell,
				displayColumn: resolved?.column ?? Number(cell.slot!.split(',')[1]),
				unavailableReason: resolved?.reason
			};
		});
		const byColumn = new Map(projected.map((cell) => [cell.displayColumn, cell]));
		const min = Math.min(0, ...byColumn.keys());
		const max = Math.max(9, ...byColumn.keys());
		return Array.from({ length: max - min + 1 }, (_, index) => {
			const column = min + index;
			return (
				byColumn.get(column) ?? {
					char: '',
					slot: `${rowNumber},${100 + column}`,
					displayColumn: column
				}
			);
		});
	});
}

/** Extra hardware identities must not alias a generic grid's extended columns. */
export function isAdditionalTopologySlot(
	slot: string,
	topology: KeyboardTopologyId = 'ansi'
): boolean {
	const key = KEYBOARD_TOPOLOGIES[topology].keys.find((candidate) => candidate.slot === slot);
	return Boolean(key && !ansiKeys.some((candidate) => candidate.id === key.id));
}
