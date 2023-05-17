// import assert from 'assert';
import engineWasm from './wasm/build/asc/engine.wasm';
import engineExport from './wasm/build/asc/engine';
import { ascImportImages } from '../../assets/build/images';
import { ascImportStrings } from '../../assets/build/strings';

// TODO
type wasmBuilderFunc<T> = (
  importsObject?: WebAssembly.Imports,
) => Promise<{ instance: WebAssembly.Instance & { exports: T } }>;

// ****** WASM IMPORT (wasm built from wat)
// import clear_canvas_wasm from './wasm/build/wat/clear_canvas.wasm';
// import clear_test_wasm from './wasm/bin/clear_test.wasm';

type WasmImports = {
  memory: WebAssembly.Memory;
  frameWidth: number;
  frameHeight: number;
  frameBufferPtr: number;
  syncArrayPtr: number;
  sleepArrayPtr: number;
  workersHeapPtr: number;
  workerHeapSize: number;
  heapPtr: number;
  workerIdx: number;
  mainWorkerIdx: number;
  numWorkers: number;
  bgColor: number;
  usePalette: number;
  numImages: number;
  imagesIndexPtr: number;
  imagesIndexSize: number;
  imagesDataPtr: number;
  imagesDataSize: number;
  fontCharsPtr: number;
  fontCharsSize: number;
  stringsDataPtr: number;
  stringsDataSize: number;
  workersMemCountersPtr: number;
  workersMemCountersSize: number;
  inputKeysPtr: number;
  inputKeysSize: number;
  hrTimerPtr: number;
  FONT_X_SIZE: number;
  FONT_Y_SIZE: number;
  FONT_SPACING: number;
  logi: (v: number) => void;
  logf: (v: number) => void;
};

type WasmModules = {
  engine: typeof engineExport;
};

async function loadWasm<T>(
  wasm: wasmBuilderFunc<T>,
  wasmInput: WasmImports,
  ...otherImports: object[]
): Promise<T> {
  const otherImpObj = otherImports.reduce(
    (acc, obj) => ({
      ...acc,
      ...obj,
    }),
    {},
  );
  const instance = await wasm({
    // for each of these obj props import their fields from asc file with the
    // same name: importVars.ts, importImages.ts, ...
    importVars: {
      ...wasmInput,
      ...otherImpObj,
    },
    importImages: {
      ...ascImportImages,
    },
    importStrings: {
      ...ascImportStrings,
    },
    env: {
      memory: wasmInput.memory,
      abort: (...args: any[]) => {
        console.log('abort!');
      },
      'performance.now': () => performance.now(),
    },
  });
  return instance.instance.exports;
}

async function loadWasmModules(imports: WasmImports): Promise<WasmModules> {
  const engine = await loadWasm<typeof engineExport>(engineWasm, imports);
  engine.init();
  return {
    engine,
  };
}

export { WasmImports, WasmModules, loadWasmModules };
