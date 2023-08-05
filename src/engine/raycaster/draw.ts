import assert from 'assert';
import { WallSlice } from './wallslice';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { Texture } from './texture';
import { FrameColorRGBAWasm } from '../wasmEngine/frameColorRGBAWasm';

const CEIL_COLOR = 0xffbbbbbb;
const FLOOR_COLOR = 0xff777777;

class DrawParams {
  public startFrameViewPtr: number;

  constructor(
    public frameBuf32: Uint32Array,
    public frameStride: number,
    public viewStartX: number,
    public viewStartY: number,
    public viewWidth: number,
    public viewHeight: number,
    public wallTextures: Texture[][],
    public floorTexturesMap: Texture[],
    public frameColorRGBAWasm: FrameColorRGBAWasm,
  ) {
    this.startFrameViewPtr = viewStartY * frameStride + viewStartX;
  }
}

let drawParams: DrawParams;

function initDrawParams(
  frameBuf32: Uint32Array,
  frameStride: number,
  viewStartX: number,
  viewStartY: number,
  viewWidth: number,
  viewHeight: number,
  wallTextures: Texture[][],
  floorTexturesMap: Texture[],
  frameColorRGBAWasm: FrameColorRGBAWasm,
) {
  drawParams = new DrawParams(
    frameBuf32,
    frameStride,
    viewStartX,
    viewStartY,
    viewWidth,
    viewHeight,
    wallTextures,
    floorTexturesMap,
    frameColorRGBAWasm,
  );
}

function drawBackground(color: number) {
  assert(drawParams !== undefined);

  const {
    frameBuf32,
    frameStride: stride,
    viewStartX: startX,
    viewStartY: startY,
    viewWidth: width,
    viewHeight: height,
  } = drawParams;

  for (
    let i = startY, offset = startY * stride;
    i < startY + height;
    i++, offset += stride
  ) {
    frameBuf32.fill(color, offset + startX, offset + startX + width);
  }
}

function drawBorders(borderColor: number) {
  assert(drawParams !== undefined);

  const {
    frameBuf32,
    frameStride: stride,
    viewStartX: startX,
    viewStartY: startY,
    viewWidth: width,
    viewHeight: height,
  } = drawParams;

  const upperLimit = startY * stride;
  const lowerLimit = (startY + height) * stride;

  frameBuf32.fill(borderColor, 0, upperLimit);
  frameBuf32.fill(borderColor, lowerLimit, frameBuf32.length);

  for (
    let i = startY, offset = startY * stride;
    i < startY + height;
    i++, offset += stride
  ) {
    frameBuf32.fill(borderColor, offset, offset + startX);
    frameBuf32.fill(borderColor, offset + startX + width, offset + stride);
  }
}

type DrawSceneParams = {
  wallSlices: WallSlice[];
  colStart: number;
  colEnd: number;
  posX: number;
  posY: number;
  mapWidth: number;
  mapHeight: number;
  midY: number;
  minWallTop: number;
  maxWallBottom: number;
  viewerHeight: number;
};

function drawSceneVert(drawSceneParams: DrawSceneParams) {
  const {
    frameColorRGBAWasm,
    frameBuf32,
    frameStride,
    startFrameViewPtr,
    // wallTextures,
    viewWidth: width,
    viewHeight: height,
  } = drawParams;

  const {
    wallSlices,
    colStart,
    colEnd,
    posX,
    posY,
    mapWidth,
    viewerHeight,
    midY,
    minWallTop,
    maxWallBottom,
  } = drawSceneParams;

  for (let x = colStart; x < colEnd; x++) {
    let {
      Hit: hit,
      Top: top,
      Bottom: bottom,
      Side: side,
      // TexId: texId,
      // MipLvl: mipLvl,
      TexX: texX,
      TexStepY: texStepY,
      TexPosY: texPosY,
      CachedMipmap: mipmap,
      Distance: wallDistance,
      FloorWallX: floorWallX,
      FloorWallY: floorWallY,
    } = wallSlices[x];

    const colPtr = startFrameViewPtr + x;
    let dstPtr = colPtr;

    // draw ceil
    for (let y = 0; y < top; y++) {
      frameBuf32[dstPtr] = CEIL_COLOR;
      dstPtr += frameStride;
    }

    // assert(dstPtr === colPtr + top * frameStride);

    if (hit) {
      // const mipmap = wallTextures[texId].getMipmap(mipLvl);
      const {
        Buf32: mipPixels,
        // Width: texWidth,
        // Height: texHeight,
        PitchLg2: pitchLg2,
      } = mipmap;

      // rem mipmap is rotated 90ccw
      // const mipStride = 1 << pitchLg2;
      const mipRowOffs = texX << pitchLg2;

      // textured wall
      for (let y = top; y <= bottom; y++) {
        const texColOffs = texPosY | 0;
        let color = mipPixels[mipRowOffs + texColOffs];
        // const color = mipmap.Buf32[texY * texWidth + texX];
        // color = frameColorRGBAWasm.lightColorABGR(color, 255);
        frameBuf32[dstPtr] = color;
        // frameColorRGBAWasm.lightPixel(frameBuf32, dstPtr, 120);
        dstPtr += frameStride;
        texPosY += texStepY;
      }
    } else {
      // no hit untextured wall
      const color = side === 0 ? 0xff0000ff : 0xff00ff00;
      for (let y = top; y <= bottom; y++) {
        frameBuf32[dstPtr] = color;
        dstPtr += frameStride;
      }
    }

    // assert(dstPtr === colPtr + (bottom + 1) * frameStride);

    const SOLID_FLOOR = false;

    if (!SOLID_FLOOR) {
      // draw textured floor
      // for (let y = bottom + 1; y <= height; y++) {
      //   frameBuf32[dstPtr] = 0xff777777;
      //   dstPtr += frameStride;
      // }
      const { floorTexturesMap } = drawParams;
      for (let y = bottom + 1; y < height; y++) {
        // y in [bottom + 1, height), dist in [1, +inf), dist == 1 when y == height
        const dist = viewerHeight / (y - midY);
        let weight = dist / wallDistance;
        // assert(weight >= 0);
        // assert(weight <= 1);
        let floorX = weight * floorWallX + (1 - weight) * posX;
        let floorY = weight * floorWallY + (1 - weight) * posY;
        const floorXidx = floorX | 0;
        const floorYidx = floorY | 0;
        // assert(floorXidx >= 0 && floorXidx < mapWidth, `floorXidx: ${floorXidx}, floorX: ${floorX}, weight: ${weight}, floorWallX: ${floorWallX}, posX: ${posX}`);
        // const floorXidx = floorX | 0;
        // const floorYidx = floorY | 0;
        // if (
        //   floorXidx < 0 ||
        //   floorXidx >= mapWidth ||
        //   floorYidx < 0 ||
        //   floorYidx >= mapHeight
        // ) {
        //   continue;
        // }
        // const floorTexMapIdx = floorYidx * mapWidth + floorXidx;
        // assert(floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length);
        const floorTexMapIdx = floorYidx * mapWidth + floorXidx;
        // assert(floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length, `floorTexMapIdx: ${floorTexMapIdx}, floorXidx: ${floorXidx}, floorYidx: ${floorYidx}, mapWidth: ${mapWidth}, mapHeight: ${mapHeight}`);
        if (floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length) {
          const floorTex = floorTexturesMap[floorTexMapIdx].getMipmap(0);
          floorX -= floorXidx;
          floorY -= floorYidx;
          // assert(floorX >= 0 && floorX < 1);
          // assert(floorY >= 0 && floorY < 1);
          const floorTexX = (floorX * floorTex.Width) | 0;
          const floorTexY = (floorY * floorTex.Height) | 0;
          const colorOffset = (floorTexX << floorTex.PitchLg2) + floorTexY;
          // assert(colorOffset >= 0 && colorOffset < floorTex.Buf32.length);
          const color = floorTex.Buf32[colorOffset];
          // console.log(colorOffset);
          // console.log('color: ', color);
          frameBuf32[dstPtr] = color;
        }
        dstPtr += frameStride;
      }
    } else {
      for (let y = bottom + 1; y < height; y++) {
        frameBuf32[dstPtr] = FLOOR_COLOR;
        dstPtr += frameStride;
      }
    }

    assert(dstPtr === colPtr + height * frameStride);
  }

  // // draw horizontal lines for minWallTop and maxWallBottom
  // const minTopRowPtr = screenPtr + minWallTop * frameStride;
  // const maxBottomRowPtr = screenPtr + maxWallBottom * frameStride;
  // for (let i = colStart; i < colEnd; i++) {
  //   frameBuf32[minTopRowPtr + i] = 0xff0000ff;
  //   frameBuf32[maxBottomRowPtr + i] = 0xff0000ff;
  // }

  // ...
  // const colPtr = drawParams.screenPtr;
  // let scrPtr = colPtr + wallTop * stride;

  // // textured wall
  // for (let y = wallTop; y < wallBottom; y++) {
  //   const texY = texPosY | 0; // + 0.5 | 0;
  //   texPosY += texStepY;
  //   const color = texture.Buf32[texY * texWidth + texX];
  //   frameBuf32[scrPtr] = color;
  //   scrPtr += stride;
  // }

  // // solid color
  // for (let y = wallTop; y < wallBottom; y++) {
  //   frameBuf32[scrPtr] = 0xff0000ff;
  //   scrPtr += stride;
  // }
}

function drawSceneHorz(drawSceneParams: DrawSceneParams) {
  const {
    frameColorRGBAWasm,
    frameBuf32,
    frameStride,
    startFrameViewPtr,
    // wallTextures,
    viewWidth: width,
    viewHeight: height,
  } = drawParams;

  const {
    wallSlices,
    colStart,
    colEnd,
    posX,
    posY,
    mapWidth,
    viewerHeight,
    midY,
    minWallTop,
    maxWallBottom,
  } = drawSceneParams;

  // draw ceiling above walls
  let framePtr = startFrameViewPtr + colStart;
  for (let y = 0; y < minWallTop; y++) {
    for (let x = colStart; x < colEnd; x++) {
      frameBuf32[framePtr++] = CEIL_COLOR;
    }
    framePtr += frameStride - width;
  }

  let saveFramePtr = framePtr;

  // draw walls
  for (let x = colStart; x < colEnd; x++) {
    let {
      Hit: hit,
      Top: top,
      Bottom: bottom,
      TexX: texX,
      TexStepY: texStepY,
      TexPosY: texPosY,
      CachedMipmap: mipmap,
    } = wallSlices[x];

    framePtr = startFrameViewPtr + top * frameStride + x;

    if (hit) {
      const {
        Buf32: mipPixels,
        // Width: texWidth,
        // Height: texHeight,
        PitchLg2: pitchLg2,
      } = mipmap;

      const mipRowOffs = texX << pitchLg2;

      // textured wall
      for (let y = top; y <= bottom; y++) {
        const texColOffs = texPosY | 0;
        const color = mipPixels[mipRowOffs + texColOffs];
        frameBuf32[framePtr] = color;
        texPosY += texStepY;
        framePtr += frameStride;
      }
    } else {
      for (let y = top; y <= bottom; y++) {
        frameBuf32[framePtr] = 0xff0000ff;
        framePtr += frameStride;
      }
    }
  }

  // draw ceil/floor between walls
  framePtr = startFrameViewPtr + minWallTop * frameStride;

  for (let y = minWallTop; y < midY; y++) {
    for (let x = colStart; x < colEnd; x++) {
      const wallSlice = wallSlices[x];
      if (!(y >= wallSlice.Top && y <= wallSlice.Bottom)) {
        // const mipRowOffs = wallSlice.TexX << wallSlice.CachedMipmap.PitchLg2;
        // const texColOffs = wallSlice.TexPosY | 0;
        // wallSlices[x].TexPosY = wallSlice.TexPosY + wallSlice.TexStepY;
        // color = wallSlice.CachedMipmap.Buf32[mipRowOffs | texColOffs];
        // color = mipmap.Buf32[(texX << mipmap.PitchLg2) | (texPosY | 0)];
        frameBuf32[framePtr + x] = CEIL_COLOR;
      }
    }
    framePtr += frameStride;
  }

  for (let y = midY + 1; y <= maxWallBottom; y++) {
    for (let x = colStart; x < colEnd; x++) {
      const wallSlice = wallSlices[x];
      if (!(y >= wallSlice.Top && y <= wallSlice.Bottom)) {
        frameBuf32[framePtr + x] = FLOOR_COLOR;
      }
    }
    framePtr += frameStride;
  }

  // draw floor below walls
  framePtr = startFrameViewPtr + (maxWallBottom + 1) * frameStride + colStart;
  for (let y = maxWallBottom + 1; y < height; y++) {
    for (let x = colStart; x < colEnd; x++) {
      frameBuf32[framePtr++] = FLOOR_COLOR;
    }
    framePtr += frameStride - width;
  }
}

export {
  DrawParams,
  initDrawParams,
  drawBackground,
  drawBorders,
  DrawSceneParams,
  drawSceneVert,
  drawSceneHorz,
};
