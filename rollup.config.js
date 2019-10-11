let pkg = require('./package.json');

export default {
	input: 'src/CSM.js',
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