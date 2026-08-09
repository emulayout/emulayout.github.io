<script lang="ts">
	interface Props {
		checked: boolean;
		label: string;
		onCheckedChange: (checked: boolean) => void;
	}

	const { checked, label, onCheckedChange }: Props = $props();
</script>

<label class="toggle-switch">
	<input
		type="checkbox"
		role="switch"
		{checked}
		onchange={(event) => onCheckedChange(event.currentTarget.checked)}
	/>
	<span class="toggle-switch__track" aria-hidden="true"><span></span></span>
	<span>{label}</span>
</label>

<style>
	.toggle-switch {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--text-secondary);
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1rem;
		cursor: pointer;
	}

	.toggle-switch input {
		position: absolute;
		z-index: 1;
		inset: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.toggle-switch__track {
		display: inline-flex;
		width: 2rem;
		height: 1.125rem;
		flex-shrink: 0;
		align-items: center;
		padding: 0.125rem;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg-primary);
		transition:
			border-color 0.12s ease,
			background-color 0.12s ease;
	}

	.toggle-switch__track > span {
		width: 0.75rem;
		height: 0.75rem;
		border-radius: 50%;
		background: var(--text-secondary);
		transition:
			background-color 0.12s ease,
			transform 0.12s ease;
	}

	.toggle-switch input:checked + .toggle-switch__track {
		border-color: color-mix(in srgb, var(--accent) 72%, var(--border));
		background: color-mix(in srgb, var(--accent) 28%, var(--bg-primary));
	}

	.toggle-switch input:checked + .toggle-switch__track > span {
		background: var(--accent);
		transform: translateX(0.875rem);
	}

	.toggle-switch input:focus-visible + .toggle-switch__track {
		outline: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
		outline-offset: 0.15rem;
	}
</style>
