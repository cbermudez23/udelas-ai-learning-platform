// Parche: en tesseract.js-core v7.0.0, el núcleo relaxed-SIMD tiene un símbolo
// interno roto (DotProductSSE) que aborta en tiempo de ejecución. Forzamos que
// la detección de características reporte "sin soporte relaxed-SIMD" para que
// el cargador use el núcleo "simd" normal, que sí funciona.
const wfd = require('wasm-feature-detect');
wfd.relaxedSimd = async () => false;
require('tesseract.js/src/worker-script/node/index.js');
