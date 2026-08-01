export interface TabOption<T extends string = string> {
	value: T;
	label: string;
	id?: string;
	controls?: string;
	class?: string;
	indicator?: boolean;
	indicatorSrLabel?: string;
}
