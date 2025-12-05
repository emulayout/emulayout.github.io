<script lang="ts">
	import layout from '$lib/layouts/colemak-dh.json';

	function printPretty(data, splitCol = 5) {
		const rows = {};

		Object.entries(data.keys).forEach(([key, info]) => {
			if (!rows[info.row]) rows[info.row] = [];
			rows[info.row][info.col] = key;
		});

		const out = Object.keys(rows)
			.sort((a, b) => a - b)
			.map((row) => {
				const r = rows[row];
				return (
					r.slice(0, splitCol).join(' ') +
					'  ' + // extra gap between hands
					r.slice(splitCol).join(' ')
				);
			})
			.join('\n');

		return out;
	}
</script>

<h1>Welcome to SvelteKit</h1>
<p>Visit <a href="https://svelte.dev/docs/kit">svelte.dev/docs/kit</a> to read the documentation</p>

<pre>{printPretty(layout)}</pre>
