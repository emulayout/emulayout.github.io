import {
	buildCreatorDocument,
	updateCreatorDocument,
	readCreatorDocument,
	creatorSparkProjection,
	type CreatorDocument
} from '$lib/creatorDocument';
import type { CreatorContentSnapshot } from '$lib/layoutCreatorUrl';
import type { SparkLayout } from '$lib/sparkSchema';

/** One canonical Spark document owns content; editor controls receive reconstructed projections. */
export class CreatorEditor {
	#document: CreatorDocument = $state.raw()!;
	#content = $derived.by(() => readCreatorDocument(this.#document)!);
	name = $state('');
	author = $state('');

	constructor(content: CreatorContentSnapshot) {
		this.replace(content);
	}
	get layout() {
		return this.#document.layout;
	}
	snapshot(): CreatorContentSnapshot {
		return { ...this.#content, name: this.name, author: this.author };
	}
	replace(content: CreatorContentSnapshot) {
		this.#document = buildCreatorDocument(content);
		this.name = content.name;
		this.author = content.author;
	}
	#update(patch: Partial<CreatorContentSnapshot>) {
		this.#document = updateCreatorDocument(this.#document, {
			name: this.name,
			author: this.author,
			...patch
		});
	}
	adoptSource(source: SparkLayout | undefined) {
		const content = this.snapshot();
		this.#update({
			sparkSource: source,
			sparkEditorBaseline: source ? creatorSparkProjection(content) : undefined
		});
	}
	get keyConfig(): CreatorContentSnapshot['keyConfig'] {
		return this.#content.keyConfig;
	}
	set keyConfig(value: CreatorContentSnapshot['keyConfig']) {
		this.#update({ keyConfig: value });
	}
	get magicDraft(): CreatorContentSnapshot['magicDraft'] {
		return this.#content.magicDraft;
	}
	set magicDraft(value: CreatorContentSnapshot['magicDraft']) {
		this.#update({ magicDraft: value });
	}
	get adaptiveDraft(): CreatorContentSnapshot['adaptiveDraft'] {
		return this.#content.adaptiveDraft;
	}
	set adaptiveDraft(value: CreatorContentSnapshot['adaptiveDraft']) {
		this.#update({ adaptiveDraft: value });
	}
	get chiralDraft(): NonNullable<CreatorContentSnapshot['chiralDraft']> {
		return this.#content.chiralDraft ?? { rules: [] };
	}
	set chiralDraft(value: NonNullable<CreatorContentSnapshot['chiralDraft']>) {
		this.#update({ chiralDraft: value });
	}
	get includeMagicKey(): boolean {
		return this.#content.includeMagicKey;
	}
	set includeMagicKey(value: boolean) {
		this.#update({ includeMagicKey: value });
	}
	get includeAdaptiveKey(): boolean {
		return this.#content.includeAdaptiveKey;
	}
	set includeAdaptiveKey(value: boolean) {
		this.#update({ includeAdaptiveKey: value });
	}
	get includeChiralKey(): boolean {
		return this.#content.includeChiralKey ?? false;
	}
	set includeChiralKey(value: boolean) {
		this.#update({ includeChiralKey: value });
	}
	get disabledMappingIds(): string[] {
		return this.#content.disabledMappingIds;
	}
	set disabledMappingIds(value: string[]) {
		this.#update({ disabledMappingIds: value });
	}
	get practiceLesson(): CreatorContentSnapshot['practiceLesson'] {
		return this.#content.practiceLesson;
	}
	set practiceLesson(value: CreatorContentSnapshot['practiceLesson']) {
		this.#update({ practiceLesson: value });
	}
}
