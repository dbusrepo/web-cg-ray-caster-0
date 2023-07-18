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
    public wallTextures: Texture[][],
    public floorTextures: Texture[],
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
  wallTextures: Texture[][],
  floorTextures: Texture[],
) {
  drawParams = new DrawParams(
    frameBuf32,
    frameStride,
    viewStartX,
    viewStartY,
    viewWidth,
    viewHeight,
    wallTextures,
    floorTextures,
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

type DrawSceneVParams = {
  wallSlices: WallSlice[];
  colStart: number;
  colEnd: number;
  posX: number;
  posY: number;
};

function drawSceneV(drawVParams: DrawSceneVParams) {
  assert(drawParams !== undefined);

  const {
    frameBuf32,
    frameStride,
    screenPtr,
    // wallTextures,
    viewWidth: width,
    viewHeight: height,
  } = drawParams;

  const { wallSlices, colStart, colEnd } = drawVParams;

  for (let i = colStart; i < colEnd; i++) {
    const { Hit: hit, Top: top, Bottom: bottom } = wallSlices[i];

    const colPtr = screenPtr + i;
    let dstPtr = colPtr;
    // dstPtr = colPtr + top * stride; // when no ceiling is drawn

    // // draw ceil
    for (let y = 0; y < top; y++) {
      frameBuf32[dstPtr] = 0xffbbbbbb;
      dstPtr += frameStride;
    }
    // assert(dstPtr === colPtr + top * stride);

    if (hit) {
      let {
        // Side: side,
        // TexId: texId,
        // MipLvl: mipLvl,
        TexX: texX,
        TexStepY: texStepY,
        TexPosY: texPosY,
        CachedMipmap: mipmap,
        Distance: wallDistance,
        floorWallX,
        floorWallY,
      } = wallSlices[i];

      const { floorTextures } = drawParams;
      const { posX, posY } = drawVParams;

      // const mipmap = wallTextures[texId].getMipmap(mipLvl);
      const { Width: texWidth, Height: texHeight, PitchLg2: pitchLg2 } = mipmap;

      // rem mipmap is rotated 90ccw
      // const mipStride = 1 << pitchLg2;
      const mipColOffs = texX << pitchLg2;
      const { Buf32: mipPixels } = mipmap;

      // textured wall
      for (let y = top; y < bottom; y++) {
        const texY = texPosY | 0;
        texPosY += texStepY;
        let color = mipPixels[mipColOffs + texY];
        // const color = mipmap.Buf32[texY * texWidth + texX];
        frameBuf32[dstPtr] = color;
        dstPtr += frameStride;
      }

      assert(bottom >= 0); // TODO: remove?

      // draw textured floor
      assert(dstPtr === colPtr + bottom * frameStride);

      const sliceHeight = bottom - top;
      if (sliceHeight < height) {
        // console.log(posX, posY, floorWallX, floorWallY, distance);

        const floorTex = floorTextures[0].getMipmap(0);

        // assert(bottom >= height || wallDistance > 1);
        assert(wallDistance >= 1);

        for (let y = bottom + 1; y <= height; y++) {
          // y in [bottom + 1, height], dist in [1, +inf)
          const dist = height / (2.0 * y - height);
          let weight = dist / wallDistance;
          // assert(weight >= 0);
          // assert(weight <= 1);
          let floorX = weight * floorWallX + (1 - weight) * posX;
          let floorY = weight * floorWallY + (1 - weight) * posY;
          floorX -= floorX | 0;
          floorY -= floorY | 0;
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
          dstPtr += frameStride;
        }
      } else {
        for (let y = bottom; y < height; y++) {
          frameBuf32[dstPtr] = 0xff777777;
          dstPtr += frameStride;
        }
      }

    } else {
      // wall solid color
      for (let y = top; y < bottom; y++) {
        frameBuf32[dstPtr] = 0xff000000;
        dstPtr += frameStride;
      }

      // draw solid floor
      // assert(dstPtr === colPtr + bottom * stride);
      for (let y = bottom; y < height; y++) {
        frameBuf32[dstPtr] = 0xff777777;
        dstPtr += frameStride;
      }
    }

    // draw textured floor
    // assert(dstPtr === colPtr + bottom * stride);
    // const distWall = hit ? hit.Dist : 0;
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
  DrawParams,
  initDrawParams,
  drawBackground,
  drawBorders,
  DrawSceneVParams,
  drawSceneV,
};
