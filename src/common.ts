const _1p = 64 * 1024;
const _1mb = 1024 * 1024;
const _1gb = _1mb * 1024;
const _1gp = _1gb / _1p;

const PAGE_SIZE_BYTES = _1p;
const MILLI_IN_SEC = 1000; // TODO move to common ?
const PALETTE_SIZE = 256;

// type TypedArray =
//   | Int8Array
//   | Uint8Array
//   | Uint8ClampedArray
//   | Int16Array
//   | Uint16Array
//   | Int32Array
//   | Uint32Array
//   | Float32Array
//   | Float64Array;

export {
  MILLI_IN_SEC,
  PAGE_SIZE_BYTES,
  PALETTE_SIZE,
};
