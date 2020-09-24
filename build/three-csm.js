(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three')) :
	typeof define === 'function' && define.amd ? define(['three'], factory) :
	(global = global || self, (global.THREE = global.THREE || {}, global.THREE.CSM = factory(global.THREE)));
}(this, function (THREE) { 'use strict';

	var inverseProjectionMatrix = new THREE.Matrix4();
	var Frustum = /** @class */ (function () {
	    function Frustum(args) {
	        if (args === void 0) { args = {}; }
	        var _a;
	        this.vertices = {
	            near: [
	                new THREE.Vector3(),
	                new THREE.Vector3(),
	                new THREE.Vector3(),
	                new THREE.Vector3(),
	            ],
	            far: [
	                new THREE.Vector3(),
	                new THREE.Vector3(),
	                new THREE.Vector3(),
	                new THREE.Vector3(),
	            ],
	        };
	        if (args.projectionMatrix !== undefined) {
	            this.setFromProjectionMatrix(args.projectionMatrix, (_a = args.maxFar) !== null && _a !== void 0 ? _a : 10000);
	        }
	    }
	    Frustum.prototype.setFromProjectionMatrix = function (projectionMatrix, maxFar) {
	        var isOrthographic = (projectionMatrix.elements[2 * 4 + 3] === 0);
	        inverseProjectionMatrix.getInverse(projectionMatrix);
	        // 3 --- 0  vertices.near/far order
	        // |     |
	        // 2 --- 1
	        // clip space spans from [-1, 1]
	        this.vertices.near[0].set(1, 1, -1);
	        this.vertices.near[1].set(1, -1, -1);
	        this.vertices.near[2].set(-1, -1, -1);
	        this.vertices.near[3].set(-1, 1, -1);
	        this.vertices.near.forEach(function (v) { return v.applyMatrix4(inverseProjectionMatrix); });
	        this.vertices.far[0].set(1, 1, 1);
	        this.vertices.far[1].set(1, -1, 1);
	        this.vertices.far[2].set(-1, -1, 1);
	        this.vertices.far[3].set(-1, 1, 1);
	        this.vertices.far.forEach(function (v) {
	            v.applyMatrix4(inverseProjectionMatrix);
	            var absZ = Math.abs(v.z);
	            if (isOrthographic) {
	                v.z *= Math.min(maxFar / absZ, 1.0);
	            }
	            else {
	                v.multiplyScalar(Math.min(maxFar / absZ, 1.0));
	            }
	        });
	        return this.vertices;
	    };
	    Frustum.prototype.split = function (breaks, target) {
	        while (breaks.length > target.length) {
	            target.push(new Frustum());
	        }
	        target.length = breaks.length;
	        for (var i = 0; i < breaks.length; i++) {
	            var cascade = target[i];
	            if (i === 0) {
	                for (var j = 0; j < 4; j++) {
	                    cascade.vertices.near[j].copy(this.vertices.near[j]);
	                }
	            }
	            else {
	                for (var j = 0; j < 4; j++) {
	                    cascade.vertices.near[j].lerpVectors(this.vertices.near[j], this.vertices.far[j], breaks[i - 1]);
	                }
	            }
	            if (i === (breaks.length - 1)) {
	                for (var j = 0; j < 4; j++) {
	                    cascade.vertices.far[j].copy(this.vertices.far[j]);
	                }
	            }
	            else {
	                for (var j = 0; j < 4; j++) {
	                    cascade.vertices.far[j].lerpVectors(this.vertices.near[j], this.vertices.far[j], breaks[i]);
	                }
	            }
	        }
	    };
	    Frustum.prototype.toSpace = function (cameraMatrix, target) {
	        for (var i = 0; i < 4; i++) {
	            target.vertices.near[i]
	                .copy(this.vertices.near[i])
	                .applyMatrix4(cameraMatrix);
	            target.vertices.far[i]
	                .copy(this.vertices.far[i])
	                .applyMatrix4(cameraMatrix);
	        }
	    };
	    return Frustum;
	}());
	//# sourceMappingURL=Frustum.js.map

	var lights_fragment_begin = "\nGeometricContext geometry;\ngeometry.position = - vViewPosition;\ngeometry.normal = normal;\ngeometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );\n#ifdef CLEARCOAT\n\tgeometry.clearcoatNormal = clearcoatNormal;\n#endif\nIncidentLight directLight;\n#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )\n\tPointLight pointLight;\n\t#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0\n\tPointLightShadow pointLightShadow;\n\t#endif\n\t#pragma unroll_loop_start\n\tfor ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {\n\t\tpointLight = pointLights[ i ];\n\t\tgetPointDirectLightIrradiance( pointLight, geometry, directLight );\n\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )\n\t\tpointLightShadow = pointLightShadows[ i ];\n\t\tdirectLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;\n\t\t#endif\n\t\tRE_Direct( directLight, geometry, material, reflectedLight );\n\t}\n\t#pragma unroll_loop_end\n#endif\n#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )\n\tSpotLight spotLight;\n\t#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0\n\tSpotLightShadow spotLightShadow;\n\t#endif\n\t#pragma unroll_loop_start\n\tfor ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {\n\t\tspotLight = spotLights[ i ];\n\t\tgetSpotDirectLightIrradiance( spotLight, geometry, directLight );\n\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )\n\t\tspotLightShadow = spotLightShadows[ i ];\n\t\tdirectLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;\n\t\t#endif\n\t\tRE_Direct( directLight, geometry, material, reflectedLight );\n\t}\n\t#pragma unroll_loop_end\n#endif\n#if ( NUM_DIR_LIGHTS > 0) && defined( RE_Direct ) && defined( USE_CSM ) && defined( CSM_CASCADES )\n\tDirectionalLight directionalLight;\n\tfloat linearDepth = (vViewPosition.z) / (shadowFar - cameraNear);\n\t#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n\tDirectionalLightShadow directionalLightShadow;\n\t#endif\n\t#if defined( USE_SHADOWMAP ) && defined( CSM_FADE )\n\tvec2 cascade;\n\tfloat cascadeCenter;\n\tfloat closestEdge;\n\tfloat margin;\n\tfloat csmx;\n\tfloat csmy;\n\t#pragma unroll_loop_start\n\tfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\t\tdirectionalLight = directionalLights[ i ];\n\t\tgetDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n\t\t// NOTE: Depth gets larger away from the camera.\n\t\t// cascade.x is closer, cascade.y is further\n\t\tcascade = CSM_cascades[ i ];\n\t\tcascadeCenter = ( cascade.x + cascade.y ) / 2.0;\n\t\tclosestEdge = linearDepth < cascadeCenter ? cascade.x : cascade.y;\n\t\tmargin = 0.25 * pow( closestEdge, 2.0 );\n\t\tcsmx = cascade.x - margin / 2.0;\n\t\tcsmy = cascade.y + margin / 2.0;\n\t\tif( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS && linearDepth >= csmx && ( linearDepth < csmy || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 ) ) {\n\t\t\tfloat dist = min( linearDepth - csmx, csmy - linearDepth );\n\t\t\tfloat ratio = clamp( dist / margin, 0.0, 1.0 );\n\t\t\tif( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS ) {\n\t\t\t\tvec3 prevColor = directLight.color;\n\t\t\t\tdirectionalLightShadow = directionalLightShadows[ i ];\n\t\t\t\tdirectLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t\t\tbool shouldFadeLastCascade = UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth > cascadeCenter;\n\t\t\t\tdirectLight.color = mix( prevColor, directLight.color, shouldFadeLastCascade ? ratio : 1.0 );\n\t\t\t}\n\t\t\tReflectedLight prevLight = reflectedLight;\n\t\t\tRE_Direct( directLight, geometry, material, reflectedLight );\n\t\t\tbool shouldBlend = UNROLLED_LOOP_INDEX != CSM_CASCADES - 1 || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth < cascadeCenter;\n\t\t\tfloat blendRatio = shouldBlend ? ratio : 1.0;\n\t\t\treflectedLight.directDiffuse = mix( prevLight.directDiffuse, reflectedLight.directDiffuse, blendRatio );\n\t\t\treflectedLight.directSpecular = mix( prevLight.directSpecular, reflectedLight.directSpecular, blendRatio );\n\t\t\treflectedLight.indirectDiffuse = mix( prevLight.indirectDiffuse, reflectedLight.indirectDiffuse, blendRatio );\n\t\t\treflectedLight.indirectSpecular = mix( prevLight.indirectSpecular, reflectedLight.indirectSpecular, blendRatio );\n\t\t}\n\t}\n\t#pragma unroll_loop_end\n\t#else\n\t#pragma unroll_loop_start\n\tfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\t\tdirectionalLight = directionalLights[ i ];\n\t\tgetDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n\t\tdirectionalLightShadow = directionalLightShadows[ i ];\n\t\tif(linearDepth >= CSM_cascades[UNROLLED_LOOP_INDEX].x && linearDepth < CSM_cascades[UNROLLED_LOOP_INDEX].y) directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t#endif\n\t\tif(linearDepth >= CSM_cascades[UNROLLED_LOOP_INDEX].x && (linearDepth < CSM_cascades[UNROLLED_LOOP_INDEX].y || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1)) RE_Direct( directLight, geometry, material, reflectedLight );\n\t}\n\t#pragma unroll_loop_end\n\t#endif\n#endif\n#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct ) && !defined( USE_CSM ) && !defined( CSM_CASCADES )\n\tDirectionalLight directionalLight;\n\t#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0\n\tDirectionalLightShadow directionalLightShadow;\n\t#endif\n\t#pragma unroll_loop_start\n\tfor ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {\n\t\tdirectionalLight = directionalLights[ i ];\n\t\tgetDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );\n\t\t#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )\n\t\tdirectionalLightShadow = directionalLightShadows[ i ];\n\t\tdirectLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;\n\t\t#endif\n\t\tRE_Direct( directLight, geometry, material, reflectedLight );\n\t}\n\t#pragma unroll_loop_end\n#endif\n#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )\n\tRectAreaLight rectAreaLight;\n\t#pragma unroll_loop_start\n\tfor ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {\n\t\trectAreaLight = rectAreaLights[ i ];\n\t\tRE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );\n\t}\n\t#pragma unroll_loop_end\n#endif\n#if defined( RE_IndirectDiffuse )\n\tvec3 iblIrradiance = vec3( 0.0 );\n\tvec3 irradiance = getAmbientLightIrradiance( ambientLightColor );\n\tirradiance += getLightProbeIrradiance( lightProbe, geometry );\n\t#if ( NUM_HEMI_LIGHTS > 0 )\n\t\t#pragma unroll_loop_start\n\t\tfor ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {\n\t\t\tirradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );\n\t\t}\n\t\t#pragma unroll_loop_end\n\t#endif\n#endif\n#if defined( RE_IndirectSpecular )\n\tvec3 radiance = vec3( 0.0 );\n\tvec3 clearcoatRadiance = vec3( 0.0 );\n#endif\n";
	var lights_pars_begin = "\n#if defined( USE_CSM ) && defined( CSM_CASCADES )\nuniform vec2 CSM_cascades[CSM_CASCADES];\nuniform float cameraNear;\nuniform float shadowFar;\n#endif\n" + THREE.ShaderChunk.lights_pars_begin + "\n";
	//# sourceMappingURL=Shader.js.map

	/*! *****************************************************************************
	Copyright (c) Microsoft Corporation.

	Permission to use, copy, modify, and/or distribute this software for any
	purpose with or without fee is hereby granted.

	THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
	REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
	AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
	INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
	LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
	OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
	PERFORMANCE OF THIS SOFTWARE.
	***************************************************************************** */
	/* global Reflect, Promise */

	var extendStatics = function(d, b) {
	    extendStatics = Object.setPrototypeOf ||
	        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
	        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
	    return extendStatics(d, b);
	};

	function __extends(d, b) {
	    extendStatics(d, b);
	    function __() { this.constructor = d; }
	    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
	}

	var CSMHelper = /** @class */ (function (_super) {
	    __extends(CSMHelper, _super);
	    function CSMHelper(csm) {
	        var _this = _super.call(this) || this;
	        _this.csm = csm;
	        _this.displayFrustum = true;
	        _this.displayPlanes = true;
	        _this.displayShadowBounds = true;
	        _this.cascadeLines = [];
	        _this.cascadePlanes = [];
	        _this.shadowLines = [];
	        var indices = new Uint16Array([0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7]);
	        var positions = new Float32Array(24);
	        var frustumGeometry = new THREE.BufferGeometry();
	        frustumGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
	        frustumGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3, false));
	        var frustumLines = new THREE.LineSegments(frustumGeometry, new THREE.LineBasicMaterial());
	        _this.add(frustumLines);
	        _this.frustumLines = frustumLines;
	        return _this;
	    }
	    CSMHelper.prototype.updateVisibility = function () {
	        var displayFrustum = this.displayFrustum;
	        var displayPlanes = this.displayPlanes;
	        var displayShadowBounds = this.displayShadowBounds;
	        var frustumLines = this.frustumLines;
	        var cascadeLines = this.cascadeLines;
	        var cascadePlanes = this.cascadePlanes;
	        var shadowLines = this.shadowLines;
	        var l = cascadeLines.length;
	        for (var i = 0; i < l; i++) {
	            var cascadeLine = cascadeLines[i];
	            var cascadePlane = cascadePlanes[i];
	            var shadowLineGroup = shadowLines[i];
	            cascadeLine.visible = displayFrustum;
	            cascadePlane.visible = (displayFrustum && displayPlanes);
	            shadowLineGroup.visible = displayShadowBounds;
	        }
	        frustumLines.visible = displayFrustum;
	    };
	    CSMHelper.prototype.update = function () {
	        var csm = this.csm;
	        var camera = csm.camera;
	        var cascades = csm.cascades;
	        var mainFrustum = csm.mainFrustum;
	        var frustums = csm.frustums;
	        var lights = csm.lights;
	        var frustumLines = this.frustumLines;
	        var frustumLinePositions = frustumLines.geometry.getAttribute('position');
	        var cascadeLines = this.cascadeLines;
	        var cascadePlanes = this.cascadePlanes;
	        var shadowLines = this.shadowLines;
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
	            var cascadeLine = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(0xffffff));
	            var planeMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
	            var cascadePlane = new THREE.Mesh(new THREE.PlaneBufferGeometry(), planeMat);
	            var shadowLineGroup = new THREE.Group();
	            var shadowLine = new THREE.Box3Helper(new THREE.Box3(), new THREE.Color(0xffff00));
	            shadowLineGroup.add(shadowLine);
	            this.add(cascadeLine);
	            this.add(cascadePlane);
	            this.add(shadowLineGroup);
	            cascadeLines.push(cascadeLine);
	            cascadePlanes.push(cascadePlane);
	            shadowLines.push(shadowLineGroup);
	        }
	        for (var i = 0; i < cascades; i++) {
	            var frustum = frustums[i];
	            var light = lights[i];
	            var shadowCam = light.shadow.camera;
	            var farVertices_1 = frustum.vertices.far;
	            var cascadeLine = cascadeLines[i];
	            var cascadePlane = cascadePlanes[i];
	            var shadowLineGroup = shadowLines[i];
	            var shadowLine = shadowLineGroup.children[0];
	            cascadeLine.box.min.copy(farVertices_1[2]);
	            cascadeLine.box.max.copy(farVertices_1[0]);
	            cascadeLine.box.max.z += 1e-4;
	            cascadePlane.position.addVectors(farVertices_1[0], farVertices_1[2]);
	            cascadePlane.position.multiplyScalar(0.5);
	            cascadePlane.scale.subVectors(farVertices_1[0], farVertices_1[2]);
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
	        var nearVertices = mainFrustum.vertices.near;
	        var farVertices = mainFrustum.vertices.far;
	        frustumLinePositions.setXYZ(0, farVertices[0].x, farVertices[0].y, farVertices[0].z);
	        frustumLinePositions.setXYZ(1, farVertices[3].x, farVertices[3].y, farVertices[3].z);
	        frustumLinePositions.setXYZ(2, farVertices[2].x, farVertices[2].y, farVertices[2].z);
	        frustumLinePositions.setXYZ(3, farVertices[1].x, farVertices[1].y, farVertices[1].z);
	        frustumLinePositions.setXYZ(4, nearVertices[0].x, nearVertices[0].y, nearVertices[0].z);
	        frustumLinePositions.setXYZ(5, nearVertices[3].x, nearVertices[3].y, nearVertices[3].z);
	        frustumLinePositions.setXYZ(6, nearVertices[2].x, nearVertices[2].y, nearVertices[2].z);
	        frustumLinePositions.setXYZ(7, nearVertices[1].x, nearVertices[1].y, nearVertices[1].z);
	        frustumLinePositions.needsUpdate = true;
	    };
	    return CSMHelper;
	}(THREE.Object3D));
	//# sourceMappingURL=CSMHelper.js.map

	var _cameraToLightMatrix = new THREE.Matrix4();
	var _lightSpaceFrustum = new Frustum();
	var _center = new THREE.Vector3();
	var _bbox = new THREE.Box3();
	var _uniformArray = [];
	var _logArray = [];
	var CSM = /** @class */ (function () {
	    function CSM(camera, parent, args) {
	        if (args === void 0) { args = {}; }
	        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
	        this.camera = camera;
	        this.parent = parent;
	        this.fade = false;
	        this.mainFrustum = new Frustum();
	        this.frustums = [];
	        this.breaks = [];
	        this.lights = [];
	        this.shaders = new Map();
	        this.cascades = (_a = args.cascades) !== null && _a !== void 0 ? _a : 3;
	        this.maxFar = (_b = args.maxFar) !== null && _b !== void 0 ? _b : 100000;
	        this.mode = (_c = args.mode) !== null && _c !== void 0 ? _c : 'practical';
	        this.shadowMapSize = (_d = args.shadowMapSize) !== null && _d !== void 0 ? _d : 2048;
	        this.shadowBias = (_e = args.shadowBias) !== null && _e !== void 0 ? _e : 0.000001;
	        this.lightDirection = (_f = args.lightDirection) !== null && _f !== void 0 ? _f : new THREE.Vector3(1, -1, 1).normalize();
	        this.lightIntensity = (_g = args.lightIntensity) !== null && _g !== void 0 ? _g : 1;
	        this.lightNear = (_h = args.lightNear) !== null && _h !== void 0 ? _h : 1;
	        this.lightFar = (_j = args.lightFar) !== null && _j !== void 0 ? _j : 2000;
	        this.lightMargin = (_k = args.lightMargin) !== null && _k !== void 0 ? _k : 200;
	        this.customSplitsCallback = args.customSplitsCallback;
	        this.createLights();
	        this.updateFrustums();
	        this.injectInclude();
	    }
	    CSM.prototype.createLights = function () {
	        for (var i = 0; i < this.cascades; i++) {
	            var light = new THREE.DirectionalLight(0xffffff, this.lightIntensity);
	            light.castShadow = true;
	            light.shadow.mapSize.width = this.shadowMapSize;
	            light.shadow.mapSize.height = this.shadowMapSize;
	            light.shadow.camera.near = this.lightNear;
	            light.shadow.camera.far = this.lightFar;
	            light.shadow.bias = this.shadowBias;
	            this.parent.add(light);
	            this.parent.add(light.target);
	            this.lights.push(light);
	        }
	    };
	    CSM.prototype.initCascades = function () {
	        var camera = this.camera;
	        camera.updateProjectionMatrix();
	        this.mainFrustum.setFromProjectionMatrix(camera.projectionMatrix, this.maxFar);
	        this.mainFrustum.split(this.breaks, this.frustums);
	    };
	    CSM.prototype.updateShadowBounds = function () {
	        var frustums = this.frustums;
	        for (var i = 0; i < frustums.length; i++) {
	            var light = this.lights[i];
	            var shadowCam = light.shadow.camera;
	            var frustum = this.frustums[i];
	            // Get the two points that represent that furthest points on the frustum assuming
	            // that's either the diagonal across the far plane or the diagonal across the whole
	            // frustum itself.
	            var nearVertices = frustum.vertices.near;
	            var farVertices = frustum.vertices.far;
	            var point1 = farVertices[0];
	            var point2 = void 0;
	            if (point1.distanceTo(farVertices[2]) > point1.distanceTo(nearVertices[2])) {
	                point2 = farVertices[2];
	            }
	            else {
	                point2 = nearVertices[2];
	            }
	            var squaredBBWidth = point1.distanceTo(point2);
	            if (this.fade) {
	                // expand the shadow extents by the fade margin if fade is enabled.
	                var camera = this.camera;
	                var far = Math.max(camera.far, this.maxFar);
	                var linearDepth = frustum.vertices.far[0].z / (far - camera.near);
	                var margin = 0.25 * Math.pow(linearDepth, 2.0) * (far - camera.near);
	                squaredBBWidth += margin;
	            }
	            shadowCam.left = -squaredBBWidth / 2;
	            shadowCam.right = squaredBBWidth / 2;
	            shadowCam.top = squaredBBWidth / 2;
	            shadowCam.bottom = -squaredBBWidth / 2;
	            shadowCam.updateProjectionMatrix();
	        }
	    };
	    CSM.prototype.getBreaks = function () {
	        var camera = this.camera;
	        var far = Math.min(camera.far, this.maxFar);
	        this.breaks.length = 0;
	        switch (this.mode) {
	            case 'uniform':
	                uniformSplit(this.cascades, camera.near, far, this.breaks);
	                break;
	            case 'logarithmic':
	                logarithmicSplit(this.cascades, camera.near, far, this.breaks);
	                break;
	            case 'practical':
	                practicalSplit(this.cascades, camera.near, far, 0.5, this.breaks);
	                break;
	            case 'custom':
	                if (this.customSplitsCallback === undefined)
	                    console.error('CSM: Custom split scheme callback not defined.');
	                this.customSplitsCallback(this.cascades, camera.near, far, this.breaks);
	                break;
	        }
	    };
	    CSM.prototype.update = function () {
	        var camera = this.camera;
	        var frustums = this.frustums;
	        for (var i = 0; i < frustums.length; i++) {
	            var light = this.lights[i];
	            var shadowCam = light.shadow.camera;
	            var texelWidth = (shadowCam.right - shadowCam.left) / this.shadowMapSize;
	            var texelHeight = (shadowCam.top - shadowCam.bottom) / this.shadowMapSize;
	            light.shadow.camera.updateMatrixWorld(true);
	            _cameraToLightMatrix.multiplyMatrices(light.shadow.camera.matrixWorldInverse, camera.matrixWorld);
	            frustums[i].toSpace(_cameraToLightMatrix, _lightSpaceFrustum);
	            var nearVertices = _lightSpaceFrustum.vertices.near;
	            var farVertices = _lightSpaceFrustum.vertices.far;
	            _bbox.makeEmpty();
	            for (var j = 0; j < 4; j++) {
	                _bbox.expandByPoint(nearVertices[j]);
	                _bbox.expandByPoint(farVertices[j]);
	            }
	            _bbox.getCenter(_center);
	            _center.z = _bbox.max.z + this.lightMargin;
	            _center.x = Math.floor(_center.x / texelWidth) * texelWidth;
	            _center.y = Math.floor(_center.y / texelHeight) * texelHeight;
	            _center.applyMatrix4(light.shadow.camera.matrixWorld);
	            light.position.copy(_center);
	            light.target.position.copy(_center);
	            light.target.position.x += this.lightDirection.x;
	            light.target.position.y += this.lightDirection.y;
	            light.target.position.z += this.lightDirection.z;
	        }
	    };
	    CSM.prototype.injectInclude = function () {
	        THREE.ShaderChunk.lights_fragment_begin = lights_fragment_begin;
	        THREE.ShaderChunk.lights_pars_begin = lights_pars_begin;
	    };
	    CSM.prototype.setupMaterial = function (material) {
	        var _a;
	        material.defines = (_a = material.defines) !== null && _a !== void 0 ? _a : {};
	        material.defines.USE_CSM = 1;
	        material.defines.CSM_CASCADES = this.cascades;
	        if (this.fade) {
	            material.defines.CSM_FADE = '';
	        }
	        var breaksVec2 = [];
	        var self = this;
	        var shaders = this.shaders;
	        material.onBeforeCompile = function (shader) {
	            var far = Math.min(self.camera.far, self.maxFar);
	            self.getExtendedBreaks(breaksVec2);
	            shader.uniforms.CSM_cascades = { value: breaksVec2 };
	            shader.uniforms.cameraNear = { value: self.camera.near };
	            shader.uniforms.shadowFar = { value: far };
	            shaders.set(material, shader);
	        };
	        shaders.set(material, null);
	    };
	    CSM.prototype.updateUniforms = function () {
	        var _this = this;
	        var far = Math.min(this.camera.far, this.maxFar);
	        var shaders = this.shaders;
	        shaders.forEach(function (shader, material) {
	            if (shader !== null) {
	                var uniforms = shader.uniforms;
	                _this.getExtendedBreaks(uniforms.CSM_cascades.value);
	                uniforms.cameraNear.value = _this.camera.near;
	                uniforms.shadowFar.value = far;
	            }
	            if (!_this.fade && 'CSM_FADE' in material.defines) {
	                delete material.defines.CSM_FADE;
	                material.needsUpdate = true;
	            }
	            else if (_this.fade && !('CSM_FADE' in material.defines)) {
	                material.defines.CSM_FADE = '';
	                material.needsUpdate = true;
	            }
	        });
	    };
	    CSM.prototype.getExtendedBreaks = function (target) {
	        var _a;
	        while (target.length < this.breaks.length) {
	            target.push(new THREE.Vector2());
	        }
	        target.length = this.breaks.length;
	        for (var i = 0; i < this.cascades; i++) {
	            var amount = this.breaks[i];
	            var prev = (_a = this.breaks[i - 1]) !== null && _a !== void 0 ? _a : 0;
	            target[i].x = prev;
	            target[i].y = amount;
	        }
	    };
	    CSM.prototype.updateFrustums = function () {
	        this.getBreaks();
	        this.initCascades();
	        this.updateShadowBounds();
	        this.updateUniforms();
	    };
	    CSM.prototype.remove = function () {
	        for (var i = 0; i < this.lights.length; i++) {
	            this.parent.remove(this.lights[i]);
	        }
	    };
	    CSM.prototype.dispose = function () {
	        this.shaders.forEach(function (shader, material) {
	            delete material.onBeforeCompile;
	            delete material.defines.USE_CSM;
	            delete material.defines.CSM_CASCADES;
	            delete material.defines.CSM_FADE;
	            delete shader.uniforms.CSM_cascades;
	            delete shader.uniforms.cameraNear;
	            delete shader.uniforms.shadowFar;
	            material.needsUpdate = true;
	        });
	        this.shaders.clear();
	    };
	    CSM.Helper = CSMHelper;
	    return CSM;
	}());
	function uniformSplit(amount, near, far, target) {
	    for (var i = 1; i < amount; i++) {
	        target.push((near + (far - near) * i / amount) / far);
	    }
	    target.push(1);
	}
	function logarithmicSplit(amount, near, far, target) {
	    for (var i = 1; i < amount; i++) {
	        target.push((near * Math.pow((far / near), (i / amount))) / far);
	    }
	    target.push(1);
	}
	function practicalSplit(amount, near, far, lambda, target) {
	    _uniformArray.length = 0;
	    _logArray.length = 0;
	    logarithmicSplit(amount, near, far, _logArray);
	    uniformSplit(amount, near, far, _uniformArray);
	    for (var i = 1; i < amount; i++) {
	        target.push(THREE.MathUtils.lerp(_uniformArray[i - 1], _logArray[i - 1], lambda));
	    }
	    target.push(1);
	}

	return CSM;

}));
