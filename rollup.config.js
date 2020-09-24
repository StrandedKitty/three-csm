let pkg = require('./package.json');
import typescript from 'rollup-plugin-typescript'

export default {
	input: 'src/CSM.ts',
	plugins: [
		typescript()
	],
	output: [{
		file: pkg.main,
		format: 'umd',
		name: 'THREE.CSM',
		globals: {
			'three': 'THREE'
		},
		indent: '\t'
	},
	{
		file: pkg.module,
		format: 'esm',
		globals: {
			'three': 'THREE'
		},
		indent: '\t'
	}],
	external: [
		'three'
	]
};