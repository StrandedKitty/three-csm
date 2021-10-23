(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three')) :
	typeof define === 'function' && define.amd ? define(['three'], factory) :
	(global = global || self, (global.THREE = global.THREE || {}, global.THREE.CSM = factory(global.THREE)));
}(this, function (three) { 'use strict';

	const inverseProjectionMatrix = new three.Matrix4();

	class Frustum {

		constructor( data ) {

			data = data || {};

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

			if ( data.projectionMatrix !== undefined ) {

				this.setFromProjectionMatrix( data.projectionMatrix, data.maxFar || 10000 );

			}

		}

		setFromProjectionMatrix( projectionMatrix, maxFar ) {

			const isOrthographic = projectionMatrix.elements[ 2 * 4 + 3 ] === 0;


			inverseProjectionMatrix.copy(projectionMatrix).invert();


			// 3 --- 0  vertices.near/far order
			// |     |
			// 2 --- 1
			// clip space spans from [-1, 1]

			this.vertices.near[ 0 ].set( 1, 1, - 1 );
			this.vertices.near[ 1 ].set( 1, - 1, - 1 );
			this.vertices.near[ 2 ].set( - 1, - 1, - 1 );
			this.vertices.near[ 3 ].set( - 1, 1, - 1 );
			this.vertices.near.forEach( function ( v ) {

				v.applyMatrix4( inverseProjectionMatrix );

			} );

			this.vertices.far[ 0 ].set( 1, 1, 1 );
			this.vertices.far[ 1 ].set( 1, - 1, 1 );
			this.vertices.far[ 2 ].set( - 1, - 1, 1 );
			this.vertices.far[ 3 ].set( - 1, 1, 1 );
			this.vertices.far.forEach( function ( v ) {

				v.applyMatrix4( inverseProjectionMatrix );

				const absZ = Math.abs( v.z );
				if ( isOrthographic ) {

					v.z *= Math.min( maxFar / absZ, 1.0 );

				} else {

					v.multiplyScalar( Math.min( maxFar / absZ, 1.0 ) );

				}

			} );

			return this.vertices;

		}

		split( breaks, target ) {

			while ( breaks.length > target.length ) {

				target.push( new Frustum() );

			}
			target.length = breaks.length;

			for ( let i = 0; i < breaks.length; i ++ ) {

				const cascade = target[ i ];

				if ( i === 0 ) {

					for ( let j = 0; j < 4; j ++ ) {

						cascade.vertices.near[ j ].copy( this.vertices.near[ j ] );

					}

				} else {

					for ( let j = 0; j < 4; j ++ ) {

						cascade.vertices.near[ j ].lerpVectors( this.vertices.near[ j ], this.vertices.far[ j ], breaks[ i - 1 ] );

					}

				}

				if ( i === breaks.length - 1 ) {

					for ( let j = 0; j < 4; j ++ ) {

						cascade.vertices.far[ j ].copy( this.vertices.far[ j ] );

					}

				} else {

					for ( let j = 0; j < 4; j ++ ) {

						cascade.vertices.far[ j ].lerpVectors( this.vertices.near[ j ], this.vertices.far[ j ], breaks[ i ] );

					}

				}

			}

		}

		toSpace( cameraMatrix, target ) {

			for ( var i = 0; i < 4; i ++ ) {

				target.vertices.near[ i ]
				.copy( this.vertices.near[ i ] )
				.applyMatrix4( cameraMatrix );

				target.vertices.far[ i ]
				.copy( this.vertices.far[ i ] )
				.applyMatrix4( cameraMatrix );

			}

		}

	}

	var Shader = {
		lights_fragment_begin: /* glsl */`
GeometricContext geometry;
geometry.position = - vViewPosition;
geometry.normal = normal;
geometry.viewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
#ifdef CLEARCOAT
	geometry.clearcoatNormal = clearcoatNormal;
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
		getPointDirectLightIrradiance( pointLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometry, material, reflectedLight );
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
		getSpotDirectLightIrradiance( spotLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0) && defined( RE_Direct ) && defined( USE_CSM ) && defined( CSM_CASCADES )
	DirectionalLight directionalLight;
	float linearDepth = (vViewPosition.z) / (shadowFar - cameraNear);
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#if defined( USE_SHADOWMAP ) && defined( CSM_FADE )
	vec2 cascade;
	float cascadeCenter;
	float closestEdge;
	float margin;
	float csmx;
	float csmy;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );
		// NOTE: Depth gets larger away from the camera.
		// cascade.x is closer, cascade.y is further
		cascade = CSM_cascades[ i ];
		cascadeCenter = ( cascade.x + cascade.y ) / 2.0;
		closestEdge = linearDepth < cascadeCenter ? cascade.x : cascade.y;
		margin = 0.25 * pow( closestEdge, 2.0 );
		csmx = cascade.x - margin / 2.0;
		csmy = cascade.y + margin / 2.0;
		if( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS && linearDepth >= csmx && ( linearDepth < csmy || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 ) ) {
			float dist = min( linearDepth - csmx, csmy - linearDepth );
			float ratio = clamp( dist / margin, 0.0, 1.0 );
			if( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS ) {
				vec3 prevColor = directLight.color;
				directionalLightShadow = directionalLightShadows[ i ];
				directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
				bool shouldFadeLastCascade = UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth > cascadeCenter;
				directLight.color = mix( prevColor, directLight.color, shouldFadeLastCascade ? ratio : 1.0 );
			}
			ReflectedLight prevLight = reflectedLight;
			RE_Direct( directLight, geometry, material, reflectedLight );
			bool shouldBlend = UNROLLED_LOOP_INDEX != CSM_CASCADES - 1 || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1 && linearDepth < cascadeCenter;
			float blendRatio = shouldBlend ? ratio : 1.0;
			reflectedLight.directDiffuse = mix( prevLight.directDiffuse, reflectedLight.directDiffuse, blendRatio );
			reflectedLight.directSpecular = mix( prevLight.directSpecular, reflectedLight.directSpecular, blendRatio );
			reflectedLight.indirectDiffuse = mix( prevLight.indirectDiffuse, reflectedLight.indirectDiffuse, blendRatio );
			reflectedLight.indirectSpecular = mix( prevLight.indirectSpecular, reflectedLight.indirectSpecular, blendRatio );
		}
	}
	#pragma unroll_loop_end
	#else
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		if(linearDepth >= CSM_cascades[UNROLLED_LOOP_INDEX].x && linearDepth < CSM_cascades[UNROLLED_LOOP_INDEX].y) directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		if(linearDepth >= CSM_cascades[UNROLLED_LOOP_INDEX].x && (linearDepth < CSM_cascades[UNROLLED_LOOP_INDEX].y || UNROLLED_LOOP_INDEX == CSM_CASCADES - 1)) RE_Direct( directLight, geometry, material, reflectedLight );
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
		getDirectionalDirectLightIrradiance( directionalLight, geometry, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= all( bvec2( directLight.visible, receiveShadow ) ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometry, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	irradiance += getLightProbeIrradiance( lightProbe, geometry );
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometry );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif
`,
		lights_pars_begin: /* glsl */`
#if defined( USE_CSM ) && defined( CSM_CASCADES )
uniform vec2 CSM_cascades[CSM_CASCADES];
uniform float cameraNear;
uniform float shadowFar;
#endif
	` + three.ShaderChunk.lights_pars_begin
	};

	class CSMHelper extends three.Group {

		constructor( csm ) {

			super();
			this.csm = csm;
			this.displayFrustum = true;
			this.displayPlanes = true;
			this.displayShadowBounds = true;

			const indices = new Uint16Array( [ 0, 1, 1, 2, 2, 3, 3, 0, 4, 5, 5, 6, 6, 7, 7, 4, 0, 4, 1, 5, 2, 6, 3, 7 ] );
			const positions = new Float32Array( 24 );
			const frustumGeometry = new three.BufferGeometry();
			frustumGeometry.setIndex( new three.BufferAttribute( indices, 1 ) );
			frustumGeometry.setAttribute( 'position', new three.BufferAttribute( positions, 3, false ) );
			const frustumLines = new three.LineSegments( frustumGeometry, new three.LineBasicMaterial() );
			this.add( frustumLines );

			this.frustumLines = frustumLines;
			this.cascadeLines = [];
			this.cascadePlanes = [];
			this.shadowLines = [];

		}

		updateVisibility() {

			const displayFrustum = this.displayFrustum;
			const displayPlanes = this.displayPlanes;
			const displayShadowBounds = this.displayShadowBounds;

			const frustumLines = this.frustumLines;
			const cascadeLines = this.cascadeLines;
			const cascadePlanes = this.cascadePlanes;
			const shadowLines = this.shadowLines;
			for ( let i = 0, l = cascadeLines.length; i < l; i ++ ) {

				const cascadeLine = cascadeLines[ i ];
				const cascadePlane = cascadePlanes[ i ];
				const shadowLineGroup = shadowLines[ i ];

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
			const frustumLinePositions = frustumLines.geometry.getAttribute( 'position' );
			const cascadeLines = this.cascadeLines;
			const cascadePlanes = this.cascadePlanes;
			const shadowLines = this.shadowLines;

			this.position.copy( camera.position );
			this.quaternion.copy( camera.quaternion );
			this.scale.copy( camera.scale );
			this.updateMatrixWorld( true );

			while( cascadeLines.length > cascades ) {

				this.remove( cascadeLines.pop() );
				this.remove( cascadePlanes.pop() );
				this.remove( shadowLines.pop() );

			}

			while( cascadeLines.length < cascades ) {

				const cascadeLine = new three.Box3Helper( new three.Box3(), 0xffffff );
				const planeMat = new three.MeshBasicMaterial( { transparent: true, opacity: 0.1, depthWrite: false, side: three.DoubleSide } );
				const cascadePlane = new three.Mesh( new three.PlaneBufferGeometry(), planeMat );
				const shadowLineGroup = new three.Group();
				const shadowLine = new three.Box3Helper( new three.Box3(), 0xffff00 );
				shadowLineGroup.add( shadowLine );

				this.add( cascadeLine );
				this.add( cascadePlane );
				this.add( shadowLineGroup );

				cascadeLines.push( cascadeLine );
				cascadePlanes.push( cascadePlane );
				shadowLines.push( shadowLineGroup );

			}

			for ( let i = 0; i < cascades; i ++ ) {

				const frustum = frustums[ i ];
				const light = lights[ i ];
				const shadowCam = light.shadow.camera;
				const farVerts = frustum.vertices.far;

				const cascadeLine = cascadeLines[ i ];
				const cascadePlane = cascadePlanes[ i ];
				const shadowLineGroup = shadowLines[ i ];
				const shadowLine = shadowLineGroup.children[ 0 ];

				cascadeLine.box.min.copy( farVerts[ 2 ] );
				cascadeLine.box.max.copy( farVerts[ 0 ] );
				cascadeLine.box.max.z += 1e-4;

				cascadePlane.position.addVectors( farVerts[ 0 ], farVerts[ 2 ] );
				cascadePlane.position.multiplyScalar( 0.5 );
				cascadePlane.scale.subVectors( farVerts[ 0 ], farVerts[ 2 ] );
				cascadePlane.scale.z = 1e-4;

				this.remove( shadowLineGroup );
				shadowLineGroup.position.copy( shadowCam.position );
				shadowLineGroup.quaternion.copy( shadowCam.quaternion );
				shadowLineGroup.scale.copy( shadowCam.scale );
				shadowLineGroup.updateMatrixWorld( true );
				this.attach( shadowLineGroup );

				shadowLine.box.min.set( shadowCam.bottom, shadowCam.left, - shadowCam.far );
				shadowLine.box.max.set( shadowCam.top, shadowCam.right, - shadowCam.near );

			}

			const nearVerts = mainFrustum.vertices.near;
			const farVerts = mainFrustum.vertices.far;
			frustumLinePositions.setXYZ( 0, farVerts[ 0 ].x, farVerts[ 0 ].y, farVerts[ 0 ].z );
			frustumLinePositions.setXYZ( 1, farVerts[ 3 ].x, farVerts[ 3 ].y, farVerts[ 3 ].z );
			frustumLinePositions.setXYZ( 2, farVerts[ 2 ].x, farVerts[ 2 ].y, farVerts[ 2 ].z );
			frustumLinePositions.setXYZ( 3, farVerts[ 1 ].x, farVerts[ 1 ].y, farVerts[ 1 ].z );

			frustumLinePositions.setXYZ( 4, nearVerts[ 0 ].x, nearVerts[ 0 ].y, nearVerts[ 0 ].z );
			frustumLinePositions.setXYZ( 5, nearVerts[ 3 ].x, nearVerts[ 3 ].y, nearVerts[ 3 ].z );
			frustumLinePositions.setXYZ( 6, nearVerts[ 2 ].x, nearVerts[ 2 ].y, nearVerts[ 2 ].z );
			frustumLinePositions.setXYZ( 7, nearVerts[ 1 ].x, nearVerts[ 1 ].y, nearVerts[ 1 ].z );
			frustumLinePositions.needsUpdate = true;

		}

	}

	const _cameraToLightMatrix = new three.Matrix4();
	const _lightSpaceFrustum = new Frustum();
	const _center = new three.Vector3();
	const _bbox = new three.Box3();
	const _uniformArray = [];
	const _logArray = [];

	class CSM {

		constructor( data ) {

			data = data || {};

			this.camera = data.camera;
			this.parent = data.parent;
			this.cascades = data.cascades || 3;
			this.maxFar = data.maxFar || 100000;
			this.mode = data.mode || 'practical';
			this.shadowMapSize = data.shadowMapSize || 2048;
			this.shadowBias = data.shadowBias || 0.000001;
			this.lightDirection = data.lightDirection || new three.Vector3( 1, - 1, 1 ).normalize();
			this.lightIntensity = data.lightIntensity || 1;
			this.lightNear = data.lightNear || 1;
			this.lightFar = data.lightFar || 2000;
			this.lightMargin = data.lightMargin || 200;
			this.customSplitsCallback = data.customSplitsCallback;
			this.fade = false;
			this.mainFrustum = new Frustum();
			this.frustums = [];
			this.breaks = [];

			this.lights = [];
			this.shaders = new Map();

			this.createLights();
			this.updateFrustums();
			this.injectInclude();

		}

		createLights() {

			for ( let i = 0; i < this.cascades; i ++ ) {

				const light = new three.DirectionalLight( 0xffffff, this.lightIntensity );
				light.castShadow = true;
				light.shadow.mapSize.width = this.shadowMapSize;
				light.shadow.mapSize.height = this.shadowMapSize;

				light.shadow.camera.near = this.lightNear;
				light.shadow.camera.far = this.lightFar;
				light.shadow.bias = this.shadowBias;

				this.parent.add( light );
				this.parent.add( light.target );
				this.lights.push( light );

			}

		}

		initCascades() {

			const camera = this.camera;
			camera.updateProjectionMatrix();
			this.mainFrustum.setFromProjectionMatrix( camera.projectionMatrix, this.maxFar );
			this.mainFrustum.split( this.breaks, this.frustums );

		}

		updateShadowBounds() {

			const frustums = this.frustums;
			for ( let i = 0; i < frustums.length; i ++ ) {

				const light = this.lights[ i ];
				const shadowCam = light.shadow.camera;
				const frustum = this.frustums[ i ];

				// Get the two points that represent that furthest points on the frustum assuming
				// that's either the diagonal across the far plane or the diagonal across the whole
				// frustum itself.
				const nearVerts = frustum.vertices.near;
				const farVerts = frustum.vertices.far;
				const point1 = farVerts[ 0 ];
				let point2;
				if ( point1.distanceTo( farVerts[ 2 ] ) > point1.distanceTo( nearVerts[ 2 ] ) ) {

					point2 = farVerts[ 2 ];

				} else {

					point2 = nearVerts[ 2 ];

				}

				let squaredBBWidth = point1.distanceTo( point2 );
				if ( this.fade ) {

					// expand the shadow extents by the fade margin if fade is enabled.
					const camera = this.camera;
					const far = Math.max( camera.far, this.maxFar );
					const linearDepth = frustum.vertices.far[ 0 ].z / ( far - camera.near );
					const margin = 0.25 * Math.pow( linearDepth, 2.0 ) * ( far - camera.near );

					squaredBBWidth += margin;

				}

				shadowCam.left = - squaredBBWidth / 2;
				shadowCam.right = squaredBBWidth / 2;
				shadowCam.top = squaredBBWidth / 2;
				shadowCam.bottom = - squaredBBWidth / 2;
				shadowCam.updateProjectionMatrix();

			}

		}

		getBreaks() {

			const camera = this.camera;
			const far = Math.min( camera.far, this.maxFar );
			this.breaks.length = 0;

			switch ( this.mode ) {

				case 'uniform':
					uniformSplit( this.cascades, camera.near, far, this.breaks );
					break;
				case 'logarithmic':
					logarithmicSplit( this.cascades, camera.near, far, this.breaks );
					break;
				case 'practical':
					practicalSplit( this.cascades, camera.near, far, 0.5, this.breaks );
					break;
				case 'custom':
					if ( this.customSplitsCallback === undefined ) console.error( 'CSM: Custom split scheme callback not defined.' );
					this.customSplitsCallback( this.cascades, camera.near, far, this.breaks );
					break;

			}

			function uniformSplit( amount, near, far, target ) {

				for ( let i = 1; i < amount; i ++ ) {

					target.push( ( near + ( far - near ) * i / amount ) / far );

				}

				target.push( 1 );

			}

			function logarithmicSplit( amount, near, far, target ) {

				for ( let i = 1; i < amount; i ++ ) {

					target.push( ( near * ( far / near ) ** ( i / amount ) ) / far );

				}

				target.push( 1 );

			}

			function practicalSplit( amount, near, far, lambda, target ) {

				_uniformArray.length = 0;
				_logArray.length = 0;
				logarithmicSplit( amount, near, far, _logArray );
				uniformSplit( amount, near, far, _uniformArray );

				for ( let i = 1; i < amount; i ++ ) {

					target.push( three.MathUtils.lerp( _uniformArray[ i - 1 ], _logArray[ i - 1 ], lambda ) );

				}

				target.push( 1 );

			}

		}

		update() {

			const camera = this.camera;
			const frustums = this.frustums;
			for ( let i = 0; i < frustums.length; i ++ ) {

				const light = this.lights[ i ];
				const shadowCam = light.shadow.camera;
				const texelWidth = ( shadowCam.right - shadowCam.left ) / this.shadowMapSize;
				const texelHeight = ( shadowCam.top - shadowCam.bottom ) / this.shadowMapSize;
				light.shadow.camera.updateMatrixWorld( true );
				_cameraToLightMatrix.multiplyMatrices( light.shadow.camera.matrixWorldInverse, camera.matrixWorld );
				frustums[ i ].toSpace( _cameraToLightMatrix, _lightSpaceFrustum );

				const nearVerts = _lightSpaceFrustum.vertices.near;
				const farVerts = _lightSpaceFrustum.vertices.far;
				_bbox.makeEmpty();
				for ( let j = 0; j < 4; j ++ ) {

					_bbox.expandByPoint( nearVerts[ j ] );
					_bbox.expandByPoint( farVerts[ j ] );

				}

				_bbox.getCenter( _center );
				_center.z = _bbox.max.z + this.lightMargin;
				_center.x = Math.floor( _center.x / texelWidth ) * texelWidth;
				_center.y = Math.floor( _center.y / texelHeight ) * texelHeight;
				_center.applyMatrix4( light.shadow.camera.matrixWorld );

				light.position.copy( _center );
				light.target.position.copy( _center );

				light.target.position.x += this.lightDirection.x;
				light.target.position.y += this.lightDirection.y;
				light.target.position.z += this.lightDirection.z;

			}

		}

		injectInclude() {

			three.ShaderChunk.lights_fragment_begin = Shader.lights_fragment_begin;
			three.ShaderChunk.lights_pars_begin = Shader.lights_pars_begin;

		}

		setupMaterial( material ) {

			material.defines = material.defines || {};
			material.defines.USE_CSM = 1;
			material.defines.CSM_CASCADES = this.cascades;

			if ( this.fade ) {

				material.defines.CSM_FADE = '';

			}

			const breaksVec2 = [];
			const self = this;
			const shaders = this.shaders;

			material.onBeforeCompile = function ( shader ) {

				const far = Math.min( self.camera.far, self.maxFar );
				self.getExtendedBreaks( breaksVec2 );

				shader.uniforms.CSM_cascades = { value: breaksVec2 };
				shader.uniforms.cameraNear = { value: self.camera.near };
				shader.uniforms.shadowFar = { value: far };

				shaders.set( material, shader );

			};
			shaders.set( material, null );

		}

		updateUniforms() {

			const far = Math.min( this.camera.far, this.maxFar );
			const shaders = this.shaders;

			shaders.forEach( function ( shader, material ) {

				if ( shader !== null ) {

					const uniforms = shader.uniforms;
					this.getExtendedBreaks( uniforms.CSM_cascades.value );
					uniforms.cameraNear.value = this.camera.near;
					uniforms.shadowFar.value = far;

				}

				if ( ! this.fade && 'CSM_FADE' in material.defines ) {

					delete material.defines.CSM_FADE;
					material.needsUpdate = true;

				} else if ( this.fade && ! ( 'CSM_FADE' in material.defines ) ) {

					material.defines.CSM_FADE = '';
					material.needsUpdate = true;

				}

			}, this );

		}

		getExtendedBreaks( target ) {

			while ( target.length < this.breaks.length ) {

				target.push( new three.Vector2() );

			}
			target.length = this.breaks.length;

			for ( let i = 0; i < this.cascades; i ++ ) {

				let amount = this.breaks[ i ];
				let prev = this.breaks[ i - 1 ] || 0;
				target[ i ].x = prev;
				target[ i ].y = amount;

			}

		}

		updateFrustums() {

			this.getBreaks();
			this.initCascades();
			this.updateShadowBounds();
			this.updateUniforms();

		}

		remove() {

			for ( let i = 0; i < this.lights.length; i ++ ) {

				this.parent.remove( this.lights[ i ] );

			}

		}

		dispose() {

			const shaders = this.shaders;
			shaders.forEach( function ( shader, material ) {

				delete material.onBeforeCompile;
				delete material.defines.USE_CSM;
				delete material.defines.CSM_CASCADES;
				delete material.defines.CSM_FADE;

				delete shader.uniforms.CSM_cascades;
				delete shader.uniforms.cameraNear;
				delete shader.uniforms.shadowFar;

				material.needsUpdate = true;

			} );
			shaders.clear();

		}

	}

	CSM.Helper = CSMHelper;

	return CSM;

}));
