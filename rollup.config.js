let pkg = require('./package.json');
import typescript from '@rollup/plugin-typescript';
import eslint from '@rollup/plugin-eslint';

export default {
	input: 'src/CSM.ts',
	output: [{
		file: pkg.main,
		format: 'umd',
		name: 'THREE.CSM',
		globals: {
			'three': 'THREE'
		},
		indent: '\t'
	}, {
		file: pkg.module,
		format: 'esm',
		globals: {
			'three': 'THREE'
		},
		indent: '\t'
	}],
	external: [
		'three'
	],
	plugins: [eslint({fix: true}), typescript()]
};