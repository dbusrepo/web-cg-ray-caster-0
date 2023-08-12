import { SArray, newSArray } from './sarray';
import { PTR_T, SIZE_T, NULL_PTR } from './memUtils';
import { ObjectAllocator, newObjectAllocator } from './objectAllocator';
import {
  logi,
  logf,
} from './importVars';

const BPP_RGBA: u8 = 4;

const RGBA_ALPHA_MASK: u32 = 0xff000000;
const RGBA_BLUE_MASK: u32 = 0x00ff0000;
const RGBA_GREEN_MASK: u32 = 0x0000ff00;
const RGBA_RED_MASK: u32 = 0x000000ff;

const RGBA_RED_SHIFT = 24;
const RGBA_GREEN_SHIFT = 16;
const RGBA_BLUE_SHIFT = 8;
const RGBA_ALPHA_SHIFT = 0;

const ABGR_ALPHA_MASK: u32 = 0xff000000;
const ABGR_BLUE_MASK: u32 = 0x00ff0000;
const ABGR_GREEN_MASK: u32 = 0x0000ff00;
const ABGR_RED_MASK: u32 = 0x000000ff;

const ABGR_ALPHA_SHIFT = 24;
const ABGR_BLUE_SHIFT = 16;
const ABGR_GREEN_SHIFT = 8;
const ABGR_RED_SHIFT = 0;

const RED_MAX: u8 = 255;
const GREEN_MAX: u8 = 255;
const BLUE_MAX: u8 = 255;

const MAX_LIGHT_LEVELS = 255;

@final @unmanaged class FrameColorRGBA {

  private redLightTable: SArray<u8>;
  private greenLightTable: SArray<u8>;
  private blueLightTable: SArray<u8>;

  private redFogTable: SArray<u8>;
  private greenFogTable: SArray<u8>;
  private blueFogTable: SArray<u8>;

  constructor() {}

  init(): void {
    const NUM_LIGHT_LEVELS = MAX_LIGHT_LEVELS + 1;
    this.redLightTable = newSArray<u8>((RED_MAX as u32 + 1) * NUM_LIGHT_LEVELS);
    this.greenLightTable = newSArray<u8>((GREEN_MAX as u32 + 1) * NUM_LIGHT_LEVELS);
    this.blueLightTable = newSArray<u8>((BLUE_MAX as u32 + 1) * NUM_LIGHT_LEVELS);
    this.redFogTable = newSArray<u8>((RED_MAX as u32 + 1) * NUM_LIGHT_LEVELS);
    this.greenFogTable = newSArray<u8>((GREEN_MAX as u32 + 1) * NUM_LIGHT_LEVELS);
    this.blueFogTable = newSArray<u8>((BLUE_MAX as u32 + 1) * NUM_LIGHT_LEVELS);
    this.computeLightTables();
    this.computeFogTables();
  }

  private computeLightTables(): void {
    FrameColorRGBA.initColorShadesTable(this.redLightTable, RED_MAX, 0);
    FrameColorRGBA.initColorShadesTable(this.greenLightTable, GREEN_MAX, 0);
    FrameColorRGBA.initColorShadesTable(this.blueLightTable, BLUE_MAX, 0);
  }

  private computeFogTables(): void {
    FrameColorRGBA.initColorShadesTable(this.redFogTable, RED_MAX, RED_MAX);
    FrameColorRGBA.initColorShadesTable(this.greenFogTable, GREEN_MAX, GREEN_MAX);
    FrameColorRGBA.initColorShadesTable(this.blueFogTable, BLUE_MAX, BLUE_MAX);
  }

  // for each color c, compute the shades of c from level 0 (target) to c
  private static initColorShadesTable(colorTable: SArray<u8>, colorMax: u32, target: u32): void {
    // assert colorMax, target in [0,255]
    let tableIdx = 0;
    for (let c: u32 = 0; c <= colorMax; c++) {
      for (let i = 0; i <= MAX_LIGHT_LEVELS; i++) {
        const shade = <u8>((c - target) * i / MAX_LIGHT_LEVELS + target);
        colorTable.set(tableIdx++, shade);
      }
    }
  }

  static colorABGR(a: u32, b: u32, g: u32, r: u32): u32 {
    return (
      (a << ABGR_ALPHA_SHIFT) |
      (b << ABGR_BLUE_SHIFT) |
      (g << ABGR_GREEN_SHIFT) |
      r
    );
  }

  static colorRGBAtoABGR(color: u32): u32 {
    const r = (color >> RGBA_RED_SHIFT) & 0xff;
    const g = (color >> RGBA_GREEN_SHIFT) & 0xff;
    const b = (color >> RGBA_BLUE_SHIFT) & 0xff;
    const a = (color >> RGBA_ALPHA_SHIFT) & 0xff;
    return FrameColorRGBA.colorABGR(a, b, g, r);
  }

  lightColorABGR(colorABGR: u32, intensity: u32): u32 {
    // TODO:
    // assert intensity <= MAX_LIGHT_LEVELS

    const a = (colorABGR >> ABGR_ALPHA_SHIFT) & 0xff;
    const b = (colorABGR >> ABGR_BLUE_SHIFT) & 0xff;
    const g = (colorABGR >> ABGR_GREEN_SHIFT) & 0xff;
    const r = (colorABGR >> ABGR_RED_SHIFT) & 0xff;

    const at = a;
    const bt = this.blueLightTable.at(b * (MAX_LIGHT_LEVELS + 1) + intensity);
    const gt = this.greenLightTable.at(g * (MAX_LIGHT_LEVELS + 1) + intensity);
    const rt = this.redLightTable.at(r * (MAX_LIGHT_LEVELS + 1) + intensity);

    const colorABGRtarget = FrameColorRGBA.colorABGR(at, bt, gt, rt);
    
    return colorABGRtarget;
  }

  fogColorABGR(colorABGR: u32, intensity: u32): u32 {
    // TODO:
    // assert intensity <= MAX_LIGHT_LEVELS

    const a = (colorABGR >> ABGR_ALPHA_SHIFT) & 0xff;
    const b = (colorABGR >> ABGR_BLUE_SHIFT) & 0xff;
    const g = (colorABGR >> ABGR_GREEN_SHIFT) & 0xff;
    const r = (colorABGR >> ABGR_RED_SHIFT) & 0xff;

    const at = a;
    const bt = this.blueFogTable.at(b * (MAX_LIGHT_LEVELS + 1) + intensity);
    const gt = this.greenFogTable.at(g * (MAX_LIGHT_LEVELS + 1) + intensity);
    const rt = this.redFogTable.at(r * (MAX_LIGHT_LEVELS + 1) + intensity);

    const colorABGRtarget = FrameColorRGBA.colorABGR(at, bt, gt, rt);
    
    return colorABGRtarget;
  }

  lightPixel(pColor: PTR_T, intensity: u32): void {
    // TODO:
    // assert(pColor % 4 == 0); // u32 aligned
    // assert(intensity <= MAX_LIGHT_LEVELS);

    // assume color is stored as RGBA, so when loaded bytes are reversed 
    const colorABGR = load<u32>(pColor);
    const colorABGRtarget = this.lightColorABGR(colorABGR, intensity);

    store<u32>(pColor, colorABGRtarget);
  }

  fogPixel(pColor: PTR_T, intensity: u32): void {
    // TODO:
    // assert(pColor % 4 == 0); // u32 aligned
    // assert(intensity <= MAX_LIGHT_LEVELS);

    // assume color is stored as RGBA, so when loaded bytes are reversed 
    const colorABGR = load<u32>(pColor);
    const colorABGRtarget = this.fogColorABGR(colorABGR, intensity);

    store<u32>(pColor, colorABGRtarget);
  }

  static mixColorsABGR(c1: u32, c2: u32, ratio: f32): u32 {
    const rs1 = (c1 >> ABGR_RED_SHIFT) & 0xff;
    const rs2 = (c2 >> ABGR_RED_SHIFT) & 0xff;
    const gs1 = (c1 >> ABGR_GREEN_SHIFT) & 0xff;
    const gs2 = (c2 >> ABGR_GREEN_SHIFT) & 0xff;
    const bs1 = (c1 >> ABGR_BLUE_SHIFT) & 0xff;
    const bs2 = (c2 >> ABGR_BLUE_SHIFT) & 0xff;
    const rt = <u32>((1 - ratio) * rs1 + ratio * rs2);
    const gt = <u32>((1 - ratio) * gs1 + ratio * gs2);
    const bt = <u32>((1 - ratio) * bs1 + ratio * bs2);
    return FrameColorRGBA.colorABGR(0xff, bt, gt, rt);
  }

  get RedLightTable(): SArray<u8> {
    return this.redLightTable;
  }

  get GreenLightTable(): SArray<u8> {
    return this.greenLightTable;
  }

  get BlueLightTable(): SArray<u8> {
    return this.blueLightTable;
  }

  get RedFogTable(): SArray<u8> {
    return this.redFogTable;
  }

  get GreenFogTable(): SArray<u8> {
    return this.greenFogTable;
  }

  get BlueFogTable(): SArray<u8> {
    return this.blueFogTable;
  }
}

let frameColorAllocator = changetype<ObjectAllocator<FrameColorRGBA>>(NULL_PTR);

function initFrameColorRGBAAllocator(): void {
  frameColorAllocator = newObjectAllocator<FrameColorRGBA>(1);
}

function newFrameColorRGBA(): FrameColorRGBA {
  if (changetype<PTR_T>(frameColorAllocator) === NULL_PTR) {
    initFrameColorRGBAAllocator();
  }
  const frameColorRGBA = frameColorAllocator.new();
  frameColorRGBA.init();
  return frameColorRGBA;
}

function deleteFrameColorRGBA(frameColorRGBA: FrameColorRGBA): void {
  frameColorAllocator.delete(frameColorRGBA);
}

function getRedLightTablePtr(frameColorRGBAPtr: PTR_T): PTR_T {
  const frameColorRGBA = changetype<FrameColorRGBA>(frameColorRGBAPtr);
  return frameColorRGBA.RedLightTable.DataPtr;
}

function getGreenLightTablePtr(frameColorRGBAPtr: PTR_T): PTR_T {
  const frameColorRGBA = changetype<FrameColorRGBA>(frameColorRGBAPtr);
  return frameColorRGBA.GreenLightTable.DataPtr;
}

function getBlueLightTablePtr(frameColorRGBAPtr: PTR_T): PTR_T {
  const frameColorRGBA = changetype<FrameColorRGBA>(frameColorRGBAPtr);
  return frameColorRGBA.BlueLightTable.DataPtr;
}

function getRedFogTablePtr(frameColorRGBAPtr: PTR_T): PTR_T {
  const frameColorRGBA = changetype<FrameColorRGBA>(frameColorRGBAPtr);
  return frameColorRGBA.RedFogTable.DataPtr;
}

function getGreenFogTablePtr(frameColorRGBAPtr: PTR_T): PTR_T {
  const frameColorRGBA = changetype<FrameColorRGBA>(frameColorRGBAPtr);
  return frameColorRGBA.GreenFogTable.DataPtr;
}

function getBlueFogTablePtr(frameColorRGBAPtr: PTR_T): PTR_T {
  const frameColorRGBA = changetype<FrameColorRGBA>(frameColorRGBAPtr);
  return frameColorRGBA.BlueFogTable.DataPtr;
}

export { 
  FrameColorRGBA, 
  newFrameColorRGBA,
  deleteFrameColorRGBA, 
  MAX_LIGHT_LEVELS,
  BPP_RGBA,
  getRedLightTablePtr,
  getGreenLightTablePtr,
  getBlueLightTablePtr,
  getRedFogTablePtr,
  getGreenFogTablePtr,
  getBlueFogTablePtr,
};
