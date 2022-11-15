import { Vector3, Matrix4 } from 'three';
interface Params {
    projectionMatrix?: Matrix4;
    maxFar?: number;
}
interface FrustumVertices {
    far: Vector3[];
    near: Vector3[];
}
export default class CSMFrustum {
    vertices: FrustumVertices;
    constructor(data?: Params);
    setFromProjectionMatrix(projectionMatrix: Matrix4, maxFar: number): FrustumVertices;
    split(breaks: number[], target: CSMFrustum[]): void;
    toSpace(cameraMatrix: Matrix4, target: CSMFrustum): void;
}
export {};
