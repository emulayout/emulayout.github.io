import type { KeyboardTopologyId } from '$lib/keyboardTopology';

/** Reviewed catalog occupied-slot signatures. These layouts reserve column 0 for the ISO extra key.
 * Spaces are absent slots, including intentional holes; letters document the reviewed revision.
 * Character substitutions are allowed. A changed occupied-slot signature needs review. */
export const CATALOG_KEYBOARD_TOPOLOGIES: Readonly<
	Record<string, { topology: KeyboardTopologyId; rows: readonly string[] }>
> = {
	'bauxite-ansi': {
		topology: 'ansi',
		rows: [" blmdv'kou.", ' nrtsgyhaei,', ' jqwczpfx']
	},
	'bauxite-iso': {
		topology: 'iso',
		rows: [" blmdv'kou.", ' nrtsgyhaei,', 'xjqwczpf']
	},
	'c-major-ansi': {
		topology: 'ansi',
		rows: [" flrbk'guo.", ' shntmwyeai,', ' jxvdqpcz']
	},
	'c-major-iso': {
		topology: 'iso',
		rows: [" flrbk'guo.", ' shntmwyeai,', 'zjxvdqpc']
	},
	'c-major-isomtr': {
		topology: 'iso',
		rows: [" flrbk'guo.", ' shntmwyeai,', 'zjxvdqpc']
	},
	'c-minor-ansi': {
		topology: 'ansi',
		rows: [" flrbk'gou.", ' shntmwyaei,', ' jxvdqpc z']
	},
	'c-minor-iso': {
		topology: 'iso',
		rows: [" flrbk'gou.", ' shntmwyaei,', 'zjxvdqpc']
	},
	'c-minor-isomtr': {
		topology: 'iso',
		rows: [" flrbk'wou.", ' shntmgyaei,', 'zjxvdqpc']
	},
	'c-speed-isomtr': {
		topology: 'iso',
		rows: [" flrbk'wuo.", ' shntmpyeai,', 'zjxvdqcg']
	},
	'd-major-ansi': {
		topology: 'ansi',
		rows: [" flrbv'guo.", ' shntmydeai,', ' jxwkqpcz']
	},
	'd-major-iso': {
		topology: 'iso',
		rows: [" flrbv'guo.", ' shntmydeai,', 'zjxwkqpc']
	},
	'd-minor-ansi': {
		topology: 'ansi',
		rows: [" flrbv'gou.", ' shntmydaei,', ' jxwkqpc z']
	},
	'd-minor-iso': {
		topology: 'iso',
		rows: [" flrbv'gou.", ' shntmydaei,', 'zjxwkqpc']
	},
	'easy-harlot-ansi': {
		topology: 'ansi',
		rows: [" bfrlv'wou.", ' nshtdpyaei,', ' qzkmjcgx']
	},
	'easy-harlot-iso': {
		topology: 'iso',
		rows: [" bfrlv'wou.", ' nshtdpyaei,', 'qxzkmjcg']
	},
	'galgraph-iso': {
		topology: 'iso',
		rows: [" bldcv'fou.", ' nrtsgyhaei,', 'xjmwqzpk']
	},
	'harlot-ansi': {
		topology: 'ansi',
		rows: [" bfrlv'wou.", ' nshtdpyaei,', ' qzkmjcgx']
	},
	'harlot-iso': {
		topology: 'iso',
		rows: [" bfrlv'wou.", ' nshtdpyaei,', 'qxzkmjcg']
	}
};
