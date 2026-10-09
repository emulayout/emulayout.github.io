import { normalizeCreatorContent, creatorDocumentSignature } from '$lib/creatorDocument';
import type { SparkLayout } from '$lib/sparkSchema';
import {
	createKeyboardInputConfigFromLayout,
	type InputKeyboardType,
	type KeyboardInputConfig,
	type KeyboardInputKey
} from '$lib/keyboardInputConfig';
import type { LayoutData } from '$lib/layout';
import { createEmptyCreatorChiralDraft, type CreatorChiralDraft } from '$lib/creatorChiralMappings';
import { LAYOUT_CREATOR_NEW_LAYOUT_NAME, createDefaultCreatorKeyConfig } from '$lib/layoutCreator';
import {
	createEmptyCreatorAdaptiveDraft,
	createEmptyCreatorMagicDraft,
	type CreatorAdaptiveDraft,
	type CreatorMagicDraft
} from '$lib/layoutCreatorMappings';
import {
	DEFAULT_LAYOUT_DETAIL_SECTION,
	parseCreatorDetailSection,
	type LayoutDetailSection
} from '$lib/layoutDetailTabs';
import {
	normalizeTypingPracticeLessonSettings,
	type TypingPracticeLessonSettings
} from '$lib/typingPracticeText';

export type CreatorContentSnapshot = {
	sparkSource?: SparkLayout;
	sparkEditorBaseline?: SparkLayout;
	name: string;
	author: string;
	includeMagicKey: boolean;
	includeAdaptiveKey: boolean;
	magicDraft: CreatorMagicDraft;
	adaptiveDraft: CreatorAdaptiveDraft;
	chiralDraft?: CreatorChiralDraft;
	includeChiralKey?: boolean;
	keyConfig: KeyboardInputConfig;
	practiceLesson: TypingPracticeLessonSettings;
	disabledMappingIds: string[];
};

export type CreatorViewState = {
	preview: boolean;
	section: Exclude<LayoutDetailSection, 'stats'>;
};

export type CreatorSnapshot = CreatorContentSnapshot & CreatorViewState;

function keySignature(key: KeyboardInputKey): string {
	return `${key.slot}\0${key.value}\0${key.inert ? '1' : '0'}\0${key.thumbHand ?? ''}\0${key.primary ? '1' : '0'}\0${key.hand ?? ''}`;
}

function keysEqual(left: readonly KeyboardInputKey[], right: readonly KeyboardInputKey[]): boolean {
	if (left.length !== right.length) return false;
	const signatures = left.map(keySignature).sort();
	return right
		.map(keySignature)
		.sort()
		.every((signature, index) => signature === signatures[index]);
}

/** True when `base` is set but the key grid is still the default QWERTY canvas. */
export function creatorKeyConfigNeedsCatalogBaseSeed(config: KeyboardInputConfig): boolean {
	const defaults = createDefaultCreatorKeyConfig();
	const baseName = config.baseLayoutName?.trim() ?? '';
	if (!baseName || baseName === defaults.baseLayoutName) return false;
	if (config.baseLayoutModified) return false;
	return keysEqual(config.keys, defaults.keys);
}

/** New Edit canvas named New layout, with this catalog layout as the selected base. */
export function createCreatorEditSnapshotFromLayout(
	layout: LayoutData,
	keyboardType: InputKeyboardType = 'staggered'
): CreatorSnapshot {
	return {
		...createDefaultCreatorSnapshot(),
		preview: false,
		includeMagicKey: layout.hasMagicKey,
		includeAdaptiveKey: layout.hasAdaptiveSwap,
		keyConfig: createKeyboardInputConfigFromLayout(layout, keyboardType)
	};
}

export function createDefaultCreatorSnapshot(): CreatorSnapshot {
	return {
		name: LAYOUT_CREATOR_NEW_LAYOUT_NAME,
		author: '',
		preview: false,
		section: DEFAULT_LAYOUT_DETAIL_SECTION,
		includeMagicKey: false,
		includeAdaptiveKey: false,
		magicDraft: createEmptyCreatorMagicDraft(),
		adaptiveDraft: createEmptyCreatorAdaptiveDraft(),
		chiralDraft: createEmptyCreatorChiralDraft(),
		includeChiralKey: false,
		keyConfig: createDefaultCreatorKeyConfig(),
		practiceLesson: normalizeTypingPracticeLessonSettings(null),
		disabledMappingIds: []
	};
}

export function creatorSnapshotSignature(snapshot: CreatorSnapshot): string {
	return `${creatorDocumentSignature(snapshot)}\0${snapshot.preview}\0${snapshot.section}`;
}

export function cloneCreatorSnapshot(snapshot: CreatorSnapshot): CreatorSnapshot {
	const content = normalizeCreatorContent(snapshot);
	return {
		...content,
		preview: snapshot.preview,
		section: parseCreatorDetailSection(snapshot.section)
	};
}

export function creatorContentFromSnapshot(snapshot: CreatorSnapshot): CreatorContentSnapshot {
	const { preview, section, ...content } = cloneCreatorSnapshot(snapshot);
	void preview;
	void section;
	return content;
}

export function creatorSnapshotFromContent(
	content: CreatorContentSnapshot,
	view: CreatorViewState = { preview: true, section: DEFAULT_LAYOUT_DETAIL_SECTION }
): CreatorSnapshot {
	return cloneCreatorSnapshot({ ...content, ...view });
}

export function creatorContentSnapshotSignature(content: CreatorContentSnapshot): string {
	return creatorDocumentSignature(content);
}

export function creatorSnapshotsEqual(left: CreatorSnapshot, right: CreatorSnapshot): boolean {
	return creatorSnapshotSignature(left) === creatorSnapshotSignature(right);
}

export function creatorContentEqual(
	left: CreatorSnapshot | CreatorContentSnapshot,
	right: CreatorSnapshot | CreatorContentSnapshot
): boolean {
	return creatorContentSnapshotSignature(left) === creatorContentSnapshotSignature(right);
}
