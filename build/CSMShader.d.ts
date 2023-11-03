declare const CSMShader: {
    lights_fragment_begin: (cascades: number) => string;
    lights_pars_begin: (maxCascades: number) => string;
};
export default CSMShader;
