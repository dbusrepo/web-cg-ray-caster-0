import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { SArray, newSArray } from '../sarray';
import { Texture } from '../texture';
import { BitImageRGBA } from '../bitImageRGBA';
import {
  sharedHeapPtr,
  numWorkers,
  mainWorkerIdx,
  workerIdx,
  logi,
  logf,
  rgbaSurface0ptr,
  rgbaSurface0width,
  rgbaSurface0height,
  syncArrayPtr,
  sleepArrayPtr,
  inputKeysPtr,
  hrTimerPtr,
  raycasterPtr,
  frameColorRGBAPtr,
} from '../importVars';
import {
  FrameColorRGBA, 
  newFrameColorRGBA,
  // deleteFrameColorRGBA, 
  MAX_LIGHT_LEVELS,
  BPP_RGBA,
  getRedLightTablePtr,
  getGreenLightTablePtr,
  getBlueLightTablePtr,
  getRedFogTablePtr,
  getGreenFogTablePtr,
  getBlueFogTablePtr,
} from '../frameColorRGBA';
import { Viewport } from './viewport';
import { Raycaster } from './raycaster';

const WALL_COLOR_SIDE_0 = FrameColorRGBA.colorABGR(0xff, 0, 0, 0xff);
const WALL_COLOR_SIDE_1 = FrameColorRGBA.colorABGR(0xff, 0, 0, 0x88);
const CEIL_COLOR = FrameColorRGBA.colorABGR(0xff, 0xbb, 0xbb, 0xbb);
const FLOOR_COLOR = FrameColorRGBA.colorABGR(0xff, 0x55, 0x55, 0x55);

let raycaster: Raycaster = changetype<Raycaster>(NULL_PTR);
let frameColorRGBA = changetype<FrameColorRGBA>(NULL_PTR);
let textures = changetype<SArray<Texture>>(NULL_PTR);
let mipmaps = changetype<SArray<BitImageRGBA>>(NULL_PTR);
let frameRowPtrs = changetype<SArray<PTR_T>>(NULL_PTR);

const FRAME_STRIDE = rgbaSurface0width * BPP_RGBA;
let startFramePtr: PTR_T = NULL_PTR;

function initRender(inRaycaster: Raycaster, infColorRGBA: FrameColorRGBA, inTextures: SArray<Texture>, inMipmaps: SArray<BitImageRGBA>): void {
  raycaster = inRaycaster;
  frameColorRGBA = infColorRGBA;
  const viewport = raycaster.Viewport;
  textures = inTextures;
  mipmaps = inMipmaps;
  startFramePtr = rgbaSurface0ptr + viewport.StartY * FRAME_STRIDE + viewport.StartX * BPP_RGBA;
  frameRowPtrs = newSArray<PTR_T>(viewport.Height + 1);
  for (let y = 0 as u32; y <= viewport.Height; y++) {
    frameRowPtrs.set(y, startFramePtr + y * FRAME_STRIDE);
  }
}

function renderViewVert(raycaster: Raycaster): void {
  const wallSlices = raycaster.WallSlices;
  const viewport = raycaster.Viewport;
  const player = raycaster.Player;
  // const posX = player.PosX;
  // const posY = player.PosY;
  // const dirX = player.DirX;
  // const dirY = player.DirY;
  // const planeX = player.PlaneX;
  // const planeY = player.PlaneY;
  // const projYCenter = raycaster.ProjYCenter;
  // // const zBuffer = raycaster.ZBuffer;
  // const map = raycaster.Map;
  // const mapWidth = map.Width;
  // const mapHeight = map.Height;
  // const minWallTop = raycaster.MinWallTop;
  // const maxWallTop = raycaster.MaxWallTop;
  // const minWallBottom = raycaster.MinWallBottom;
  // const maxWallBottom = raycaster.MaxWallBottom;

  for (let x: u32 = 0; x < viewport.Width; x++) {

    const wallSlice = wallSlices.at(x);

    const top = wallSlice.Top;
    const bottom = wallSlice.Bottom;
    const hit = wallSlice.Hit;
    const side = wallSlice.Side;

    const xcolOffs = x * BPP_RGBA;
    const colPtr = startFramePtr + xcolOffs;

    let framePtr = colPtr;
    let frameLimitPtr = frameRowPtrs.at(top) + xcolOffs;

    // render ceil
    // for (let y = 0 as u32; y < top; y++) {
      // framePtr += FRAME_STRIDE;
    for (; framePtr < frameLimitPtr; framePtr += FRAME_STRIDE) {
      store<u32>(framePtr, CEIL_COLOR);
    }

    frameLimitPtr = frameRowPtrs.at(bottom + 1) + xcolOffs;

    if (hit) {
      // TODO:
      // const tex = textures.at(wallSlice.TexId);
      // const mipmap = tex.getMipmap(wallSlice.MipLvl); // TODO: assert
      const mipmap = mipmaps.at(wallSlice.MipMapIdx);

      const texX = wallSlice.TexX;
      const mipmapRowOffs = (texX as SIZE_T) << mipmap.PitchLg2;
      const mipmapPtr = mipmap.Ptr + mipmapRowOffs * BPP_RGBA;
      
      // const texStepY = wallSlice.TexStepY;
      // let texY = wallSlice.TexY;
      //
      // for (let y = top; y <= bottom; y++) {
      //   const texColOffs = texY as u32;
      //   const texCol = load<u32>(mipmapPtr + texColOffs * BPP_RGBA);
      //   store<u32>(framePtr, texCol);
      //   framePtr += FRAME_STRIDE;
      //   texY += texStepY;
      // }

      // fixed version
      const FIX_P = 16;
      const F_TO_FIX = (1 << FIX_P) as f32;
      const texStepY_fix = wallSlice.TexStepY * F_TO_FIX as u32;
      let texY_fix = wallSlice.TexY * F_TO_FIX as u32;
      for (let y = top; y <= bottom; y++) {
      // for (; framePtr !== frameLimitPtr; framePtr += FRAME_STRIDE) {
        const texColOffs = texY_fix >> FIX_P;
        const texCol = load<u32>(mipmapPtr + texColOffs * BPP_RGBA);
        store<u32>(framePtr, texCol);
        texY_fix += texStepY_fix;
        framePtr += FRAME_STRIDE;
      }
    } else {
      // render empty wall
      const color = side == 0 ? WALL_COLOR_SIDE_0 : WALL_COLOR_SIDE_1;
      for (let y = top; y <= bottom; y++) {
        store<u32>(framePtr, color);
        framePtr += FRAME_STRIDE;
      }
    }

    // // render floor
    // frameLimitPtr = frameRowPtrs.at(viewport.Height) + x * BPP_RGBA;
    // // for (let y = bottom + 1 as u32; y < viewport.Height; y++) {
    // for (; framePtr !== frameLimitPtr; framePtr += FRAME_STRIDE) {
    //   store<u32>(framePtr, FLOOR_COLOR);
    // }

  }
}

export { 
  initRender,
  renderViewVert,
};
