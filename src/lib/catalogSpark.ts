import { validateSparkLayout, type SparkLayout } from '$lib/sparkSchema';

export type CatalogSparkContent = { format: 'spark/1'; layout: SparkLayout };
export type CatalogSparkByLayout = Readonly<Record<string, CatalogSparkContent>>;

/** Catalog behavior uses Spark only; old user-document readers live at their own boundaries. */
export function readCatalogSparkContent(value: unknown): CatalogSparkContent {
	if (
		!value ||
		typeof value !== 'object' ||
		Array.isArray(value) ||
		!('format' in value) ||
		value.format !== 'spark/1' ||
		!('layout' in value)
	)
		throw new Error('Unsupported catalog Spark transport');
	return { format: 'spark/1', layout: validateSparkLayout(value.layout) };
}
