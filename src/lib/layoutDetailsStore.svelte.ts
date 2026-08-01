import {
	decodeLayoutDetail,
	layoutDetailUrl,
	type CompactLayoutDetail,
	type LayoutDetail
} from '$lib/layoutDetails';

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

class LayoutDetailsStore {
	details: Record<string, LayoutDetail> = $state({});
	loadingNames: Record<string, boolean> = $state({});
	loadErrors: Record<string, Error> = $state({});

	#requests = new Map<string, Promise<LayoutDetail | null>>();

	get(name: string): LayoutDetail | undefined {
		return this.details[name];
	}

	hydrate(value: CompactLayoutDetail, expectedName?: string): LayoutDetail | null {
		const detail = decodeLayoutDetail(value, expectedName);
		if (!detail) return null;
		this.details = { ...this.details, [detail.layout.name]: detail };
		this.#clearError(detail.layout.name);
		return detail;
	}

	async load(name: string, fetcher: Fetcher = fetch): Promise<LayoutDetail | null> {
		const existing = this.get(name);
		if (existing) return existing;
		const pending = this.#requests.get(name);
		if (pending) return pending;

		const request = this.#load(name, fetcher).finally(() => {
			this.#requests.delete(name);
			this.loadingNames = { ...this.loadingNames, [name]: false };
		});
		this.#requests.set(name, request);
		this.loadingNames = { ...this.loadingNames, [name]: true };
		return request;
	}

	async #load(name: string, fetcher: Fetcher): Promise<LayoutDetail | null> {
		try {
			const response = await fetcher(layoutDetailUrl(name));
			if (!response.ok) throw new Error(`Layout detail request failed (${response.status}).`);
			const value = (await response.json()) as CompactLayoutDetail;
			const detail = this.hydrate(value, name);
			if (!detail) throw new Error('Layout detail response was invalid.');
			return detail;
		} catch (error) {
			const resolved = error instanceof Error ? error : new Error('Could not load layout details.');
			this.loadErrors = { ...this.loadErrors, [name]: resolved };
			return null;
		}
	}

	#clearError(name: string) {
		if (!this.loadErrors[name]) return;
		const errors = { ...this.loadErrors };
		delete errors[name];
		this.loadErrors = errors;
	}
}

export const layoutDetailsStore = new LayoutDetailsStore();
