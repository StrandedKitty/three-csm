import {
	Vector2,
	Vector3,
	DirectionalLight,
	MathUtils,
	ShaderChunk,
	Matrix4,
	Box3,
	Object3D,
	Material,
	Shader,
	PerspectiveCamera,
	OrthographicCamera,
	Color
} from 'three';
import CSMShader from './CSMShader';
import CSMHelper from './CSMHelper';
import CSMFrustum from './CSMFrustum';

function uniformSplit( amount: number, near: number, far: number, target: number[] ) {

	for ( let i = 1; i < amount; i ++ ) {

		target.push( ( near + ( far - near ) * i / amount ) / far );

	}

	target.push( 1 );

}

function logarithmicSplit( amount: number, near: number, far: number, target: number[] ) {

	for ( let i = 1; i < amount; i ++ ) {

		target.push( ( near * ( far / near ) ** ( i / amount ) ) / far );

	}

	target.push( 1 );

}

function practicalSplit( amount: number, near: number, far: number, lambda: number, target: number[] ) {

	_uniformArray.length = 0;
	_logArray.length = 0;
	logarithmicSplit( amount, near, far, _logArray );
	uniformSplit( amount, near, far, _uniformArray );

	for ( let i = 1; i < amount; i ++ ) {

		target.push( MathUtils.lerp( _uniformArray[ i - 1 ], _logArray[ i - 1 ], lambda ) );

	}

	target.push( 1 );

}

const _origin = new Vector3( 0, 0, 0 );
const _lightOrientationMatrix = new Matrix4();
const _lightOrientationMatrixInverse = new Matrix4();
const _cameraToLightParentMatrix = new Matrix4();
const _cameraToLightMatrix = new Matrix4();
const _lightSpaceFrustum = new CSMFrustum();
const _center = new Vector3();
const _bbox = new Box3();
const _uniformArray = [];
const _logArray = [];

export type CustomSplitsCallbackType = ( cascadeCount: number, nearDistance: number, farDistance: number ) => number[];

export interface CSMParams {
	camera: PerspectiveCamera | OrthographicCamera;
	parent: Object3D;
	cascades?: number;
	maxCascades?: number;
	maxFar?: number;
	mode?: 'uniform' | 'logarithmic' | 'practical' | 'custom';
	practicalModeLambda?: number;
	customSplitsCallback?: CustomSplitsCallbackType;
	shadowMapSize?: number;
	shadowBias?: number;
	shadowNormalBias?: number;
	lightIntensity?: number;
	lightColor?: Color;
	lightDirection?: Vector3;
	lightDirectionUp?: Vector3;
	lightMargin?: number;
	fade?: boolean;
}

class CSM {

	public camera: PerspectiveCamera | OrthographicCamera;
	public parent: Object3D;
	public cascades: number;
	public maxCascades: number;
	public maxFar: number;
	public mode: string;
	public practicalModeLambda: number;
	public shadowMapSize: number;
	public shadowBias: number;
	public shadowNormalBias: number;
	public lightDirection: Vector3;
	public lightDirectionUp: Vector3;
	public lightIntensity: number;
	public lightColor: Color;
	public lightMargin: number;
	public customSplitsCallback: CustomSplitsCallbackType;
	public fade: boolean;
	public mainFrustum: CSMFrustum = new CSMFrustum();
	public frustums: CSMFrustum[] = [];
	public breaks: number[] = [];
	public lights: DirectionalLight[] = [];
	private readonly shaders: Map<Material, Shader> = new Map();

	public constructor( data: CSMParams ) {

		this.camera = data.camera;
		this.parent = data.parent;
		this.cascades = data.cascades ?? 3;
		this.maxCascades = data.maxCascades ?? data.cascades;
		this.maxFar = data.maxFar ?? 100000;
		this.mode = data.mode ?? 'practical';
		this.practicalModeLambda = data.practicalModeLambda ?? 0.5;
		this.shadowMapSize = data.shadowMapSize ?? 2048;
		this.shadowBias = data.shadowBias ?? 0;
		this.shadowNormalBias = data.shadowNormalBias ?? 0;
		this.lightDirection = data.lightDirection ?? new Vector3( 1, - 1, 1 ).normalize();
		this.lightDirectionUp = data.lightDirectionUp ?? Object3D.DEFAULT_UP;
		this.lightIntensity = data.lightIntensity ?? 1;
		this.lightColor = data.lightColor ?? new Color( 0xffffff );
		this.lightMargin = data.lightMargin ?? 200;
		this.fade = data.fade ?? false;
		this.customSplitsCallback = data.customSplitsCallback;

		this.createLights();
		this.updateFrustums();
		this.injectInclude();

	}

	private createLights() {

		for ( let i = 0; i < this.cascades; i ++ ) {

			const light = new DirectionalLight( this.lightColor, this.lightIntensity );
			light.castShadow = true;
			light.shadow.mapSize.width = this.shadowMapSize;
			light.shadow.mapSize.height = this.shadowMapSize;

			light.shadow.camera.near = 0;
			light.shadow.camera.far = 1;

			this.parent.add( light.target );
			this.lights.push( light );

		}

		// NOTE: Prepend lights to the parent as we assume CSM shadows come from first light sources in the world

		for ( let i = this.lights.length - 1; i >= 0; i -- ) {

			const light = this.lights[ i ];

			light.parent = this.parent;
			this.parent.children.unshift( light );

		}

	}

	private initCascades() {

		this.camera.updateProjectionMatrix();
		this.mainFrustum.setFromProjectionMatrix( this.camera.projectionMatrix, this.maxFar );
		this.mainFrustum.split( this.breaks, this.frustums );

	}

	private updateShadowBounds() {

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
			shadowCam.near = 0;
			shadowCam.far = squaredBBWidth + this.lightMargin;
			shadowCam.updateProjectionMatrix();

			light.shadow.bias = this.shadowBias * squaredBBWidth;
			light.shadow.normalBias = this.shadowNormalBias * squaredBBWidth;

		}

	}

	private updateBreaks() {

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
				practicalSplit( this.cascades, camera.near, far, this.practicalModeLambda, this.breaks );
				break;
			case 'custom':
				if ( this.customSplitsCallback === undefined ) {

					throw new Error( 'CSM: Custom split scheme callback not defined.' );

				}

				this.breaks.push( ...this.customSplitsCallback( this.cascades, camera.near, far ) );
				break;

		}

	}

	public update() {

		for ( let i = 0; i < this.frustums.length; i ++ ) {

			const light = this.lights[ i ];
			const shadowCam = light.shadow.camera;
			const texelWidth = ( shadowCam.right - shadowCam.left ) / this.shadowMapSize;
			const texelHeight = ( shadowCam.top - shadowCam.bottom ) / this.shadowMapSize;

			// This matrix only represents sun orientation, origin is zero
			_lightOrientationMatrix.lookAt( _origin, this.lightDirection, this.lightDirectionUp );
			_lightOrientationMatrixInverse.copy( _lightOrientationMatrix ).invert();

			// Go from camera space to world space using camera.matrixWorld, then go to parent space using inverse of parent.matrixWorld
			_cameraToLightParentMatrix.copy( this.parent.matrixWorld ).invert().multiply( this.camera.matrixWorld );
			// Go from camera space to light parent space, then apply light orientation
			_cameraToLightMatrix.multiplyMatrices( _lightOrientationMatrixInverse, _cameraToLightParentMatrix );
			this.frustums[ i ].toSpace( _cameraToLightMatrix, _lightSpaceFrustum );

			const nearVerts = _lightSpaceFrustum.vertices.near;
			const farVerts = _lightSpaceFrustum.vertices.far;
			_bbox.makeEmpty();
			for ( let j = 0; j < 4; j ++ ) {

				_bbox.expandByPoint( nearVerts[ j ] );
				_bbox.expandByPoint( farVerts[ j ] );

			}

			_bbox.getCenter( _center );
			_center.z = _bbox.max.z + this.lightMargin;
			// Round X and Y to avoid shadow shimmering when moving or rotating the camera
			_center.x = Math.floor( _center.x / texelWidth ) * texelWidth;
			_center.y = Math.floor( _center.y / texelHeight ) * texelHeight;
			// Center is currently in light space, so we need to go back to light parent space
			_center.applyMatrix4( _lightOrientationMatrix );

			// New positions are relative to this.parent
			light.position.copy( _center );
			light.target.position.copy( _center );

			light.target.position.x += this.lightDirection.x;
			light.target.position.y += this.lightDirection.y;
			light.target.position.z += this.lightDirection.z;

		}

	}

	private injectInclude() {

		ShaderChunk.lights_fragment_begin = CSMShader.lights_fragment_begin( this.cascades );
		ShaderChunk.lights_pars_begin = CSMShader.lights_pars_begin( this.maxCascades );

	}

	public setupMaterial( material: Material ) {

		const fn = ( shader ) => {

			const breaksVec2 = this.getExtendedBreaks();

			const far = Math.min( this.camera.far, this.maxFar );

			shader.uniforms.CSM_cascades = { value: breaksVec2 };
			shader.uniforms.cameraNear = { value: Math.min( this.maxFar, this.camera.near ) };
			shader.uniforms.shadowFar = { value: far };

			material.defines = material.defines || {};
			material.defines.USE_CSM = 1;
			material.defines.CSM_CASCADES = this.cascades;
			material.defines.CSM_FADE = this.fade ? '' : undefined;

			material.needsUpdate = true;

			this.shaders.set( material, shader );

			material.addEventListener( 'dispose', () => {

				this.shaders.delete( material );

			} );

		};

		if ( ! material.onBeforeCompile ) {

			material.onBeforeCompile = fn;

		} else {

			const previousFn = material.onBeforeCompile;

			material.onBeforeCompile = ( ...args ) => {

				previousFn( ...args );
				fn( args[ 0 ] );

			};

		}

	}

	private updateUniforms() {

		const far = Math.min( this.camera.far, this.maxFar );

		const breaks = this.getExtendedBreaks();

		this.shaders.forEach( ( shader, material ) => {

			if ( shader !== null ) {

				const uniforms = shader.uniforms;
				uniforms.CSM_cascades.value = breaks;
				uniforms.cameraNear.value = Math.min( this.maxFar, this.camera.near );
				uniforms.shadowFar.value = far;

			}

			let definesChanged = false;

			const fadeValue = this.fade ? '' : undefined;
			if ( material.defines.CSM_FADE !== fadeValue ) {

				material.defines.CSM_FADE = fadeValue;
				definesChanged = true;

			}

			if ( material.defines.CSM_CASCADES !== this.cascades ) {

				material.defines.CSM_CASCADES = this.cascades;
				definesChanged = true;

			}

			if ( definesChanged ) {

				material.needsUpdate = true;

			}

		} );

	}

	private getExtendedBreaks(): Vector2[] {

		const target: Vector2[] = [];

		for ( let i = 0; i < 4; i ++ ) {

			const amount = this.breaks[ i ] || 0;
			const prev = this.breaks[ i - 1 ] || 0;
			target.push( new Vector2( prev, amount ) );

		}

		return target;

	}

	public updateFrustums() {

		this.updateBreaks();
		this.initCascades();
		this.updateShadowBounds();
		this.updateUniforms();

	}

	public updateCascades( cascades: number ) {

		this.cascades = cascades;

		for ( const light of this.lights ) {

			this.parent.remove( light );
			light.dispose();

		}

		this.lights.length = 0;

		this.createLights();

		this.injectInclude();

		this.updateFrustums();

	}

	public updateShadowMapSize( size: number ) {

		this.shadowMapSize = size;

		for ( let i = 0; i < this.lights.length; i ++ ) {

			const light = this.lights[ i ];
			light.shadow.mapSize.width = size;
			light.shadow.mapSize.height = size;

			if ( light.shadow.map ) {

				// Dispose old shadow map so that three.js automatically creates a new one using the updated
				// mapSize dimensions. See https://stackoverflow.com/a/31858963/8886455
				light.shadow.map.dispose();
				light.shadow.map = null;

			}

		}

	}

	public dispose() {

		this.shaders.forEach( function ( shader, material ) {

			delete material.onBeforeCompile;
			delete material.defines.USE_CSM;
			delete material.defines.CSM_CASCADES;
			delete material.defines.CSM_FADE;

			if ( shader !== null ) {

				delete shader.uniforms.CSM_cascades;
				delete shader.uniforms.cameraNear;
				delete shader.uniforms.shadowFar;

			}

			material.needsUpdate = true;

		} );
		this.shaders.clear();

		for ( let i = 0; i < this.lights.length; i ++ ) {

			this.lights[ i ].dispose();
			this.parent.remove( this.lights[ i ] );

		}

	}

	public static Helper = CSMHelper;

}

export default CSM;
