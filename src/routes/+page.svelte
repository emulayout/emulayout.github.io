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

<div class="max-w-2xl mx-auto">
	<h1 class="text-3xl font-bold mb-4 tracking-tight" style="color: var(--text-primary);">
		Keyboard Layout Viewer
	</h1>

	<p class="mb-6" style="color: var(--text-secondary);">
		Viewing <span style="color: var(--accent); font-weight: 600;">Colemak-DH</span> layout
	</p>

	<pre
		class="p-6 rounded-xl font-mono text-sm leading-relaxed tracking-widest transition-all duration-300"
		style="background-color: var(--bg-secondary); color: var(--text-primary); border: 1px solid var(--border); box-shadow: 0 4px 20px var(--key-shadow);">{printPretty(
			layout
		)}</pre>
</div>
