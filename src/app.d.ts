// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		interface PageState {
			/** Untouched index URL that opened this detail chain; see layoutDetailNavigationState. */
			layoutIndexUrl?: string;
		}
		// interface Platform {}
	}
}

export {};
