<script lang="ts">
	import ToggleSwitch from '$lib/components/ToggleSwitch.svelte';
	const { checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void } =
		$props();
</script>

<ToggleSwitch {checked} label="Finger assignments" onCheckedChange={onChange} />
