import assert from 'assert';
import { WallSlice } from './wallslice';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { Texture } from './texture';
import { FrameColorRGBAWasm } from '../wasmEngine/frameColorRGBAWasm';

const CEIL_COLOR = 0xffbbbbbb;
const FLOOR_COLOR = 0xff777777;


class DrawParams {
  public startFrameViewPtr: number;
  public hspans: Uint32Array;
  public lhspans: Uint32Array;
  public rhspans: Uint32Array;
  public stepXhspans: Float32Array;
  public stepYhspans: Float32Array;
  public lfloorXhspans: Float32Array;
  public lfloorYhspans: Float32Array;
  public frameRowPtrs: Uint32Array;

  constructor(
    public frameBuf32: Uint32Array,
    public frameStride: number,
    public viewportStartX: number,
    public viewportStartY: number,
    public viewportWidth: number,
    public viewportHeight: number,
    public wallTextures: Texture[][],
    public floorTexturesMap: Texture[],
    public frameColorRGBAWasm: FrameColorRGBAWasm,
  ) {
    this.startFrameViewPtr = viewportStartY * frameStride + viewportStartX;
    const viewHeight = viewportHeight;
    this.hspans = new Uint32Array(viewHeight).fill(0);
    this.lhspans = new Uint32Array(viewHeight);
    this.rhspans = new Uint32Array(viewHeight);
    this.stepXhspans = new Float32Array(viewHeight);
    this.stepYhspans = new Float32Array(viewHeight);
    this.lfloorXhspans = new Float32Array(viewHeight);
    this.lfloorYhspans = new Float32Array(viewHeight);
    this.frameRowPtrs = new Uint32Array(viewHeight);
    for (let i = 0; i < viewHeight; i++) {
      this.frameRowPtrs[i] = this.startFrameViewPtr + i * frameStride;
    }
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
    viewportStartX: startX,
    viewportStartY: startY,
    viewportWidth,
    viewportHeight,
  } = drawParams;

  for (
    let i = startY, offset = startY * stride;
    i < startY + viewportHeight;
    i++, offset += stride
  ) {
    frameBuf32.fill(color, offset + startX, offset + startX + viewportWidth);
  }
}

function drawBorders(borderColor: number) {
  assert(drawParams !== undefined);

  const {
    frameBuf32,
    frameStride,
    viewportStartX,
    viewportStartY,
    viewportWidth,
    viewportHeight,
  } = drawParams;

  const upperLimit = viewportStartY * frameStride;
  const lowerLimit = (viewportStartY + viewportHeight) * frameStride;

  frameBuf32.fill(borderColor, 0, upperLimit);
  frameBuf32.fill(borderColor, lowerLimit, frameBuf32.length);

  for (
    let i = viewportStartY, offset = viewportStartY * frameStride;
    i < viewportStartY + viewportHeight;
    i++, offset += frameStride
  ) {
    frameBuf32.fill(borderColor, offset, offset + viewportStartX);
    frameBuf32.fill(
      borderColor,
      offset + viewportStartX + viewportWidth,
      offset + frameStride,
    );
  }
}

type DrawSceneParams = {
  posX: number;
  posY: number;
  posZ: number;
  dirX: number;
  dirY: number;
  planeX: number;
  planeY: number;
  wallSlices: WallSlice[];
  colStart: number;
  colEnd: number;
  mapWidth: number;
  mapHeight: number;
  viewMidY: number;
  minWallTop: number;
  maxWallBottom: number;
};

function drawSceneVert(drawSceneParams: DrawSceneParams) {
  const {
    frameBuf32,
    frameStride,
    startFrameViewPtr,
    viewportWidth,
    viewportHeight,
    // wallTextures,
    // frameColorRGBAWasm,
  } = drawParams;

  const {
    posX,
    posY,
    posZ,
    wallSlices,
    colStart,
    colEnd,
    mapWidth,
    viewMidY,
    // minWallTop,
    // maxWallBottom,
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
    let framePtr = colPtr;

    // draw ceil
    for (let y = 0; y < top; y++) {
      frameBuf32[framePtr] = CEIL_COLOR;
      framePtr += frameStride;
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
        frameBuf32[framePtr] = color;
        // frameColorRGBAWasm.lightPixel(frameBuf32, dstPtr, 120);
        framePtr += frameStride;
        texPosY += texStepY;
      }
    } else {
      // no hit untextured wall
      const color = side === 0 ? 0xff0000ff : 0xff00ff00;
      for (let y = top; y <= bottom; y++) {
        frameBuf32[framePtr] = color;
        framePtr += frameStride;
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
      for (let y = bottom + 1; y < viewportHeight; y++) {
        // y in [bottom + 1, height), dist in [1, +inf), dist == 1 when y == height
        const dist = posZ / (y - viewMidY);
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
          const tex = floorTexturesMap[floorTexMapIdx].getMipmap(0);
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(floorX >= 0 && floorX < 1);
          // assert(floorY >= 0 && floorY < 1);
          const floorTexX = (u * tex.Width) | 0;
          const floorTexY = (v * tex.Height) | 0;
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
      for (let y = bottom + 1; y < viewportHeight; y++) {
        frameBuf32[framePtr] = FLOOR_COLOR;
        framePtr += frameStride;
      }
    }

    assert(framePtr === colPtr + viewportHeight * frameStride);
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
    viewportWidth: viewWidth,
    viewportHeight: viewHeight,
    floorTexturesMap,
    hspans,
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
    colStart,
    colEnd,
    viewMidY,
    minWallTop,
    maxWallBottom,
    mapWidth,
    // mapHeight,
  } = drawSceneParams;

  // let framePtr;

  const invWidth = 1 / viewWidth;
  const rayDirLeftX = dirX - planeX;
  const rayDirLeftY = dirY - planeY;
  const rayDirRightX = dirX + planeX;
  const rayDirRightY = dirY + planeY;

  // reset hspans
  hspans.fill(0);

  for (let y = viewMidY + 1; y < viewHeight; y++) {
    // check if we already have a horizontal span
    const yd = y - viewMidY;
    const sDist = posZ / yd;
    lfloorXhspans[y] = posX + sDist * rayDirLeftX;
    lfloorYhspans[y] = posY + sDist * rayDirLeftY;
    stepXhspans[y] = sDist * (rayDirRightX - rayDirLeftX) * invWidth;
    stepYhspans[y] = sDist * (rayDirRightY - rayDirLeftY) * invWidth;
  }

  const drawCeilHSpan = (y: number, x1: number, x2: number) => {
    let frameRowPtr = startFrameViewPtr + frameRowPtrs[y] + x1;
    let spanLen = x2 - x1 + 1;
    while (spanLen--) {
      frameBuf32[frameRowPtr++] = CEIL_COLOR;
    }
  };

  const drawFloorHSpan = (y: number, x1: number, x2: number) => {
    let frameRowPtr = startFrameViewPtr + frameRowPtrs[y] + x1;
    const TEXTURED_FLOOR = true;
    if (!TEXTURED_FLOOR) {
      let spanLen = x2 - x1 + 1;
      while (spanLen--) {
        frameBuf32[frameRowPtr++] = FLOOR_COLOR;
      }
    } else {
      // draw textured floor
      const stepX = stepXhspans[y];
      const stepY = stepYhspans[y];
      let floorX = lfloorXhspans[y] + x1 * stepX;
      let floorY = lfloorYhspans[y] + x1 * stepY;
      let spanLen = x2 - x1 + 1;
      while (spanLen--) {
        const floorXidx = floorX | 0;
        const floorYidx = floorY | 0;
        const floorTexMapIdx = floorYidx * mapWidth + floorXidx;
        // assert(floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length,
        //   `floorTexMapIdx: ${floorTexMapIdx} floorXidx: ${floorXidx} floorYidx: ${floorYidx} mapWidth: ${mapWidth}`);
        if (floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length) {
          const tex = floorTexturesMap[floorTexMapIdx].getMipmap(0);
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(floorX >= 0 && floorX < 1);
          // assert(floorY >= 0 && floorY < 1);
          const floorTexX = (u * tex.Width) | 0;
          const floorTexY = (v * tex.Height) | 0;
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

  let hasCeilSpans = false;
  let hasFloorSpans = false;

  // draw walls vertically
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

    let framePtr = startFrameViewPtr + frameRowPtrs[top] + x;

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

    // draw floor below walls
    // for (let y = bottom + 1; y < viewHeight; y++) {
    //   frameBuf32[framePtr] = FLOOR_COLOR;
    //   framePtr += frameStride;
    // }

    for (let y = minWallTop; y < top; y++) {
      if (!hspans[y]) {
        hasCeilSpans = true;
        hspans[y] = 1;
        lhspans[y] = rhspans[y] = x;
      } else if (x === rhspans[y] + 1) {
        // check if we can extend the horizontal span
        rhspans[y] = x;
      } else {
        // we can't extend the horizontal span, so draw it and start a new one
        drawCeilHSpan(y, lhspans[y], rhspans[y]);
        lhspans[y] = rhspans[y] = x;
      }
    }

    for (let y = bottom + 1; y <= maxWallBottom; y++) {
      // check if we already have a horizontal span
      if (!hspans[y]) {
        hasFloorSpans = true;
        hspans[y] = 1;
        lhspans[y] = rhspans[y] = x;
      } else if (x === rhspans[y] + 1) {
        // check if we can extend the horizontal span
        rhspans[y] = x;
      } else {
        // we can't extend the horizontal span, so draw it and start a new one
        drawFloorHSpan(y, lhspans[y], rhspans[y]);
        lhspans[y] = rhspans[y] = x;
      }
    }
  }

  // draw ceil spans that were not closed
  if (hasCeilSpans) {
    for (let y = minWallTop; y < viewMidY; y++) {
      if (hspans[y]) {
        drawCeilHSpan(y, lhspans[y], rhspans[y]);
      }
    }
  }

  // draw floor spans that were not closed
  if (hasFloorSpans) {
    for (let y = viewMidY + 1; y <= maxWallBottom; y++) {
      if (hspans[y]) {
        drawFloorHSpan(y, lhspans[y], rhspans[y]);
      }
    }
  }

  // draw ceiling above walls
  for (let y = 0; y < minWallTop; y++) {
    drawCeilHSpan(y, colStart, colEnd);
  }

  // draw floor below walls
  for (let y = maxWallBottom + 1; y < viewHeight; y++) {
    drawFloorHSpan(y, colStart, colEnd);
  }

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

export {
  DrawParams,
  initDrawParams,
  drawBackground,
  drawBorders,
  DrawSceneParams,
  drawSceneVert,
  drawSceneHorz,
};
