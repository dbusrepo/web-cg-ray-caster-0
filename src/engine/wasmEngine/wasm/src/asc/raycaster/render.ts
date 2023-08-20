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

let frameColorRGBA = changetype<FrameColorRGBA>(NULL_PTR);
let textures = changetype<SArray<Texture>>(NULL_PTR);
let mipmaps = changetype<SArray<BitImageRGBA>>(NULL_PTR);

const FRAME_STRIDE = rgbaSurface0width * BPP_RGBA;
let startFramePtr: PTR_T = NULL_PTR;

function initRender(infColorRGBA: FrameColorRGBA, inViewport: Viewport, inTextures: SArray<Texture>, inMipmaps: SArray<BitImageRGBA>): void {
  frameColorRGBA = infColorRGBA;
  startFramePtr = rgbaSurface0ptr + inViewport.StartY * FRAME_STRIDE + inViewport.StartX * BPP_RGBA;
  textures = inTextures;
  mipmaps = inMipmaps;
}

const WALL_COLOR_SIDE_0 = FrameColorRGBA.colorABGR(0xff, 0, 0, 0xff);
const WALL_COLOR_SIDE_1 = FrameColorRGBA.colorABGR(0xff, 0, 0, 0x88);
const CEIL_COLOR = FrameColorRGBA.colorABGR(0xff, 0xbb, 0xbb, 0xbb);
const FLOOR_COLOR = FrameColorRGBA.colorABGR(0xff, 0x55, 0x55, 0x55);

function renderViewFullVert(raycaster: Raycaster): void {
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

  let frameColPtr = startFramePtr;

  for (let x: u32 = 0; x < viewport.Width; x++, frameColPtr += BPP_RGBA) {
    let framePtr = frameColPtr;
    const wallSlice = wallSlices.at(x);
    const top = wallSlice.Top;
    const bottom = wallSlice.Bottom;
    const hit = wallSlice.Hit;
    const side = wallSlice.Side;

    // render ceil
    for (let y = 0 as u32; y < top; y++) {
      store<u32>(framePtr, CEIL_COLOR);
      framePtr += FRAME_STRIDE;
    }

    if (hit) {
      // TODO:
      // const tex = textures.at(wallSlice.TexId);
      // const mipmap = tex.getMipmap(wallSlice.MipLvl); // TODO: assert
      const mipmap = mipmaps.at(wallSlice.MipMapIdx);

      const texX = wallSlice.TexX as usize;
      const mipmapRowOffs = texX << mipmap.PitchLg2;
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
      const texStepY_fix = wallSlice.TexStepY * 65536.0 as u32;
      let texY_fix = wallSlice.TexY * 65536.0 as u32;

      for (let y = top; y <= bottom; y++) {
        const texColOffs = texY_fix >> 16;
        const texCol = load<u32>(mipmapPtr + texColOffs * BPP_RGBA);
        store<u32>(framePtr, texCol);
        framePtr += FRAME_STRIDE;
        texY_fix += texStepY_fix;
      }
    } else {
      // render empty wall
      const color = side == 0 ? WALL_COLOR_SIDE_0 : WALL_COLOR_SIDE_1;
      for (let y = top; y <= bottom; y++) {
        store<u32>(framePtr, color);
        framePtr += FRAME_STRIDE;
      }
    }

    // render floor
    for (let y = bottom + 1 as u32; y < viewport.Height; y++) {
      store<u32>(framePtr, FLOOR_COLOR);
      framePtr += FRAME_STRIDE;
    }
  }
}

export { 
  initRender,
  renderViewFullVert,
};
