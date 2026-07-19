# Emulayout

Browse, filter, and try thousands of alternative keyboard layouts in one place.

**Live site:** [emulayout.github.io](https://emulayout.github.io)

Emulayout helps you discover and quickly test keyboard layouts from the [cmini](https://github.com/Apsu/cmini) community repo — a large, constantly growing collection of ergonomic and alternative designs. You'll find mainstream alternatives alongside experimental and quirky ones. The real value is in narrowing that down to something that fits you.

Type directly on any layout card to get a feel for it without installing anything. Each card also links to [Cyanophage](https://cyanophage.github.io/playground.html), which benchmarks a layout for things like finger usage and finger travel — useful when you want deeper stats on a particular design.

Filtering is where this gets interesting. You can search by name, author, board type, thumb keys, and more — but the standout feature is per-key position matching. Specify exactly which characters you want (or don't want) at specific row and column positions, with AND, OR, and exclude logic. It's niche, but it's the kind of tool that pays off when you know what you're looking for.

## Running locally

Install [mise](https://mise.jdx.dev/), then use the versions pinned in [`mise.toml`](mise.toml) (kept in sync with [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)):

| Tool | Purpose |
| --- | --- |
| Bun | App, sync scripts, build |
| Go | Building [Mana2](https://codeberg.org/Zakkkk/mana2) for layout stats |

```sh
mise install                  # Bun + Go from mise.toml
bun install
bun run ./bin/cmini-sync.js   # layouts + cmini/cyanophage stats → static/
bun run ./bin/mana2-sync.js   # Mana2 stats → static/layout-stats-mana2.json
bun run dev
```

Generated `static/*.json` files are gitignored; CI regenerates them on each deploy (including the daily sync).

- **cmini-sync** clones [Apsu/cmini](https://github.com/Apsu/cmini) into `.cache/cmini-repo` and writes layout/stats JSON under `static/`.
- **mana2-sync** clones Mana2 into `.cache/mana2`, builds the CLI, and writes `static/layout-stats-mana2.json`. Requires the Go version from `mise.toml`. Use `--offline` on later runs to skip git fetches. If Go is missing, the script skips instead of failing (except in CI).

```sh
bun run build      # production build
bun run preview    # preview the build
bun run check      # typecheck
```
