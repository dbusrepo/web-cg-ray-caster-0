type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array;

type Range = [start: number, end: number];

export type { Range, TypedArray };
