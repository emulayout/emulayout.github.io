# Emulayout

Browse, filter, and try thousands of alternative keyboard layouts in one place.

**Live site:** [emulayout.github.io](https://emulayout.github.io)

Emulayout helps you discover and quickly test keyboard layouts from the [cmini](https://github.com/Apsu/cmini) community repo — a large, constantly growing collection of ergonomic and alternative designs. You'll find mainstream alternatives alongside experimental and quirky ones. The real value is in narrowing that down to something that fits you.

Type directly on any layout card to get a feel for it without installing anything. Each card also links to [Cyanophage](https://cyanophage.github.io/playground.html), which benchmarks a layout for things like finger usage and finger travel — useful when you want deeper stats on a particular design.

Filtering is where this gets interesting. You can search by name, author, board type, thumb keys, and more — but the standout feature is per-key position matching. Specify exactly which characters you want (or don't want) at specific row and column positions, with AND, OR, and exclude logic. It's niche, but it's the kind of tool that pays off when you know what you're looking for.

## Running locally

Requires [Bun](https://bun.sh).

```sh
bun install
bun run ./bin/cmini-sync.js   # fetch layouts from cmini (first run clones the repo)
bun run dev
```

```sh
bun run build      # production build
bun run preview    # preview the build
bun run check      # typecheck
```
