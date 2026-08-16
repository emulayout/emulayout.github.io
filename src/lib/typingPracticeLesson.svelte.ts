import {
	feelInputFromSourceCorrectCount,
	sourceInputFromFeelInput,
	type FeelWordPlan
} from '$lib/layoutFeel';
import {
	createTypingPracticeSessionFromProgress,
	sourceCorrectPrefixLength,
	type TypingPracticeSession
} from '$lib/typingPractice';
import {
	sharedLessonWordsAfterTabChange,
	sharedTypingPracticeLessonMatches,
	type SharedTypingPracticeLessonSource
} from '$lib/typingPracticeLesson';
import {
	ENGLISH_1K_WORD_POOL_URL,
	loadTypingPracticeWords,
	type TypingPracticeWordFetcher
} from '$lib/typingPracticeWords';

export type TypingPracticeWordPoolStatus = 'loading' | 'ready' | 'error';

/**
 * Page-session lesson shared by Typing practice and Layout feel so tab switches
 * keep leftover source words, refill a random lesson to ten words, and clear
 * progress, input, and the timer.
 */
export class SharedTypingPracticeLesson {
	wordPool = $state<string[]>([]);
	wordPoolStatus = $state<TypingPracticeWordPoolStatus>('loading');
	sourceWords = $state<string[]>([]);
	completedWordCount = $state(0);
	currentSourceInput = $state('');
	practiceInputHistory = $state('');
	correctAttemptCount = $state(0);
	incorrectAttemptCount = $state(0);
	startedAtMilliseconds = $state<number | null>(null);
	endedAtMilliseconds = $state<number | null>(null);
	currentTimeMilliseconds = $state(0);
	source = $state<SharedTypingPracticeLessonSource | null>(null);

	#wordPoolLoadStarted = false;

	get hasLesson() {
		return this.sourceWords.length > 0;
	}

	get hasStarted() {
		return this.startedAtMilliseconds !== null;
	}

	get hasInProgressWork() {
		return (
			this.startedAtMilliseconds !== null ||
			this.completedWordCount > 0 ||
			this.currentSourceInput !== ''
		);
	}

	matchesLesson(customText: string | null, specialWordsPercent: number) {
		return sharedTypingPracticeLessonMatches(
			this.source,
			this.hasLesson,
			customText,
			specialWordsPercent
		);
	}

	matchesUntouchedRandomSignatures(
		specialCandidateSignature: string,
		unreachableKeysSignature: string
	) {
		return (
			this.hasLesson &&
			this.source !== null &&
			this.source.customText === null &&
			this.source.specialCandidateSignature === specialCandidateSignature &&
			this.source.unreachableKeysSignature === unreachableKeysSignature
		);
	}

	ensureWordPool(fetcher: TypingPracticeWordFetcher) {
		if (this.wordPool.length > 0) {
			this.wordPoolStatus = 'ready';
			return;
		}
		if (this.#wordPoolLoadStarted) return;
		this.#wordPoolLoadStarted = true;
		this.wordPoolStatus = 'loading';
		void loadTypingPracticeWords(fetcher, ENGLISH_1K_WORD_POOL_URL)
			.then((words) => {
				this.wordPool = words;
				this.wordPoolStatus = 'ready';
			})
			.catch(() => {
				this.wordPoolStatus = 'error';
				this.#wordPoolLoadStarted = false;
			});
	}

	prepareForTabChange(options: {
		customText: string | null;
		customWords?: readonly string[];
		selectAdditionalWords: (count: number, excludedWords: readonly string[]) => string[];
	}) {
		const nextWords = sharedLessonWordsAfterTabChange({
			hasInProgressWork: this.hasInProgressWork,
			sourceWords: this.sourceWords,
			completedWordCount: this.completedWordCount,
			customText: options.customText,
			customWords: options.customWords,
			selectAdditionalWords: options.selectAdditionalWords
		});
		if (!nextWords) return;
		this.replaceLesson(
			nextWords,
			this.source ?? {
				customText: options.customText,
				specialWordsPercent: 0,
				specialCandidateSignature: '',
				unreachableKeysSignature: ''
			}
		);
	}

	replaceLesson(sourceWords: readonly string[], source: SharedTypingPracticeLessonSource) {
		this.sourceWords = [...sourceWords];
		this.source = { ...source };
		this.completedWordCount = 0;
		this.currentSourceInput = '';
		this.practiceInputHistory = '';
		this.correctAttemptCount = 0;
		this.incorrectAttemptCount = 0;
		this.startedAtMilliseconds = null;
		this.endedAtMilliseconds = null;
		this.currentTimeMilliseconds = 0;
	}

	applyPracticeSession(session: TypingPracticeSession, inputHistory = this.practiceInputHistory) {
		this.completedWordCount = session.completedWordCount;
		this.currentSourceInput = session.input;
		this.practiceInputHistory = inputHistory;
	}

	applyFeelProgress(completedWordCount: number, plan: FeelWordPlan | undefined, feelInput: string) {
		this.completedWordCount = completedWordCount;
		this.currentSourceInput = plan ? sourceInputFromFeelInput(plan, feelInput) : '';
	}

	toPracticeSession(): TypingPracticeSession {
		return createTypingPracticeSessionFromProgress(
			this.sourceWords,
			this.completedWordCount,
			this.currentSourceInput
		);
	}

	toFeelSession(plans: readonly FeelWordPlan[]): TypingPracticeSession {
		const activePlan = plans[this.completedWordCount];
		const feelInput = activePlan
			? feelInputFromSourceCorrectCount(
					activePlan,
					sourceCorrectPrefixLength(activePlan.sourceWord, this.currentSourceInput)
				)
			: '';
		return createTypingPracticeSessionFromProgress(
			plans.map((plan) => plan.feelWord),
			this.completedWordCount,
			feelInput
		);
	}

	recordAttempts(correct: number, incorrect: number, now: number) {
		if (correct + incorrect === 0) return;
		if (this.startedAtMilliseconds === null) {
			this.startedAtMilliseconds = now;
			this.currentTimeMilliseconds = now;
		}
		this.correctAttemptCount += correct;
		this.incorrectAttemptCount += incorrect;
	}

	markComplete(now: number) {
		this.endedAtMilliseconds = now;
		this.currentTimeMilliseconds = now;
	}
}
