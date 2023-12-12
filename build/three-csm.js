(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three')) :
	typeof define === 'function' && define.amd ? define(['three'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, (global.THREE = global.THREE || {}, global.THREE.CSM = factory(global.THREE)));
})(this, (function (three) { 'use strict';

	const lightParsBeginInitial = three.ShaderChunk.lights_pars_begin;
	const CSMShader = {
	    lights_fragment_begin: (cascades) => /* glsl */ `
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );

vec3 geometryClearcoatNormal;

#ifdef CLEARCOAT

geometryClearcoatNormal = clearcoatNormal;

#endif

IncidentLight directLight;

#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )

	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {

		pointLight = pointLights[ i ];

		getPointLightInfo( pointLight, geometryPosition, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )

	SpotLight spotLight;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {

		spotLight = spotLights[ i ];

		getSpotLightInfo( spotLight, geometryPosition, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_DIR_LIGHTS > 0) && defined( RE_Direct ) && defined( USE_CSM ) && defined( CSM_CASCADES )

	DirectionalLight directionalLight;
	float linearDepth = (vViewPosition.z) / (shadowFar - cameraNear);
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif

	#if defined( USE_SHADOWMAP ) && defined( CSM_FADE ) && CSM_FADE == 1
	vec2 cascade;
	float cascadeCenter;
	float closestEdge;
	float margin;
	float csmx;
	float csmy;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );

	  	#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
			// NOTE: Depth gets larger away from the camera.
			// cascade.x is closer, cascade.y is further

				#if ( UNROLLED_LOOP_INDEX < ${cascades} )

					// NOTE: Apply CSM shadows

					cascade = CSM_cascades[ i ];
					cascadeCenter = ( cascade.x + cascade.y ) / 2.0;
					closestEdge = linearDepth < cascadeCenter ? cascade.x : cascade.y;
					margin = 0.25 * pow( closestEdge, 2.0 );
					csmx = cascade.x - margin / 2.0;
					csmy = cascade.y + margin / 2.0;
					if( linearDepth >= csmx && ( linearDepth < csmy || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 ) ) {

						float dist = min( linearDepth - csmx, csmy - linearDepth );
						float ratio = clamp( dist / margin, 0.0, 1.0 );

						vec3 prevColor = directLight.color;
						directionalLightShadow = directionalLightShadows[ i ];
						directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;

						bool shouldFadeLastCascade = UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth > cascadeCenter;
						directLight.color = mix( prevColor, directLight.color, shouldFadeLastCascade ? ratio : 1.0 );

						ReflectedLight prevLight = reflectedLight;
						RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

						bool shouldBlend = UNROLLED_LOOP_INDEX != CSM_CASCADES - 1 || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth < cascadeCenter;
						float blendRatio = shouldBlend ? ratio : 1.0;

						reflectedLight.directDiffuse = mix( prevLight.directDiffuse, reflectedLight.directDiffuse, blendRatio );
						reflectedLight.directSpecular = mix( prevLight.directSpecular, reflectedLight.directSpecular, blendRatio );
						reflectedLight.indirectDiffuse = mix( prevLight.indirectDiffuse, reflectedLight.indirectDiffuse, blendRatio );
						reflectedLight.indirectSpecular = mix( prevLight.indirectSpecular, reflectedLight.indirectSpecular, blendRatio );

					}

				#else

					// NOTE: Apply the reminder of directional lights

					directionalLightShadow = directionalLightShadows[ i ];
					directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;

					RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal,, material, reflectedLight );

				#endif

	  	#endif

	}
	#pragma unroll_loop_end
	#else

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

			directionalLight = directionalLights[ i ];
			getDirectionalLightInfo( directionalLight, directLight );

			#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )

				#if ( UNROLLED_LOOP_INDEX < ${cascades} )

					// NOTE: Apply CSM shadows

					directionalLightShadow = directionalLightShadows[ i ];
					if(linearDepth >= CSM_cascades[UNROLLED_LOOP_INDEX].x && linearDepth < CSM_cascades[UNROLLED_LOOP_INDEX].y) directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;

					if(linearDepth >= CSM_cascades[UNROLLED_LOOP_INDEX].x && (linearDepth < CSM_cascades[UNROLLED_LOOP_INDEX].y || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1)) RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

				#else

					// NOTE: Apply the reminder of directional lights

					directionalLightShadow = directionalLightShadows[ i ];
					directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;

					RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

				#endif

			#endif

		}
		#pragma unroll_loop_end

	#endif

	#if ( NUM_DIR_LIGHTS > NUM_DIR_LIGHT_SHADOWS)
		// compute the lights not casting shadows (if any)

		#pragma unroll_loop_start
		for ( int i = NUM_DIR_LIGHT_SHADOWS; i < NUM_DIR_LIGHTS; i ++ ) {

			directionalLight = directionalLights[ i ];

			getDirectionalLightInfo( directionalLight, directLight );

			RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

		}
		#pragma unroll_loop_end

	#endif

#endif


#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct ) && !defined( USE_CSM ) && !defined( CSM_CASCADES )

	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {

		directionalLight = directionalLights[ i ];

		getDirectionalLightInfo( directionalLight, directLight );

		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif

		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )

	RectAreaLight rectAreaLight;

	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {

		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );

	}
	#pragma unroll_loop_end

#endif

#if defined( RE_IndirectDiffuse )

	vec3 iblIrradiance = vec3( 0.0 );

	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );

	#if defined( USE_LIGHT_PROBES )

		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );

	#endif

	#if ( NUM_HEMI_LIGHTS > 0 )

		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {

				irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );

		}
		#pragma unroll_loop_end

	#endif

#endif

#if defined( RE_IndirectSpecular )

	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );

#endif
`,
	    lights_pars_begin: (maxCascades) => /* glsl */ `
#if defined( USE_CSM ) && defined( CSM_CASCADES )
uniform vec2 CSM_cascades[${maxCascades}]; // This value is the max. number supported of cascades
uniform float cameraNear;
uniform float shadowFar;
#endif
	` + lightParsBeginInitial
	};

	class CSMHelper extends three.Group {
	    constructor(csm) {
	        super();
	        this.displayFrustum = true;
	        this.displayPlanes = true;
	        this.displayShadowBounds = true;
	        this.cascadeLines = [];
	        this.cascadePlanes = [];
	        this.shadowLines = [];
	        this.csm = csm;
	        const indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
	        const positions = new Float32Array(24);
	        const frustumGeometry = new three.BufferGeometry();
	        frustumGeometry.setIndex(new three.BufferAttribute(indices, 1));
	        frustumGeometry.setAttribute('position', new three.BufferAttribute(positions, 3, false));
	        const frustumLines = new three.LineSegments(frustumGeometry, new three.LineBasicMaterial());
	        this.add(frustumLines);
	        this.frustumLines = frustumLines;
	    }
	    updateVisibility() {
	        const displayFrustum = this.displayFrustum;
	        const displayPlanes = this.displayPlanes;
	        const displayShadowBounds = this.displayShadowBounds;
	        const frustumLines = this.frustumLines;
	        const cascadeLines = this.cascadeLines;
	        const cascadePlanes = this.cascadePlanes;
	        const shadowLines = this.shadowLines;
	        for (let i = 0, l = cascadeLines.length; i < l; i++) {
	            const cascadeLine = cascadeLines[i];
	            const cascadePlane = cascadePlanes[i];
	            const shadowLineGroup = shadowLines[i];
	            cascadeLine.visible = displayFrustum;
	            cascadePlane.visible = displayFrustum && displayPlanes;
	            shadowLineGroup.visible = displayShadowBounds;
	        }
	        frustumLines.visible = displayFrustum;
	    }
	    update() {
	        const csm = this.csm;
	        const camera = csm.camera;
	        const cascades = csm.cascades;
	        const mainFrustum = csm.mainFrustum;
	        const frustums = csm.frustums;
	        const lights = csm.lights;
	        const frustumLines = this.frustumLines;
	        const frustumLinePositions = frustumLines.geometry.getAttribute('position');
	        const cascadeLines = this.cascadeLines;
	        const cascadePlanes = this.cascadePlanes;
	        const shadowLines = this.shadowLines;
	        this.position.copy(camera.position);
	        this.quaternion.copy(camera.quaternion);
	        this.scale.copy(camera.scale);
	        this.updateMatrixWorld(true);
	        while (cascadeLines.length > cascades) {
	            this.remove(cascadeLines.pop());
	            this.remove(cascadePlanes.pop());
	            this.remove(shadowLines.pop());
	        }
	        while (cascadeLines.length < cascades) {
	            const cascadeLine = new three.Box3Helper(new three.Box3(), new three.Color(0xffffff));
	            const planeMat = new three.MeshBasicMaterial({ transparent: true, opacity: 0.1, depthWrite: false, side: three.DoubleSide });
	            const cascadePlane = new three.Mesh(new three.PlaneGeometry(), planeMat);
	            const shadowLineGroup = new three.Group();
	            const shadowLine = new three.Box3Helper(new three.Box3(), new three.Color(0xffff00));
	            shadowLineGroup.add(shadowLine);
	            this.add(cascadeLine);
	            this.add(cascadePlane);
	            this.add(shadowLineGroup);
	            cascadeLines.push(cascadeLine);
	            cascadePlanes.push(cascadePlane);
	            shadowLines.push(shadowLineGroup);
	        }
	        for (let i = 0; i < cascades; i++) {
	            const frustum = frustums[i];
	            const light = lights[i];
	            const shadowCam = light.shadow.camera;
	            const farVerts = frustum.vertices.far;
	            const cascadeLine = cascadeLines[i];
	            const cascadePlane = cascadePlanes[i];
	            const shadowLineGroup = shadowLines[i];
	            const shadowLine = shadowLineGroup.children[0];
	            cascadeLine.box.min.copy(farVerts[2]);
	            cascadeLine.box.max.copy(farVerts[0]);
	            cascadeLine.box.max.z += 1e-4;
	            cascadePlane.position.addVectors(farVerts[0], farVerts[2]);
	            cascadePlane.position.multiplyScalar(0.5);
	            cascadePlane.scale.subVectors(farVerts[0], farVerts[2]);
	            cascadePlane.scale.z = 1e-4;
	            this.remove(shadowLineGroup);
	            shadowLineGroup.position.copy(shadowCam.position);
	            shadowLineGroup.quaternion.copy(shadowCam.quaternion);
	            shadowLineGroup.scale.copy(shadowCam.scale);
	            shadowLineGroup.updateMatrixWorld(true);
	            this.attach(shadowLineGroup);
	            shadowLine.box.min.set(shadowCam.bottom, shadowCam.left, -shadowCam.far);
	            shadowLine.box.max.set(shadowCam.top, shadowCam.right, -shadowCam.near);
	        }
	        const nearVerts = mainFrustum.vertices.near;
	        const farVerts = mainFrustum.vertices.far;
	        frustumLinePositions.setXYZ(0, farVerts[0].x, farVerts[0].y, farVerts[0].z);
	        frustumLinePositions.setXYZ(1, farVerts[3].x, farVerts[3].y, farVerts[3].z);
	        frustumLinePositions.setXYZ(2, farVerts[2].x, farVerts[2].y, farVerts[2].z);
	        frustumLinePositions.setXYZ(3, farVerts[1].x, farVerts[1].y, farVerts[1].z);
	        frustumLinePositions.setXYZ(4, nearVerts[0].x, nearVerts[0].y, nearVerts[0].z);
	        frustumLinePositions.setXYZ(5, nearVerts[3].x, nearVerts[3].y, nearVerts[3].z);
	        frustumLinePositions.setXYZ(6, nearVerts[2].x, nearVerts[2].y, nearVerts[2].z);
	        frustumLinePositions.setXYZ(7, nearVerts[1].x, nearVerts[1].y, nearVerts[1].z);
	        frustumLinePositions.needsUpdate = true;
	    }
	}

	const inverseProjectionMatrix = new three.Matrix4();
	class CSMFrustum {
	    constructor(data = {}) {
	        this.vertices = {
	            near: [
	                new three.Vector3(),
	                new three.Vector3(),
	                new three.Vector3(),
	                new three.Vector3()
	            ],
	            far: [
	                new three.Vector3(),
	                new three.Vector3(),
	                new three.Vector3(),
	                new three.Vector3()
	            ]
	        };
	        if (data.projectionMatrix !== undefined) {
	            this.setFromProjectionMatrix(data.projectionMatrix, data.maxFar || 10000);
	        }
	    }
	    setFromProjectionMatrix(projectionMatrix, maxFar) {
	        const isOrthographic = projectionMatrix.elements[2 * 4 + 3] === 0;
	        inverseProjectionMatrix.copy(projectionMatrix).invert();
	        // 3 --- 0  vertices.near/far order
	        // |     |
	        // 2 --- 1
	        // clip space spans from [-1, 1]
	        this.vertices.near[0].set(1, 1, -1);
	        this.vertices.near[1].set(1, -1, -1);
	        this.vertices.near[2].set(-1, -1, -1);
	        this.vertices.near[3].set(-1, 1, -1);
	        this.vertices.near.forEach(function (v) {
	            v.applyMatrix4(inverseProjectionMatrix);
	        });
	        this.vertices.far[0].set(1, 1, 1);
	        this.vertices.far[1].set(1, -1, 1);
	        this.vertices.far[2].set(-1, -1, 1);
	        this.vertices.far[3].set(-1, 1, 1);
	        this.vertices.far.forEach(function (v) {
	            v.applyMatrix4(inverseProjectionMatrix);
	            const absZ = Math.abs(v.z);
	            if (isOrthographic) {
	                v.z *= Math.min(maxFar / absZ, 1.0);
	            }
	            else {
	                v.multiplyScalar(Math.min(maxFar / absZ, 1.0));
	            }
	        });
	        return this.vertices;
	    }
	    split(breaks, target) {
	        while (breaks.length > target.length) {
	            target.push(new CSMFrustum());
	        }
	        target.length = breaks.length;
	        for (let i = 0; i < breaks.length; i++) {
	            const cascade = target[i];
	            if (i === 0) {
	                for (let j = 0; j < 4; j++) {
	                    cascade.vertices.near[j].copy(this.vertices.near[j]);
	                }
	            }
	            else {
	                for (let j = 0; j < 4; j++) {
	                    cascade.vertices.near[j].lerpVectors(this.vertices.near[j], this.vertices.far[j], breaks[i - 1]);
	                }
	            }
	            if (i === breaks.length - 1) {
	                for (let j = 0; j < 4; j++) {
	                    cascade.vertices.far[j].copy(this.vertices.far[j]);
	                }
	            }
	            else {
	                for (let j = 0; j < 4; j++) {
	                    cascade.vertices.far[j].lerpVectors(this.vertices.near[j], this.vertices.far[j], breaks[i]);
	                }
	            }
	        }
	    }
	    toSpace(cameraMatrix, target) {
	        for (let i = 0; i < 4; i++) {
	            target.vertices.near[i]
	                .copy(this.vertices.near[i])
	                .applyMatrix4(cameraMatrix);
	            target.vertices.far[i]
	                .copy(this.vertices.far[i])
	                .applyMatrix4(cameraMatrix);
	        }
	    }
	}

	function uniformSplit(amount, near, far, target) {
	    for (let i = 1; i < amount; i++) {
	        target.push((near + (far - near) * i / amount) / far);
	    }
	    target.push(1);
	}
	function logarithmicSplit(amount, near, far, target) {
	    for (let i = 1; i < amount; i++) {
	        target.push((near * Math.pow((far / near), (i / amount))) / far);
	    }
	    target.push(1);
	}
	function practicalSplit(amount, near, far, lambda, target) {
	    _uniformArray.length = 0;
	    _logArray.length = 0;
	    logarithmicSplit(amount, near, far, _logArray);
	    uniformSplit(amount, near, far, _uniformArray);
	    for (let i = 1; i < amount; i++) {
	        target.push(three.MathUtils.lerp(_uniformArray[i - 1], _logArray[i - 1], lambda));
	    }
	    target.push(1);
	}
	const _origin = new three.Vector3(0, 0, 0);
	const _lightOrientationMatrix = new three.Matrix4();
	const _lightOrientationMatrixInverse = new three.Matrix4();
	const _cameraToLightParentMatrix = new three.Matrix4();
	const _cameraToLightMatrix = new three.Matrix4();
	const _lightSpaceFrustum = new CSMFrustum();
	const _center = new three.Vector3();
	const _bbox = new three.Box3();
	const _uniformArray = [];
	const _logArray = [];
	class CSM {
	    constructor(data) {
	        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
	        this.mainFrustum = new CSMFrustum();
	        this.frustums = [];
	        this.breaks = [];
	        this.lights = [];
	        this.shaders = new Map();
	        this.camera = data.camera;
	        this.parent = data.parent;
	        this.cascades = (_a = data.cascades) !== null && _a !== void 0 ? _a : 3;
	        this.maxCascades = (_b = data.maxCascades) !== null && _b !== void 0 ? _b : data.cascades;
	        this.maxFar = (_c = data.maxFar) !== null && _c !== void 0 ? _c : 100000;
	        this.mode = (_d = data.mode) !== null && _d !== void 0 ? _d : 'practical';
	        this.practicalModeLambda = (_e = data.practicalModeLambda) !== null && _e !== void 0 ? _e : 0.5;
	        this.shadowMapSize = (_f = data.shadowMapSize) !== null && _f !== void 0 ? _f : 2048;
	        this.shadowBias = (_g = data.shadowBias) !== null && _g !== void 0 ? _g : 0;
	        this.shadowNormalBias = (_h = data.shadowNormalBias) !== null && _h !== void 0 ? _h : 0;
	        this.lightDirection = (_j = data.lightDirection) !== null && _j !== void 0 ? _j : new three.Vector3(1, -1, 1).normalize();
	        this.lightDirectionUp = (_k = data.lightDirectionUp) !== null && _k !== void 0 ? _k : three.Object3D.DEFAULT_UP;
	        this.lightIntensity = (_l = data.lightIntensity) !== null && _l !== void 0 ? _l : 1;
	        this.lightColor = (_m = data.lightColor) !== null && _m !== void 0 ? _m : new three.Color(0xffffff);
	        this.lightMargin = (_o = data.lightMargin) !== null && _o !== void 0 ? _o : 200;
	        this.fade = (_p = data.fade) !== null && _p !== void 0 ? _p : false;
	        this.noLastCascadeCutOff = (_q = data.noLastCascadeCutOff) !== null && _q !== void 0 ? _q : false;
	        this.customSplitsCallback = data.customSplitsCallback;
	        this.createLights();
	        this.updateFrustums();
	        this.injectInclude();
	    }
	    createLights() {
	        for (let i = 0; i < this.cascades; i++) {
	            const light = new three.DirectionalLight(this.lightColor, this.lightIntensity);
	            light.castShadow = true;
	            light.shadow.mapSize.width = this.shadowMapSize;
	            light.shadow.mapSize.height = this.shadowMapSize;
	            light.shadow.camera.near = 0;
	            light.shadow.camera.far = 1;
	            this.parent.add(light.target);
	            this.lights.push(light);
	        }
	        // NOTE: Prepend lights to the parent as we assume CSM shadows come from first light sources in the world
	        for (let i = this.lights.length - 1; i >= 0; i--) {
	            const light = this.lights[i];
	            light.parent = this.parent;
	            this.parent.children.unshift(light);
	        }
	    }
	    initCascades() {
	        this.mainFrustum.setFromProjectionMatrix(this.camera.projectionMatrix, this.maxFar);
	        this.mainFrustum.split(this.breaks, this.frustums);
	    }
	    updateShadowBounds() {
	        const frustums = this.frustums;
	        for (let i = 0; i < frustums.length; i++) {
	            const light = this.lights[i];
	            const shadowCam = light.shadow.camera;
	            const frustum = this.frustums[i];
	            // Get the two points that represent that furthest points on the frustum assuming
	            // that's either the diagonal across the far plane or the diagonal across the whole
	            // frustum itself.
	            const nearVerts = frustum.vertices.near;
	            const farVerts = frustum.vertices.far;
	            const point1 = farVerts[0];
	            let point2;
	            if (point1.distanceTo(farVerts[2]) > point1.distanceTo(nearVerts[2])) {
	                point2 = farVerts[2];
	            }
	            else {
	                point2 = nearVerts[2];
	            }
	            let squaredBBWidth = point1.distanceTo(point2);
	            if (this.fade) {
	                // expand the shadow extents by the fade margin if fade is enabled.
	                const camera = this.camera;
	                const far = Math.max(camera.far, this.maxFar);
	                const linearDepth = frustum.vertices.far[0].z / (far - camera.near);
	                const margin = 0.25 * Math.pow(linearDepth, 2.0) * (far - camera.near);
	                squaredBBWidth += margin;
	            }
	            shadowCam.left = -squaredBBWidth / 2;
	            shadowCam.right = squaredBBWidth / 2;
	            shadowCam.top = squaredBBWidth / 2;
	            shadowCam.bottom = -squaredBBWidth / 2;
	            shadowCam.near = 0;
	            shadowCam.far = squaredBBWidth + this.lightMargin;
	            shadowCam.updateProjectionMatrix();
	            light.shadow.bias = this.shadowBias * squaredBBWidth;
	            light.shadow.normalBias = this.shadowNormalBias * squaredBBWidth;
	        }
	    }
	    updateBreaks() {
	        const camera = this.camera;
	        const far = Math.min(camera.far, this.maxFar);
	        this.breaks.length = 0;
	        switch (this.mode) {
	            case 'uniform':
	                uniformSplit(this.cascades, camera.near, far, this.breaks);
	                break;
	            case 'logarithmic':
	                logarithmicSplit(this.cascades, camera.near, far, this.breaks);
	                break;
	            case 'practical':
	                practicalSplit(this.cascades, camera.near, far, this.practicalModeLambda, this.breaks);
	                break;
	            case 'custom':
	                if (this.customSplitsCallback === undefined) {
	                    throw new Error('CSM: Custom split scheme callback not defined.');
	                }
	                this.breaks.push(...this.customSplitsCallback(this.cascades, camera.near, far));
	                break;
	        }
	    }
	    update() {
	        for (let i = 0; i < this.frustums.length; i++) {
	            const light = this.lights[i];
	            const shadowCam = light.shadow.camera;
	            const texelWidth = (shadowCam.right - shadowCam.left) / this.shadowMapSize;
	            const texelHeight = (shadowCam.top - shadowCam.bottom) / this.shadowMapSize;
	            // This matrix only represents sun orientation, origin is zero
	            _lightOrientationMatrix.lookAt(_origin, this.lightDirection, this.lightDirectionUp);
	            _lightOrientationMatrixInverse.copy(_lightOrientationMatrix).invert();
	            // Go from camera space to world space using camera.matrixWorld, then go to parent space using inverse of parent.matrixWorld
	            _cameraToLightParentMatrix.copy(this.parent.matrixWorld).invert().multiply(this.camera.matrixWorld);
	            // Go from camera space to light parent space, then apply light orientation
	            _cameraToLightMatrix.multiplyMatrices(_lightOrientationMatrixInverse, _cameraToLightParentMatrix);
	            this.frustums[i].toSpace(_cameraToLightMatrix, _lightSpaceFrustum);
	            const nearVerts = _lightSpaceFrustum.vertices.near;
	            const farVerts = _lightSpaceFrustum.vertices.far;
	            _bbox.makeEmpty();
	            for (let j = 0; j < 4; j++) {
	                _bbox.expandByPoint(nearVerts[j]);
	                _bbox.expandByPoint(farVerts[j]);
	            }
	            _bbox.getCenter(_center);
	            _center.z = _bbox.max.z + this.lightMargin;
	            // Round X and Y to avoid shadow shimmering when moving or rotating the camera
	            _center.x = Math.floor(_center.x / texelWidth) * texelWidth;
	            _center.y = Math.floor(_center.y / texelHeight) * texelHeight;
	            // Center is currently in light space, so we need to go back to light parent space
	            _center.applyMatrix4(_lightOrientationMatrix);
	            // New positions are relative to this.parent
	            light.position.copy(_center);
	            light.target.position.copy(_center);
	            light.target.position.x += this.lightDirection.x;
	            light.target.position.y += this.lightDirection.y;
	            light.target.position.z += this.lightDirection.z;
	        }
	    }
	    injectInclude() {
	        three.ShaderChunk.lights_fragment_begin = CSMShader.lights_fragment_begin(this.cascades);
	        three.ShaderChunk.lights_pars_begin = CSMShader.lights_pars_begin(this.maxCascades);
	    }
	    setupMaterial(material) {
	        const fn = (shader) => {
	            const breaksVec2 = this.getExtendedBreaks();
	            const far = Math.min(this.camera.far, this.maxFar);
	            shader.uniforms.CSM_cascades = { value: breaksVec2 };
	            shader.uniforms.cameraNear = { value: Math.min(this.maxFar, this.camera.near) };
	            shader.uniforms.shadowFar = { value: far };
	            material.defines = material.defines || {};
	            material.defines.USE_CSM = 1;
	            material.defines.CSM_CASCADES = this.cascades;
	            material.defines.CSM_FADE = this.fade ? '1' : '0';
	            material.needsUpdate = true;
	            this.shaders.set(material, shader);
	            material.addEventListener('dispose', () => {
	                this.shaders.delete(material);
	            });
	        };
	        if (!material.onBeforeCompile) {
	            material.onBeforeCompile = fn;
	        }
	        else {
	            const previousFn = material.onBeforeCompile;
	            material.onBeforeCompile = (...args) => {
	                previousFn(...args);
	                fn(args[0]);
	            };
	        }
	    }
	    updateUniforms() {
	        const far = Math.min(this.camera.far, this.maxFar);
	        const breaks = this.getExtendedBreaks();
	        this.shaders.forEach((shader, material) => {
	            if (shader !== null) {
	                const uniforms = shader.uniforms;
	                uniforms.CSM_cascades.value = breaks;
	                uniforms.cameraNear.value = Math.min(this.maxFar, this.camera.near);
	                uniforms.shadowFar.value = far;
	            }
	            let definesChanged = false;
	            const fadeValue = this.fade ? '0' : '1';
	            if (material.defines.CSM_FADE !== fadeValue) {
	                material.defines.CSM_FADE = fadeValue;
	                definesChanged = true;
	            }
	            if (material.defines.CSM_CASCADES !== this.cascades) {
	                material.defines.CSM_CASCADES = this.cascades;
	                definesChanged = true;
	            }
	            if (definesChanged) {
	                material.needsUpdate = true;
	            }
	        });
	    }
	    getExtendedBreaks() {
	        const target = [];
	        for (let i = 0; i < this.maxCascades; i++) {
	            const amount = this.breaks[i] || 0;
	            const prev = this.breaks[i - 1] || 0;
	            target.push(new three.Vector2(prev, amount));
	        }
	        if (this.noLastCascadeCutOff) {
	            target[this.breaks.length - 1].y = Infinity;
	        }
	        return target;
	    }
	    updateFrustums() {
	        this.updateBreaks();
	        this.initCascades();
	        this.updateShadowBounds();
	        this.updateUniforms();
	    }
	    updateCascades(cascades) {
	        this.cascades = cascades;
	        for (const light of this.lights) {
	            this.parent.remove(light);
	            light.dispose();
	        }
	        this.lights.length = 0;
	        this.createLights();
	        this.injectInclude();
	        this.updateFrustums();
	    }
	    updateShadowMapSize(size) {
	        this.shadowMapSize = size;
	        for (let i = 0; i < this.lights.length; i++) {
	            const light = this.lights[i];
	            light.shadow.mapSize.width = size;
	            light.shadow.mapSize.height = size;
	            if (light.shadow.map) {
	                // Dispose old shadow map so that three.js automatically creates a new one using the updated
	                // mapSize dimensions. See https://stackoverflow.com/a/31858963/8886455
	                light.shadow.map.dispose();
	                light.shadow.map = null;
	            }
	        }
	    }
	    dispose() {
	        this.shaders.forEach(function (shader, material) {
	            delete material.onBeforeCompile;
	            delete material.defines.USE_CSM;
	            delete material.defines.CSM_CASCADES;
	            delete material.defines.CSM_FADE;
	            if (shader !== null) {
	                delete shader.uniforms.CSM_cascades;
	                delete shader.uniforms.cameraNear;
	                delete shader.uniforms.shadowFar;
	            }
	            material.needsUpdate = true;
	        });
	        this.shaders.clear();
	        for (let i = 0; i < this.lights.length; i++) {
	            this.lights[i].dispose();
	            this.parent.remove(this.lights[i]);
	        }
	    }
	}
	CSM.Helper = CSMHelper;

	return CSM;

}));
