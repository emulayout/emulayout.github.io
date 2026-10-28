import type { LayoutData } from '$lib/layout';
import type { SparkFinger } from '$lib/sparkSchema';

export const FINGER_LABELS: Record<SparkFinger, string> = {
	LP: 'Left pinky',
	LR: 'Left ring',
	LM: 'Left middle',
	LI: 'Left index',
	LT: 'Left thumb',
	RI: 'Right index',
	RM: 'Right middle',
	RR: 'Right ring',
	RP: 'Right pinky',
	RT: 'Right thumb'
};

/** No inferred fingering: older catalogs without authored assignments remain neutral. */
export function fingerForSlot(layout: LayoutData, slot: string): SparkFinger | undefined {
	return layout.fingerBySlot?.get(slot);
}
