# three-csm

Cascaded shadow maps (CSMs) implementation for [Three.js](https://threejs.org/). This approach provides higher resolution of shadows near the camera and lower resolution far away by using several shadow maps. CSMs are usually used for shadows cast by the sun over a large terrain.

## Examples

- [Basic](http://vthawk.github.io/three-csm/examples/basic/)

![Cascaded Shadow Maps](https://i.imgur.com/YSvYi2g.png)

## Installation

```html
<script src="/build/three-csm.js"></script>
```

Using CommonJS:

```
npm i three-csm
```

```javascript
const THREE = require('three');
THREE.CSM = require('three-csm');
```

Using ES6 modules:

```javascript
import * as THREE from 'three';
import * as CSM from 'three-csm';
THREE.CSM = CSM;
```

## Basic usage

```javascript
let camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
let renderer = new THREE.WebGLRenderer();

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // or any other type of shadowmap
	
let csm = new THREE.CSM({
	far: camera.far,
	cascades: 4,
	shadowMapSize: 1024,
	lightDirection: new THREE.Vector3(1, -1, 1).normalize(),
	camera: camera,
	parent: scene
});

let material = new THREE.MeshPhongMaterial(); // works with Phong and Standard materials
csm.setupMaterial(material); // must be called to pass all CSM-related uniforms to the shader

let mesh = new THREE.Mesh(new THREE.BoxBufferGeometry(), material);
mesh.castShadow = true;
mesh.receiveShadow = true;

scene.add(mesh);
```

Finally, in your update loop, call the update function before rendering:

```javascript
csm.update(camera.matrix);
```

## API

### `CSM`

### `constructor(settings)`

**Parameters**

- `settings` — `Object` which contains all setting of CSMs.

	- `settings.fov` — Frustum vertical field of view. Optional.
	
	- `settings.far` — Frustum far plane distance (i.e. shadows are not visible farther this distance from camera). May be smaller than `camera.far` value. Optional.
	
	- `settings.aspect` — Frustum aspect ratio. Optional.
	
	- `settings.camera` — Instance of `THREE.PerspectiveCamera` which is currently used for rendering.
	
	- `settings.parent` — Instance of `THREE.Object3D` where lights will be stored.
	
	- `settings.cascades` — Number of shadow cascades. Optional.
	
	- `settings.mode` — Defines a split scheme (how large frustum is splitted into smaller ones). Can be `uniform` (linear), `logarithmic`, `practical` or `custom`. For most cases `practical` may be the best choice. Equations used for each scheme can be found in [*GPU Gems 3. Chapter 10*](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch10.html). If mode is set to `custom`, you'll need to define your own `customSplitsCallback`. Optional.

    - `settings.customSplitsCallback` — A callback to compute custom cascade splits when mode is set to `custom`. Callback should accept three number parameters: `cascadeAmount`, `nearDistance`, `farDistance` and return an array of split distances ranging from 0 to 1, where 0 is equal to `nearDistance` and 1 is equal to `farDistance`. Check out the official modes in CSM.js to learn how they work.
	
	- `settings.shadowMapSize` — Resolution of shadow maps (one per cascade). Optional.
	
	- `settings.shadowBias` — Same as [THREE.LightShadow.bias](https://threejs.org/docs/#api/en/lights/shadows/LightShadow.bias). Optional.
	
	- `settings.lightIntensity` — Same as [THREE.DirectionalLight.intensity](https://threejs.org/docs/#api/en/lights/DirectionalLight). Optional.
	
	- `settings.lightDirection` — Normalized `THREE.Vector3()`. Optional.
	
	- `settings.lightNear` — Shadow camera frustum near plane. Optional.
	
	- `settings.lightFar` — Shadow camera frustum far plane. The larger is `settings.far` the bigger number should be used. Optional.
	
	- `settings.lightMargin` — Defines how far shadow camera is moved along z axis in cascade frustum space. The larger is the value the more space `LightShadow` will be able to cover. Should be set to high values for scenes with huge objects. Optional.


### `setupMaterial(material)`

Updates defines and uniforms of passed material. Should be called for every material which must use CSMs.

**Parameters**

- `material` — Instance of `THREE.Material`.

### `setAspect(aspect)`

Rebuilds splits using new aspect ratio.

**Parameters**

- `aspect` — Frustum aspect ratio.

### `remove()`

Removes all directional lights used by `CSM` instance from `parent` object specified in settings.

### `update(cameraMatrix)`

Updates positions of frustum splits in world space. Should be called before rendering.

**Parameters**

- `cameraMatrix` — `camera.matrix`, instance of `THREE.Matrix4`.

### `updateFrustums()`

Recalculates frustums for shadow cascades. Must be called after changing `mode` or `far` properties of `CSM` instance.

### `helper()`

Returns a `THREE.Object` which contains `THREE.Line` instances representing frustum splits used by CSMs.

## Contributing

Feel free to contribute. Use `npm run dev` to run a dev server.

## References

1. [Rouslan Dimitrov. *Cascaded ShadowMaps*](https://developer.download.nvidia.com/SDK/10.5/opengl/src/cascaded_shadow_maps/doc/cascaded_shadow_maps.pdf)
2. [*Cascaded Shadow Maps* on Windows Dev Center](https://docs.microsoft.com/en-us/windows/win32/dxtecharts/cascaded-shadow-maps)
3. [*3D Game Development with LWJGL 3. Cascaded Shadow Maps*](https://ahbejarano.gitbook.io/lwjglgamedev/chapter26)
4. [*GPU Gems 3. Chapter 10*](https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch10.html)