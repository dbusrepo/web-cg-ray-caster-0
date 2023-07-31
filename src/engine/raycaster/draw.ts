import assert from 'assert';
import { WallSlice } from './wallslice';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { Texture } from './texture';
import { FrameColorRGBAWasm } from '../wasmEngine/frameColorRGBAWasm';

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
    public floorTexturesMap: Texture[],
    public frameColorRGBAWasm: FrameColorRGBAWasm,
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

type DrawSceneVParams = {
  wallSlices: WallSlice[];
  colStart: number;
  colEnd: number;
  posX: number;
  posY: number;
  mapWidth: number;
  mapHeight: number;
  midY: number;
};

function drawSceneVert(drawVertParams: DrawSceneVParams) {
  assert(drawParams !== undefined);

  const {
    frameColorRGBAWasm,
    frameBuf32,
    frameStride,
    screenPtr,
    // wallTextures,
    viewWidth: width,
    viewHeight: height,
  } = drawParams;

  const { wallSlices, colStart, colEnd, midY } = drawVertParams;

  for (let i = colStart; i < colEnd; i++) {
    const { Hit: hit, Top: top, Bottom: bottom } = wallSlices[i];

    const colPtr = screenPtr + i;
    let dstPtr = colPtr;
    // dstPtr = colPtr + top * stride; // when no ceiling is drawn

    // if (!hit) {
    //   // draw ceil
    //
    //   // for (let y = 0; y < midY; y++) {
    //   //   frameBuf32[dstPtr] = 0xffbbbbbb;
    //   //   dstPtr += frameStride;
    //   // }
    //   // // assert(dstPtr === colPtr + top * stride);
    //
    //   // draw floor
    //   // for (let y = midY; y < height; y++) {
    //   //   frameBuf32[dstPtr] = 0xff777777;
    //   //   dstPtr += frameStride;
    //   // }
    //
    //   for (let y = 0; y < top; y++) {
    //     frameBuf32[dstPtr] = 0xffbbbbbb;
    //     dstPtr += frameStride;
    //   }
    //
    //   for (let y = top; y < bottom; y++) {
    //     frameBuf32[dstPtr] = 0xff000000;
    //     dstPtr += frameStride;
    //   }
    //
    //   for (let y = bottom; y < height; y++) {
    //     frameBuf32[dstPtr] = 0xff777777;
    //     dstPtr += frameStride;
    //   }
    //
    //   // assert(dstPtr === colPtr + height * stride);
    //   continue;
    // }

    // if (hit) {

    // // draw ceil
    for (let y = 0; y < top; y++) {
      frameBuf32[dstPtr] = 0xffbbbbbb;
      dstPtr += frameStride;
    }
    // assert(dstPtr === colPtr + top * stride);

    let {
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
    } = wallSlices[i];

    const { posX, posY, mapWidth, mapHeight } = drawVertParams;

    if (hit) {
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
        // color = frameColorRGBAWasm.lightColorABGR(color, 255);
        frameBuf32[dstPtr] = color;
        // frameColorRGBAWasm.lightPixel(frameBuf32, dstPtr, 120);
        dstPtr += frameStride;
      }
    } else {
      // no hit untextured wall
      const color = side === 0 ? 0xff0000ff : 0xff00ff00;
      for (let y = top; y < bottom; y++) {
        frameBuf32[dstPtr] = color;
        dstPtr += frameStride;
      }

      // dstPtr += frameStride * (bottom - top);
    }

    // assert(bottom >= 0); // TODO: remove?
    // assert(dstPtr === colPtr + bottom * frameStride);

    const SOLID_FLOOR = false;

    if (!SOLID_FLOOR) {
      // draw textured floor
      // for (let y = bottom + 1; y <= height; y++) {
      //   frameBuf32[dstPtr] = 0xff777777;
      //   dstPtr += frameStride;
      // }
      const { floorTexturesMap } = drawParams;
      for (let y = bottom + 1; y <= height; y++) {
        // y in [bottom + 1, height], dist in [1, +inf), dist == 1 when y == height
        const dist = height / (2.0 * y - height);
        let weight = dist / wallDistance;
        // assert(weight >= 0);
        // assert(weight <= 1);
        let floorX = weight * floorWallX + (1 - weight) * posX;
        let floorY = weight * floorWallY + (1 - weight) * posY;
        const floorXidx = floorX | 0;
        const floorYidx = floorY | 0;
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
        // assert(floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length);
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
      for (let y = bottom; y < height; y++) {
        frameBuf32[dstPtr] = 0xff777777;
        dstPtr += frameStride;
      }
    }

    // } else {
      // // wall solid color
      // for (let y = top; y < bottom; y++) {
      //   frameBuf32[dstPtr] = 0xff000000;
      //   dstPtr += frameStride;
      // }
      //
      // // draw solid floor
      // // assert(dstPtr === colPtr + bottom * stride);
      // for (let y = bottom; y < height; y++) {
      //   frameBuf32[dstPtr] = 0xff777777;
      //   dstPtr += frameStride;
      // }
    // }

    assert(dstPtr === colPtr + height * frameStride);

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
  drawSceneVert,
};
