import CSM from './CSM';
declare const CSMShader: {
    lights_fragment_begin: (csm: CSM) => string;
    lights_pars_begin: () => string;
};
export default CSMShader;
