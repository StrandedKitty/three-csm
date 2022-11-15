import { Group } from 'three';
import CSM from './CSM';
declare class CSMHelper extends Group {
    private readonly csm;
    displayFrustum: boolean;
    displayPlanes: boolean;
    displayShadowBounds: boolean;
    private frustumLines;
    private cascadeLines;
    private cascadePlanes;
    private shadowLines;
    constructor(csm: CSM);
    updateVisibility(): void;
    update(): void;
}
export default CSMHelper;
