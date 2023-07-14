import assert from 'assert';
import { WallSlice } from './wallslice';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { Texture } from './texture';

class DrawParams {
  public screenPtr: number;

  constructor(
    public frameBuf32: Uint32Array,
    public frameStride: number,
    public viewStartX: number,
    public viewStartY: number,
    public viewWidth: number,
    public viewHeight: number,
    public wallTextures: Texture[],
  ) {
    this.screenPtr = viewStartY * frameStride + viewStartX;
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
  wallTextures: Texture[],
) {
  drawParams = new DrawParams(
    frameBuf32,
    frameStride,
    viewStartX,
    viewStartY,
    viewWidth,
    viewHeight,
    wallTextures,
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

function drawSceneV(wallSlices: WallSlice[]) {
  assert(drawParams !== undefined);

  const {
    frameBuf32,
    frameStride,
    screenPtr,
    wallTextures,
    viewHeight: height,
  } = drawParams;

  function drawWallSlice(wallSlice: WallSlice) {
    let {
      ColIdx: colIdx,
      Top: top,
      Bottom: bottom,
      TexId: texId,
      MipLvl: mipLvl,
      TexX: texX,
      TexStepY: texStepY,
      TexPosY: texPosY,
      CachedMipmap: mipmap,
    } = wallSlice;

    // const image = wallTextures[texId].getMipmap(mipLvl);
    const { Width: texWidth, Height: texHeight, PitchLg2: pitchLg2 } = mipmap;

    const colPtr = screenPtr + colIdx;
    let dstPtr = colPtr;
    // dstPtr = colPtr + top * stride; // when no ceiling is drawn

    // // draw ceil
    for (let y = 0; y < top; y++) {
      frameBuf32[dstPtr] = 0xffbbbbbb;
      dstPtr += frameStride;
    }
    // assert(dstPtr === colPtr + top * stride);

    // rem mipmap is rotated 90ccw
    // const mipStride = 1 << pitchLg2;
    const mipColOffs = texX << pitchLg2;
    const { Buf32: mipPixels } = mipmap;

    // // textured wall
    for (let y = top; y < bottom; y++) {
      const texY = texPosY | 0;
      texPosY += texStepY;
      const color = mipPixels[mipColOffs + texY];
      // const color = mipmap.Buf32[texY * texWidth + texX];
      frameBuf32[dstPtr] = color;
      dstPtr += frameStride;
    }

    // solid color
    // for (let y = top; y < bottom; y++) {
    //   frameBuf32[dstPtr] = 0xff0000ff;
    //   dstPtr += frameStride;
    // }

    // draw floor
    // assert(dstPtr === colPtr + bottom * stride);
    for (let y = bottom; y < height; y++) {
      frameBuf32[dstPtr] = 0xff777777;
      dstPtr += frameStride;
    }
  }

  for (const wallSlice of wallSlices) {
    drawWallSlice(wallSlice);
  }

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

export {
  initDrawParams,
  drawBackground,
  drawBorders,
  drawSceneV, 
};

