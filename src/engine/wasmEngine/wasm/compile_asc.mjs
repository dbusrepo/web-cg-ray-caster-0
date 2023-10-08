import * as path from 'path';
import * as fs from 'fs';
import * as fsExtra from "fs-extra";
import asc from 'assemblyscript/dist/asc.js';
import { initialMemoryPages, maximumMemoryPages, memoryBase } from './wasmConfig.mjs';

const args = process.argv.slice(2);
// console.log(args);

const targets = {
  debug: [
    '--optimize', '-O0',
    '--optimizeLevel', '0',
    '--shrinkLevel', '0',
    '--sourceMap',
    '--debug',
  ],
  release_speed: [
    '--optimize', '-Ospeed',
    '--optimizeLevel', '3',
    '--shrinkLevel', '1',
    '--converge',
  ],
  release_size: [
    '--optimize', '-Osize',
    '--optimizeLevel', '3',
    '--shrinkLevel', '2',
    '--converge',
  ],
};

const src = args[0];
const out = args[1];
const bindings = args[2] || 'esm';
const mode = args[3] || 'debug';
const target = targets[mode] || targets.debug;

const baseDir = '.'; //path.dirname(src);
const buildDir = './build/asc';
const wasmFile = out;
const textFile = path.format({ ...path.parse(out), base: '', ext: '.wat' });

console.log(`\nCompiling ${src} with asc ${asc.version}`);
console.log(`Base dir: ${baseDir}`);
console.log(`Build dir: ${buildDir}`);
console.log(`Text file: ${textFile}`);
console.log(`Wasm file: ${wasmFile}`);
console.log(`Bindings: ${bindings}`);
console.log(`Mode: ${mode}`);
console.log(`Target: ${target}`);
console.log('Initial memory pages:', initialMemoryPages);
console.log('Maximum memory pages:', maximumMemoryPages);
console.log('Memory base:', memoryBase);
// process.stdout.write('\n');
// process.exit(0);

// see also cli/options.json in asc source
const options = [
  '--baseDir', baseDir,
  '--outFile', wasmFile,
  '--textFile', textFile,
  '--bindings', bindings,
  '--stats',
  '--pedantic', 
  // '--verbose', // WARNING Unknown option '--verbose'
  '--measure',
  '--sourceMap',
  // '--noAssert',

  '--noExportMemory',
  '--importMemory',
  '--sharedMemory',
  '--initialMemory', initialMemoryPages.toString(),
  '--memoryBase', memoryBase.toString(),
  '--maximumMemory', maximumMemoryPages.toString(),

  '--enable', 'threads',
  '--enable', 'simd',
  '--enable', 'relaxed-simd',
  '--enable', 'bulk-memory',
  '--enable', 'reference-types',
  // '--enable', 'stringref', // CompileError: WebAssembly.instantiate(): Unknown type code 0x4f, enable with --experimental-wasm-gc @+11
  '--enable', 'sign-extension',
  '--enable', 'nontrapping-f2i',
  // '--enable', 'multi-value',

  '--disable', 'mutable-globals',
  '--disable', 'gc',

  ...target,

  '--runtime', 'stub',
];

console.log(JSON.stringify(options, null, 1));

const { stats, error, stdout } = await asc.main([
  src,
  ...options,
], {
  stdout: process.stdout,
  stderr: process.stderr
});

if (error) {
  console.log(`Compilation of ${src} failed: ${error.message}`);
  // fs.rmSync(out);
  fsExtra.emptyDirSync(buildDir);
  // throw error;
} else {
  console.log(`Compilation of ${src} succeeded.`);
  // console.log(stdout.toString());
  // console.log(`Output: ${out}`);
  // console.log(`Bindings: ${bindings}`);
  // console.log(`Target: ${target}`);
  // console.log(`Stats: ${JSON.stringify(stats)}`);
  // console.log(`Stats: ${stats}`);
}

// these paths instead are relative to .ts asc input files
// const BUILD_DIR = '../../build';
// const getSourcePath = (n) => `./${n}.ts`;
// const getBinPath = (n) => `./${BUILD_DIR}/${n}.wasm`;
// const getWatPath = (n) => `./${BUILD_DIR}/${n}.wat`;
// const getTypesFilePath = (n) => `./${BUILD_DIR}/types-${n}.d.ts`;
//
// const files = fg.sync(`*.ts`, { cwd: `${BASE_DIR}`, ignore: [ `*.d.ts` ] });
// const fileNames = files.map((n) => (n.substring(0, n.lastIndexOf('.')) || n));
//
// for (let fname of fileNames) {
//   console.log(`\nCompiling ${fname}:`);
//   const { stats, error, stdout } = await asc.main([
//     getSourcePath(fname),
//     '--baseDir', BASE_DIR,
//     '--outFile', getBinPath(fname),
//     '--textFile', getWatPath(fname),
//     // "--tsdFile", getTypesFilePath(fname),
//     // "--listFiles",
//     '--bindings', 'esm',
//     '--stats',
//     '--pedantic',
//     '--sourceMap',
//     // '--measure',
//     '--optimize', '-Ospeed',
//     '--optimizeLevel', '3',
//     '--shrinkLevel', '0',
//     '--converge',
//     // "--sourceMap", // <-- TODO
//     // "--debug", // <-- TODO
//     '--noExportMemory',
//     '--importMemory',
//     '--sharedMemory',
//     '--initialMemory', '80',
//     '--maximumMemory', '80',
//     '--enable', 'threads',
//     '--enable', 'simd',
//     '--enable', 'bulk-memory',
//     '--enable', 'reference-types',
//     '--sharedMemory',
//     '--runtime', 'stub' // <-- TODO
//     // "--exportRuntime"
//   ],
//     {
//       stdout: process.stdout,
//       stderr: process.stderr
//     }
//   );
//   if (error) {
//     console.log(`Compilation of ${fname} failed: ${error.message}`);
//     throw error;
//   } else {
//     // console.log(stdout.toString());
//     console.log(stats);
//   }
// }
//
// // , {
// //     stdout: process.stdout,
// //     stderr: process.stderr
// //   }, function(err) {
// //     if (err) {
// //       throw err;
// //     }
// //     // console.log(`${fname}.ts compiled.`);
// //     return 0;
// //   });
// // }
// // });
//
