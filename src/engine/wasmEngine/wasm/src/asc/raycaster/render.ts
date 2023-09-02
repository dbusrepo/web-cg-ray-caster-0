import { myAssert } from '../myAssert';
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

const TEXTURED_FLOOR = true;

let raycaster: Raycaster = changetype<Raycaster>(NULL_PTR);
let frameColorRGBA = changetype<FrameColorRGBA>(NULL_PTR);
let textures = changetype<SArray<Texture>>(NULL_PTR);
let mipmaps = changetype<SArray<BitImageRGBA>>(NULL_PTR);
let frameRowPtrs = changetype<SArray<PTR_T>>(NULL_PTR);
let lfloorSpanX = changetype<SArray<f32>>(NULL_PTR);
let lfloorSpanY = changetype<SArray<f32>>(NULL_PTR);
let floorStepX = changetype<SArray<f32>>(NULL_PTR);
let floorStepY = changetype<SArray<f32>>(NULL_PTR);

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
  lfloorSpanX = newSArray<f32>(viewport.Height);
  lfloorSpanY = newSArray<f32>(viewport.Height);
  floorStepX = newSArray<f32>(viewport.Height);
  floorStepY = newSArray<f32>(viewport.Height);
}

function renderViewVert(raycaster: Raycaster): void {
  const wallSlices = raycaster.WallSlices;
  const viewport = raycaster.Viewport;
  const player = raycaster.Player;
  const map = raycaster.Map;
  // const posX = player.PosX;
  // const posY = player.PosY;
  // const dirX = player.DirX;
  // const dirY = player.DirY;
  // const planeX = player.PlaneX;
  // const planeY = player.PlaneY;
  // const projYCenter = raycaster.ProjYCenter;
  // // const zBuffer = raycaster.ZBuffer;
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
      const mipmapRowOffs = (texX as SIZE_T) << mipmap.Lg2Pitch;
      const mipmapPtr = mipmap.Ptr + mipmapRowOffs * BPP_RGBA;
      
      const texStepY = wallSlice.TexStepY;
      let texY = wallSlice.TexY;

      // for (; framePtr < frameLimitPtr; framePtr += FRAME_STRIDE) {
      //   const texColOffs = texY as u32;
      //   const texCol = load<u32>(mipmapPtr + texColOffs * BPP_RGBA);
      //   store<u32>(framePtr, texCol);
      //   texY += texStepY;
      // }

      // // fixed
      const FIX_P = 16;
      const F_TO_FIX = (1 << FIX_P) as f32;
      const texStepY_fix = wallSlice.TexStepY * F_TO_FIX as u32;
      let texY_fix = wallSlice.TexY * F_TO_FIX as u32;
      // for (let y = top; y <= bottom; y++) {
        // framePtr += FRAME_STRIDE;
      for (; framePtr < frameLimitPtr; framePtr += FRAME_STRIDE) {
        const texColOffs = texY_fix >> FIX_P;
        const texCol = load<u32>(mipmapPtr + texColOffs * BPP_RGBA);
        store<u32>(framePtr, texCol);
        texY_fix += texStepY_fix;
      }
    } else {
      // render empty wall
      const color = side == 0 ? WALL_COLOR_SIDE_0 : WALL_COLOR_SIDE_1;
      // for (let y = top; y <= bottom; y++) {
        // framePtr += FRAME_STRIDE;
      for (; framePtr < frameLimitPtr; framePtr += FRAME_STRIDE) {
        store<u32>(framePtr, color);
      }
    }

    if (!TEXTURED_FLOOR) {
      // render floor
      frameLimitPtr = frameRowPtrs.at(viewport.Height) + xcolOffs;
      // for (let y = bottom + 1 as u32; y < viewport.Height; y++) {
      for (; framePtr !== frameLimitPtr; framePtr += FRAME_STRIDE) {
        store<u32>(framePtr, FLOOR_COLOR);
      }
    } else {
      const mapWidth = map.Width;
      const posX = player.PosX;
      const posY = player.PosY;
      const posZ = player.PosZ;
      const projYCenter = raycaster.ProjYCenter;
      const wallDistance = wallSlice.Distance;
      const floorWallX = wallSlice.FloorWallX;
      const floorWallY = wallSlice.FloorWallY;
      const floorMap = map.FloorMap;
      const floorMapLength = map.FloorMap.Length as u32;

      let floorMip = changetype<BitImageRGBA>(NULL_PTR);
      let prevFloorMapIdx = -1 as u32;
      let floorMipWidth = 0 as f32;
      let floorMipHeight = 0 as f32;
      let floorMipLg2Pitch = 0 as SIZE_T;

      for (let y = bottom + 1; y < viewport.Height; y++, framePtr += FRAME_STRIDE) {
        const sDist = posZ / ((y - projYCenter) as f32);
        const weight = sDist / wallDistance;
        const floorX = weight * floorWallX + (1 - weight) * posX;
        const floorY = weight * floorWallY + (1 - weight) * posY;
        const floorXidx = floorX as u32;
        const floorYidx = floorY as u32;
        const floorMapIdx = floorYidx * mapWidth + floorXidx;
        const sameFloorTexIdx = floorMapIdx === prevFloorMapIdx;
        if (sameFloorTexIdx || (floorMapIdx < floorMapLength)) {
          if (!sameFloorTexIdx) {
            const floorTexIdx = floorMap.at(floorMapIdx);
            const floorMipIdx = textures.at(floorTexIdx).gMipIdx(0);
            floorMip = mipmaps.at(floorMipIdx);
            prevFloorMapIdx = floorMapIdx;
            floorMipWidth = floorMip.Width as f32;
            floorMipHeight = floorMip.Height as f32;
            floorMipLg2Pitch = floorMip.Lg2Pitch as SIZE_T;
          }
          const u = floorX - (floorXidx as f32);
          const v = floorY - (floorYidx as f32);
          const floorMipX = u32(u * floorMipWidth);
          const floorMipY = u32(v * floorMipHeight);
          const floorMipOffs = ((floorMipX as SIZE_T) << floorMipLg2Pitch) | floorMipY;
          const color = load<u32>(floorMip.Ptr + floorMipOffs * BPP_RGBA);
          store<u32>(framePtr, color);
        // const texIdx = floorYidx * mapWidth + floorXidx;
        // assert(floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length, `floorTexMapIdx: ${floorTexMapIdx}, floorXidx: ${floorXidx}, floorYidx: ${floorYidx}, mapWidth: ${mapWidth}, mapHeight: ${mapHeight}`);
        // const sameFloorTexMapIdx = texIdx === prevTexIdx;
        // const u = floorX - (floorXidx as f32);
        // const v = floorY - (floorYidx as f32);
        // // assert(floorX >= 0 && floorX < 1);
        // // assert(floorY >= 0 && floorY < 1);
        // const texIdx = 14;
        // const tex = mipmaps.at(texIdx);
        // const texX = u32(u * (tex.Width as f32));
        // const texY = u32(v * (tex.Height as f32));
        // const texOffs = ((texX as SIZE_T) << tex.Lg2Pitch) | texY;
        // // assert(colorOffset >= 0 && colorOffset < floorTex.Buf32.length);
        // const color = load<u32>(tex.Ptr + texOffs * BPP_RGBA);
        // // console.log(colorOffset);
        // // console.log('color: ', color);
        // store<u32>(framePtr, color);
        }
      }
    }
  }
}

export { 
  initRender,
  renderViewVert,
};
