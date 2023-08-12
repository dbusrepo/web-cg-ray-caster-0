import assert from 'assert';
import { WallSlice } from './wallslice';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { Texture } from './texture';
import { FrameColorRGBAWasm } from '../wasmEngine/frameColorRGBAWasm';

const CEIL_COLOR = 0xffbbbbbb;
const FLOOR_COLOR = 0xff555555;

class DrawParams {
  public startFramePtr: number;

  public frameRowPtrs: Uint32Array;

  // used with horz floor span rend
  public initrhspans: Int32Array;
  public lhspans: Int32Array;
  public rhspans: Int32Array;
  public stepXhspans: Float32Array;
  public stepYhspans: Float32Array;
  public lfloorXhspans: Float32Array;
  public lfloorYhspans: Float32Array;

  public tops: Int32Array;
  public bottoms: Int32Array;
  public texXs: Int32Array;
  public texStepYs: Float32Array;
  public texPosYs: Float32Array;

  constructor(
    public frameBuf32: Uint32Array,
    public frameStride: number,
    public vpStartX: number,
    public vpStartY: number,
    public vpWidth: number,
    public vpHeight: number,
    public floorTexturesMap: Texture[],
    public frameColorRGBAWasm: FrameColorRGBAWasm,
  ) {
    this.startFramePtr = vpStartY * frameStride + vpStartX;

    this.frameRowPtrs = new Uint32Array(vpHeight);
    for (let i = 0; i < vpHeight; i++) {
      this.frameRowPtrs[i] = this.startFramePtr + i * frameStride;
    }

    this.initrhspans = new Int32Array(vpHeight);
    for (let i = 0; i < vpHeight; i++) {
      this.initrhspans[i] = -2;
    }
    this.lhspans = new Int32Array(vpHeight);
    this.rhspans = new Int32Array(vpHeight);
    this.stepXhspans = new Float32Array(vpHeight);
    this.stepYhspans = new Float32Array(vpHeight);
    this.lfloorXhspans = new Float32Array(vpHeight);
    this.lfloorYhspans = new Float32Array(vpHeight);

    this.tops = new Int32Array(vpWidth);
    this.bottoms = new Int32Array(vpWidth);
    this.texXs = new Int32Array(vpWidth);
    this.texStepYs = new Float32Array(vpWidth);
    this.texPosYs = new Float32Array(vpWidth);
  }
}

let drawParams: DrawParams;

function initDrawParams(
  frameBuf32: Uint32Array,
  frameStride: number,
  vpStartX: number,
  vpStartY: number,
  vpWidth: number,
  vpHeight: number,
  floorTexturesMap: Texture[],
  frameColorRGBAWasm: FrameColorRGBAWasm,
) {
  drawParams = new DrawParams(
    frameBuf32,
    frameStride / BPP_RGBA,
    vpStartX,
    vpStartY,
    vpWidth,
    vpHeight,
    floorTexturesMap,
    frameColorRGBAWasm,
  );
}

function drawBackground(color: number) {
  assert(drawParams !== undefined);

  const { frameBuf32, frameStride, vpStartX, vpStartY, vpWidth, vpHeight } =
    drawParams;

  for (
    let i = vpStartY, offset = vpStartY * frameStride;
    i < vpStartY + vpHeight;
    i++, offset += frameStride
  ) {
    frameBuf32.fill(color, offset + vpStartX, offset + vpStartX + vpWidth);
  }
}

function drawBorders(borderColor: number) {
  assert(drawParams !== undefined);

  const { frameBuf32, frameStride, vpStartX, vpStartY, vpWidth, vpHeight } =
    drawParams;

  const upperLimit = vpStartY * frameStride;
  const lowerLimit = (vpStartY + vpHeight) * frameStride;

  frameBuf32.fill(borderColor, 0, upperLimit);
  frameBuf32.fill(borderColor, lowerLimit, frameBuf32.length);

  for (
    let i = vpStartY, offset = vpStartY * frameStride;
    i < vpStartY + vpHeight;
    i++, offset += frameStride
  ) {
    frameBuf32.fill(borderColor, offset, offset + vpStartX);
    frameBuf32.fill(
      borderColor,
      offset + vpStartX + vpWidth,
      offset + frameStride,
    );
  }
}

type DrawViewParams = {
  posX: number;
  posY: number;
  posZ: number;
  dirX: number;
  dirY: number;
  planeX: number;
  planeY: number;
  wallSlices: WallSlice[];
  mapWidth: number;
  mapHeight: number;
  projYcenter: number;
  minWallTop: number;
  maxWallTop: number;
  minWallBottom: number;
  maxWallBottom: number;
};

function drawViewVert(drawViewParams: DrawViewParams) {
  const {
    frameBuf32,
    frameStride,
    startFramePtr,
    vpWidth,
    vpHeight,
    // frameColorRGBAWasm,
  } = drawParams;

  const {
    posX,
    posY,
    posZ,
    wallSlices,
    mapWidth,
    projYcenter,
    // minWallTop,
    // maxWallBottom,
  } = drawViewParams;

  for (let x = 0; x < vpWidth; x++) {
    let {
      Hit: hit,
      Top: top,
      Bottom: bottom,
      Side: side,
      // TexId: texId,
      // MipLvl: mipLvl,
      TexX: texX,
      TexY: texY,
      TexStepY: texStepY,
      Distance: wallDistance,
      FloorWallX: floorWallX,
      FloorWallY: floorWallY,
      Mipmap: mipmap,
      clipTop,
      projHeight,
    } = wallSlices[x];

    const colPtr = startFramePtr + x;
    let framePtr = colPtr;

    // draw ceil
    for (let y = 0; y < top; y++) {
      frameBuf32[framePtr] = CEIL_COLOR;
      framePtr += frameStride;
    }

    // assert(dstPtr === colPtr + top * frameStride);

    if (hit) {
      const {
        Buf32: mipPixels,
        Width: texWidth,
        // Height: texHeight,
        PitchLg2: pitchLg2,
      } = mipmap;

      // mipmap is rotated 90ccw
      // const mipStride = 1 << pitchLg2;
      const mipRowOffs = texX << pitchLg2;

      let numPixels = bottom - top + 1;

      // wall alg1: bres
      // const frac = texWidth;
      // let counter = -projHeight + clipTop * frac;
      // let colIdx = mipRowOffs;
      // let color = mipPixels[colIdx];
      // while (numPixels--) {
      //   while (counter >= 0) {
      //     counter -= projHeight;
      //     colIdx++;
      //     color = mipPixels[colIdx];
      //   }
      //   frameBuf32[framePtr] = color;
      //   counter += frac;
      //   framePtr += frameStride;
      // }

      // // wall alg2: dda
      for (let y = top; y <= bottom; y++) {
        const texColOffs = texY | 0;
        let color = mipPixels[mipRowOffs + texColOffs];
        // const color = mipmap.Buf32[texY * texWidth + texX];
        // color = frameColorRGBAWasm.lightColorABGR(color, 255);
        frameBuf32[framePtr] = color;
        // frameColorRGBAWasm.lightPixel(frameBuf32, dstPtr, 120);
        texY += texStepY;
        framePtr += frameStride;
      }

      // wall alg3: dda fixed
      // const texStepY_fix = wallSlice.TexStepY * 65536.0 as u32;
      // let texY_fix = wallSlice.TexY * 65536.0 as u32;

      // wall alg4: dda when min, bres when mag
      // if (projHeight <= texWidth) {
      //   for (let y = top; y <= bottom; y++) {
      //     const texColOffs = texY | 0;
      //     let color = mipPixels[mipRowOffs + texColOffs];
      //     // const color = mipmap.Buf32[texY * texWidth + texX];
      //     // color = frameColorRGBAWasm.lightColorABGR(color, 255);
      //     frameBuf32[framePtr] = color;
      //     // frameColorRGBAWasm.lightPixel(frameBuf32, dstPtr, 120);
      //     texY += texStepY;
      //     framePtr += frameStride;
      //   }
      // } else {
      //   const frac = texWidth;
      //   let counter = -projHeight + clipTop * frac;
      //   let colIdx = mipRowOffs;
      //   let color = mipPixels[colIdx];
      //   while (numPixels--) {
      //     while (counter >= 0) {
      //       counter -= projHeight;
      //       colIdx++;
      //       color = mipPixels[colIdx];
      //     }
      //     frameBuf32[framePtr] = color;
      //     counter += frac;
      //     framePtr += frameStride;
      //   }
      //   // // prev version:
      //   // // const frac = texWidth;
      //   // // let counter = (clipTop * frac) % projHeight;
      //   // // let colIdx = mipRowOffs + (texY | 0);
      //   // // let color = mipPixels[colIdx];
      //   // // while (numPixels--) {
      //   // //   frameBuf32[framePtr] = color;
      //   // //   counter += frac;
      //   // //   while (counter >= projHeight) {
      //   // //     counter -= projHeight;
      //   // //     colIdx++;
      //   // //     color = mipPixels[colIdx];
      //   // //   }
      //   // //   framePtr += frameStride;
      //   // // }
      // }
    } else {
      // no hit untextured wall
      const color = side === 0 ? 0xff0000ff : 0xff00ff00;
      for (let y = top; y <= bottom; y++) {
        frameBuf32[framePtr] = color;
        framePtr += frameStride;
      }
    }

    // assert(dstPtr === colPtr + (bottom + 1) * frameStride);

    const SOLID_FLOOR = true;

    if (!SOLID_FLOOR) {
      // draw textured floor
      // for (let y = bottom + 1; y <= height; y++) {
      //   frameBuf32[dstPtr] = 0xff777777;
      //   dstPtr += frameStride;
      // }
      const { floorTexturesMap } = drawParams;
      let prevFloorTexMapIdx = null;
      let floorTex;
      for (let y = bottom + 1; y < vpHeight; y++) {
        // y in [bottom + 1, height), dist in [1, +inf), dist == 1 when y == height
        const dist = posZ / (y - projYcenter);
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
        const sameFloorTexMapIdx = floorTexMapIdx === prevFloorTexMapIdx;
        if (
          sameFloorTexMapIdx ||
          (floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length)
        ) {
          if (!sameFloorTexMapIdx) {
            floorTex = floorTexturesMap[floorTexMapIdx].getMipmap(0);
            prevFloorTexMapIdx = floorTexMapIdx;
          }
          const tex = floorTex!;
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(floorX >= 0 && floorX < 1);
          // assert(floorY >= 0 && floorY < 1);
          const floorTexX = u * tex.Width;
          const floorTexY = v * tex.Height;
          const colorOffset = (floorTexX << tex.PitchLg2) | floorTexY;
          // assert(colorOffset >= 0 && colorOffset < floorTex.Buf32.length);
          const color = tex.Buf32[colorOffset];
          // console.log(colorOffset);
          // console.log('color: ', color);
          frameBuf32[framePtr] = color;
        }
        framePtr += frameStride;
      }
    } else {
      for (let y = bottom + 1; y < vpHeight; y++) {
        frameBuf32[framePtr] = FLOOR_COLOR;
        framePtr += frameStride;
      }
    }

    assert(framePtr === colPtr + vpHeight * frameStride);
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

function drawViewVertHorz(drawViewParams: DrawViewParams) {
  const {
    frameColorRGBAWasm,
    frameBuf32,
    frameStride,
    startFramePtr,
    // wallTextures,
    vpWidth,
    vpHeight,
    floorTexturesMap,
    initrhspans,
    lhspans,
    rhspans,
    stepXhspans,
    stepYhspans,
    lfloorXhspans,
    lfloorYhspans,
    frameRowPtrs,
  } = drawParams;

  const {
    posX,
    posY,
    posZ,
    dirX,
    dirY,
    planeX,
    planeY,
    wallSlices,
    projYcenter,
    mapWidth,
    mapHeight,
    minWallTop,
    maxWallTop,
    minWallBottom,
    maxWallBottom,
  } = drawViewParams;

  const drawCeilHSpan = (y: number, x1: number, x2: number) => {
    let frameRowPtr = startFramePtr + frameRowPtrs[y] + x1;
    for (let x = x1; x <= x2; x++) {
      frameBuf32[frameRowPtr++] = CEIL_COLOR;
    }
  };

  const drawFloorHSpan = (y: number, x1: number, x2: number) => {
    let frameRowPtr = startFramePtr + frameRowPtrs[y] + x1;
    const TEXTURED_FLOOR = true;
    if (!TEXTURED_FLOOR) {
      for (let x = x1; x <= x2; x++) {
        frameBuf32[frameRowPtr++] = FLOOR_COLOR;
      }
    } else {
      // draw textured floor
      const stepX = stepXhspans[y];
      const stepY = stepYhspans[y];
      let floorX = lfloorXhspans[y] + x1 * stepX;
      let floorY = lfloorYhspans[y] + x1 * stepY;
      let prevFloorTexMapIdx = null;
      let floorTex;
      for (let x = x1; x <= x2; x++) {
        const floorXidx = floorX | 0;
        const floorYidx = floorY | 0;
        const floorTexMapIdx = floorYidx * mapWidth + floorXidx;
        // assert(
        //   floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length,
        //   `floorX: ${floorX} floorY: ${floorY} x1: ${x1} x2: ${x2} y: ${y}`,
        //   // `flooorX: ${floorX} floorY: ${floorY}`,
        //   // `floorTexMapIdx: ${floorTexMapIdx} floorXidx: ${floorXidx} floorYidx: ${floorYidx}
        //   //  flooorX: ${floorX} floorY: ${floorY}`,
        // );
        const sameFloorTexMapIdx = floorTexMapIdx === prevFloorTexMapIdx;
        if (
          sameFloorTexMapIdx ||
          (floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length)
        ) {
          if (!sameFloorTexMapIdx) {
            prevFloorTexMapIdx = floorTexMapIdx;
            floorTex = floorTexturesMap[floorTexMapIdx].getMipmap(0);
          }
          const tex = floorTex!;
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(u >= 0 && u < 1);
          // assert(v >= 0 && v < 1);
          const floorTexX = u * tex.Width;
          const floorTexY = v * tex.Height;
          const colorOffset = (floorTexX << tex.PitchLg2) | floorTexY;
          // assert(colorOffset >= 0 && colorOffset < floorTex.Buf32.length);
          const color = tex.Buf32[colorOffset];
          // console.log(colorOffset);
          // console.log('color: ', color);
          frameBuf32[frameRowPtr] = color;
        }
        frameRowPtr++;
        floorX += stepX;
        floorY += stepY;
      }
    }
  };

  rhspans.set(initrhspans);

  const rayDirLeftX = dirX - planeX;
  const rayDirLeftY = dirY - planeY;
  const rayDirRightX = dirX + planeX;
  const rayDirRightY = dirY + planeY;
  const invWidth = 1 / vpWidth;
  const rayStepX = (rayDirRightX - rayDirLeftX) * invWidth;
  const rayStepY = (rayDirRightY - rayDirLeftY) * invWidth;

  for (let y = minWallBottom + 1; y < vpHeight; ++y) {
    const yd = y - projYcenter;
    const sDist = posZ / yd;
    lfloorXhspans[y] = posX + sDist * rayDirLeftX;
    lfloorYhspans[y] = posY + sDist * rayDirLeftY;
    stepXhspans[y] = sDist * rayStepX;
    stepYhspans[y] = sDist * rayStepY;
  }

  // draw horz ceiling above walls
  for (let y = 0; y < minWallTop; y++) {
    drawCeilHSpan(y, 0, vpWidth - 1);
  }

  let frameColPtr = startFramePtr;

  // draw walls vertically
  for (let x = 0; x < vpWidth; x++, frameColPtr++) {
    let {
      Hit: hit,
      Top: top,
      Bottom: bottom,
      TexX: texX,
      TexStepY: texStepY,
      TexY: texPosY,
      Mipmap: mipmap,
    } = wallSlices[x];

    let framePtr = frameColPtr + frameRowPtrs[minWallTop];

    for (let y = minWallTop; y < top; y++) {
      frameBuf32[framePtr] = CEIL_COLOR;
      framePtr += frameStride;
    }

    // framePtr = frameColPtr + frameRowPtrs[top];

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

    for (let y = bottom + 1; y <= maxWallBottom; y++) {
      // check if we can extend the horizontal span
      if (x === rhspans[y] + 1) {
        rhspans[y] = x;
      } else {
        // we can't extend the horizontal span, so draw it and start a new one
        drawFloorHSpan(y, lhspans[y], rhspans[y]);
        lhspans[y] = rhspans[y] = x;
      }
    }
  }

  // // draw ceil spans that were not closed
  // for (let y = minWallTop; y < maxWallTop; y++) {
  //   // assert(hspans[y] === 1);
  //   drawCeilHSpan(y, lhspans[y], rhspans[y]);
  // }


  // draw floor spans that were not closed
  for (let y = minWallBottom + 1; y <= maxWallBottom; y++) {
    // assert(hspans[y] === 1);
    drawFloorHSpan(y, lhspans[y], rhspans[y]);
  }

  // draw horz floor below walls
  for (let y = maxWallBottom + 1; y < vpHeight; y++) {
    drawFloorHSpan(y, 0, vpWidth - 1);
  }

  // let framePtr;
  //
  // // draw horz line at minWallTop
  // framePtr = startFramePtr + minWallTop * frameStride;
  // for (let x = colStart; x < colEnd; x++) {
  //   frameBuf32[framePtr++] = 0xff00ff00;
  // }
  //
  // // draw horz line at maxWallTop
  // framePtr = startFramePtr + maxWallTop * frameStride;
  // for (let x = colStart; x < colEnd; x++) {
  //   frameBuf32[framePtr++] = 0xff00ff00;
  // }
  //
  // // draw horz line at minWallBottom
  // framePtr = startFramePtr + minWallBottom * frameStride;
  // for (let x = colStart; x < colEnd; x++) {
  //   frameBuf32[framePtr++] = 0xffffff00;
  // }
  //
  // // draw horz line at maxWallBottom
  // framePtr = startFramePtr + maxWallBottom * frameStride;
  // for (let x = colStart; x < colEnd; x++) {
  //   frameBuf32[framePtr++] = 0xffffff00;
  // }

  // draw ceil/floor between walls
  // framePtr = startFrameViewPtr + minWallTop * frameStride;

  // for (let y = minWallTop; y < viewMidY; y++) {
  //   for (let x = colStart; x < colEnd; x++) {
  //     const wallSlice = wallSlices[x];
  //     if (!(y >= wallSlice.Top && y <= wallSlice.Bottom)) {
  //       // const mipRowOffs = wallSlice.TexX << wallSlice.CachedMipmap.PitchLg2;
  //       // const texColOffs = wallSlice.TexPosY | 0;
  //       // wallSlices[x].TexPosY = wallSlice.TexPosY + wallSlice.TexStepY;
  //       // color = wallSlice.CachedMipmap.Buf32[mipRowOffs | texColOffs];
  //       // color = mipmap.Buf32[(texX << mipmap.PitchLg2) | (texPosY | 0)];
  //       frameBuf32[framePtr + x] = CEIL_COLOR;
  //     }
  //   }
  //   framePtr += frameStride;
  // }

  // for (let y = viewMidY + 1; y <= maxWallBottom; y++) {
  //   for (let x = colStart; x < colEnd; x++) {
  //     const wallSlice = wallSlices[x];
  //     if (!(y >= wallSlice.Top && y <= wallSlice.Bottom)) {
  //       frameBuf32[framePtr + x] = FLOOR_COLOR;
  //     }
  //   }
  //   framePtr += frameStride;
  // }

  // draw floor below walls
  // framePtr = startFrameViewPtr + (maxWallBottom + 1) * frameStride + colStart;
  //
  // for (let y = maxWallBottom + 1; y < viewHeight; y++) {
  //   const yd = y - viewMidY;
  //   const sDist = posZ / yd;
  //   const stepX = sDist * (rayDirRightX - rayDirLeftX) * invWidth;
  //   const stepY = sDist * (rayDirRightY - rayDirLeftY) * invWidth;
  //   let floorX = posX + sDist * rayDirLeftX;
  //   let floorY = posY + sDist * rayDirLeftY;
  //   for (let x = colStart; x < colEnd; x++) {
  //     const floorXidx = floorX | 0;
  //     const floorYidx = floorY | 0;
  //     const floorTexMapIdx = floorYidx * mapWidth + floorXidx;
  //     if (floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length) {
  //       const tex = floorTexturesMap[floorTexMapIdx].getMipmap(0);
  //       const u = floorX - floorXidx;
  //       const v = floorY - floorYidx;
  //       // assert(floorX >= 0 && floorX < 1);
  //       // assert(floorY >= 0 && floorY < 1);
  //       const floorTexX = (u * tex.Width) | 0;
  //       const floorTexY = (v * tex.Height) | 0;
  //       const colorOffset = (floorTexX << tex.PitchLg2) | floorTexY;
  //       // assert(colorOffset >= 0 && colorOffset < floorTex.Buf32.length);
  //       const color = tex.Buf32[colorOffset];
  //       // console.log(colorOffset);
  //       // console.log('color: ', color);
  //       frameBuf32[framePtr] = color;
  //     }
  //     framePtr++;
  //     floorX += stepX;
  //     floorY += stepY;
  //   }
  //   framePtr += frameStride - viewWidth;
  // }
}

function drawViewHorz(drawViewParams: DrawViewParams) {
  const {
    frameColorRGBAWasm,
    frameBuf32,
    frameStride,
    startFramePtr,
    // wallTextures,
    vpWidth,
    vpHeight,
    floorTexturesMap,
    stepXhspans,
    stepYhspans,
    lfloorXhspans,
    lfloorYhspans,
    frameRowPtrs,
    tops,
    bottoms,
    texXs,
    texStepYs,
    texPosYs,
  } = drawParams;

  const {
    posX,
    posY,
    posZ,
    dirX,
    dirY,
    planeX,
    planeY,
    wallSlices,
    projYcenter,
    mapWidth,
    mapHeight,
    minWallTop,
    maxWallTop,
    minWallBottom,
    maxWallBottom,
  } = drawViewParams;

  const drawCeilHSpan = (y: number, x1: number, x2: number) => {
    let frameRowPtr = startFramePtr + frameRowPtrs[y] + x1;
    for (let x = x1; x <= x2; x++) {
      frameBuf32[frameRowPtr++] = CEIL_COLOR;
    }
  };

  // const drawFloorHSpan = (y: number, x1: number, x2: number) => {
  //   let frameRowPtr = startFramePtr + frameRowPtrs[y] + x1;
  //   const TEXTURED_FLOOR = true;
  //   if (!TEXTURED_FLOOR) {
  //     for (let x = x1; x <= x2; x++) {
  //       frameBuf32[frameRowPtr++] = FLOOR_COLOR;
  //     }
  //   } else {
  //     // draw textured floor
  //     const stepX = stepXhspans[y];
  //     const stepY = stepYhspans[y];
  //     let floorX = lfloorXhspans[y] + x1 * stepX;
  //     let floorY = lfloorYhspans[y] + x1 * stepY;
  //     let prevFloorTexMapIdx = null;
  //     let floorTex;
  //     for (let x = x1; x <= x2; x++) {
  //       const floorXidx = floorX | 0;
  //       const floorYidx = floorY | 0;
  //       const floorTexMapIdx = floorYidx * mapWidth + floorXidx;
  //       // assert(
  //       //   floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length,
  //       //   `floorTexMapIdx: ${floorTexMapIdx} floorXidx: ${floorXidx} floorYidx: ${floorYidx}
  //       //    flooorX: ${floorX} floorY: ${floorY}`,
  //       // );
  //       const sameFloorTexMapIdx = floorTexMapIdx === prevFloorTexMapIdx;
  //       if (
  //         sameFloorTexMapIdx ||
  //         (floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length)
  //       ) {
  //         if (!sameFloorTexMapIdx) {
  //           prevFloorTexMapIdx = floorTexMapIdx;
  //           floorTex = floorTexturesMap[floorTexMapIdx].getMipmap(0);
  //         }
  //         const tex = floorTex!;
  //         const u = floorX - floorXidx;
  //         const v = floorY - floorYidx;
  //         // assert(u >= 0 && u < 1);
  //         // assert(v >= 0 && v < 1);
  //         const floorTexX = u * tex.Width;
  //         const floorTexY = v * tex.Height;
  //         const colorOffset = (floorTexX << tex.PitchLg2) | floorTexY;
  //         // assert(colorOffset >= 0 && colorOffset < floorTex.Buf32.length);
  //         const color = tex.Buf32[colorOffset];
  //         // console.log(colorOffset);
  //         // console.log('color: ', color);
  //         frameBuf32[frameRowPtr] = color;
  //       }
  //       frameRowPtr++;
  //       floorX += stepX;
  //       floorY += stepY;
  //     }
  //   }
  // };

  const rayDirLeftX = dirX - planeX;
  const rayDirLeftY = dirY - planeY;
  const rayDirRightX = dirX + planeX;
  const rayDirRightY = dirY + planeY;
  const invWidth = 1 / vpWidth;
  const rayStepX = (rayDirRightX - rayDirLeftX) * invWidth;
  const rayStepY = (rayDirRightY - rayDirLeftY) * invWidth;

  for (let y = minWallBottom + 1; y < vpHeight; ++y) {
    const yd = y - projYcenter;
    const sDist = posZ / yd;
    lfloorXhspans[y] = posX + sDist * rayDirLeftX;
    lfloorYhspans[y] = posY + sDist * rayDirLeftY;
    stepXhspans[y] = sDist * rayStepX;
    stepYhspans[y] = sDist * rayStepY;
  }

  // draw horz ceiling above walls
  for (let y = 0; y < minWallTop; y++) {
    drawCeilHSpan(y, 0, vpWidth - 1);
  }

  for (let x = 0; x < vpWidth; ++x) {
    const wallSlice = wallSlices[x];
    tops[x] = wallSlice.Top;
    bottoms[x] = wallSlice.Bottom;
    texXs[x] = wallSlice.TexX;
    texStepYs[x] = wallSlice.TexStepY;
    texPosYs[x] = wallSlice.TexY;
  }

  let rowFramePtr = startFramePtr + frameRowPtrs[minWallTop];

  // draw walls top half
  for (let y = minWallTop; y < maxWallTop; ++y, rowFramePtr += frameStride) {
    let framePtr = rowFramePtr;
    for (let x = 0; x < vpWidth; ++x, ++framePtr) {
      if (y < tops[x]) {
        frameBuf32[framePtr] = CEIL_COLOR;
      } else {
        const mipmap = wallSlices[x].Mipmap;
        const colorOffset = (texXs[x] << mipmap.PitchLg2) | texPosYs[x];
        frameBuf32[framePtr] = mipmap.Buf32[colorOffset];
        texPosYs[x] += texStepYs[x];
      }
    }
  }

  // draw walls central part
  for (
    let y = maxWallTop;
    y <= minWallBottom;
    ++y, rowFramePtr += frameStride
  ) {
    let framePtr = rowFramePtr;
    for (let x = 0; x < vpWidth; ++x) {
      const mipmap = wallSlices[x].Mipmap;
      const colorOffset = (texXs[x] << mipmap.PitchLg2) | texPosYs[x];
      frameBuf32[framePtr++] = mipmap.Buf32[colorOffset];
      texPosYs[x] += texStepYs[x];
    }
  }

  // draw walls bottom half
  for (
    let y = minWallBottom + 1;
    y <= maxWallBottom;
    ++y, rowFramePtr += frameStride
  ) {
    let floorX = lfloorXhspans[y];
    let floorY = lfloorYhspans[y];
    const floorStepX = stepXhspans[y];
    const floorStepY = stepYhspans[y];
    let framePtr = rowFramePtr;
    let prevFloorTexMapIdx = null;
    let floorTex;
    for (let x = 0; x < vpWidth; ++x, ++framePtr) {
      if (y > bottoms[x]) {
        // frameBuf32[framePtr] = FLOOR_COLOR;
        const floorXidx = floorX | 0;
        const floorYidx = floorY | 0;
        const floorTexMapIdx = floorYidx * mapWidth + floorXidx;
        const sameFloorTexMapIdx = floorTexMapIdx === prevFloorTexMapIdx;
        if (
          sameFloorTexMapIdx ||
          (floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length)
        ) {
          if (!sameFloorTexMapIdx) {
            prevFloorTexMapIdx = floorTexMapIdx;
            floorTex = floorTexturesMap[floorTexMapIdx].getMipmap(0);
          }
          const tex = floorTex!;
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(u >= 0 && u < 1);
          // assert(v >= 0 && v < 1);
          const floorTexX = u * tex.Width;
          const floorTexY = v * tex.Height;
          const colorOffset = (floorTexX << tex.PitchLg2) | floorTexY;
          // assert(colorOffset >= 0 && colorOffset < floorTex.Buf32.length);
          const color = tex.Buf32[colorOffset];
          // console.log(colorOffset);
          // console.log('color: ', color);
          frameBuf32[framePtr] = color;
        }
      } else {
        const mipmap = wallSlices[x].Mipmap;
        const colorOffset = (texXs[x] << mipmap.PitchLg2) | texPosYs[x];
        frameBuf32[framePtr] = mipmap.Buf32[colorOffset];
        texPosYs[x] += texStepYs[x];
      }
      floorX += floorStepX;
      floorY += floorStepY;
    }
  }

  // draw horz floor below walls
  for (
    let y = maxWallBottom + 1;
    y < vpHeight;
    y++, rowFramePtr += frameStride
  ) {
    let framePtr = rowFramePtr;
    const TEXTURED_FLOOR = true;
    if (!TEXTURED_FLOOR) {
      for (let x = 0; x < vpWidth; x++) {
        frameBuf32[framePtr++] = FLOOR_COLOR;
      }
    } else {
      // draw textured floor
      const stepX = stepXhspans[y];
      const stepY = stepYhspans[y];
      let floorX = lfloorXhspans[y];
      let floorY = lfloorYhspans[y];
      let prevFloorTexMapIdx = null;
      let floorTex;
      for (let x = 0; x < vpWidth; x++) {
        const floorXidx = floorX | 0;
        const floorYidx = floorY | 0;
        // TODO: assert if negative ?
        const floorTexMapIdx = floorYidx * mapWidth + floorXidx;
        // assert(
        //   floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length,
        //   `floorTexMapIdx: ${floorTexMapIdx} floorXidx: ${floorXidx} floorYidx: ${floorYidx}
        //    flooorX: ${floorX} floorY: ${floorY}`,
        // );
        const sameFloorTexMapIdx = floorTexMapIdx === prevFloorTexMapIdx;
        if (
          sameFloorTexMapIdx ||
          (floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length)
        ) {
          if (!sameFloorTexMapIdx) {
            prevFloorTexMapIdx = floorTexMapIdx;
            floorTex = floorTexturesMap[floorTexMapIdx].getMipmap(0);
          }
          const tex = floorTex!;
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(u >= 0 && u < 1);
          // assert(v >= 0 && v < 1);
          const floorTexX = u * tex.Width;
          const floorTexY = v * tex.Height;
          const colorOffset = (floorTexX << tex.PitchLg2) | floorTexY;
          // assert(colorOffset >= 0 && colorOffset < floorTex.Buf32.length);
          const color = tex.Buf32[colorOffset];
          // console.log(colorOffset);
          // console.log('color: ', color);
          frameBuf32[framePtr] = color;
        }
        framePtr++;
        floorX += stepX;
        floorY += stepY;
      }
    }
  }
}

export {
  DrawParams,
  initDrawParams,
  drawBackground,
  drawBorders,
  DrawViewParams,
  drawViewVert,
  drawViewVertHorz,
  drawViewHorz,
};
