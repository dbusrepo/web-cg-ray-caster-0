import assert from 'assert';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { Texture } from '../wasmEngine/texture';
import { FrameColorRGBAWasm } from '../wasmEngine/frameColorRGBAWasm';
import { Raycaster } from './raycaster';

const CEIL_COLOR = 0xffbbbbbb;
const FLOOR_COLOR = 0xff555555;

class RenderParams {
  public startFramePtr: number;

  public frameRowPtrs: Uint32Array;

  public textures: Texture[];

  public spansX1: Int32Array;
  public spansStepX: Float32Array;
  public spansStepY: Float32Array;
  public spansFloorLX: Float32Array;
  public spansFloorLY: Float32Array;

  constructor(
    public raycaster: Raycaster,
    public frameBuf32: Uint32Array,
    public frameStride: number,
    public texturedFloor: boolean,
  ) {
    const viewport = raycaster.Viewport;
    const {
      StartX: vpStartX,
      StartY: vpStartY,
      // Width: vpWidth,
      Height: vpHeight,
    } = viewport;

    this.frameStride /= BPP_RGBA;
    this.startFramePtr = vpStartY * this.frameStride + vpStartX;

    this.frameRowPtrs = new Uint32Array(vpHeight + 1);
    for (let i = 0; i <= vpHeight; i++) {
      this.frameRowPtrs[i] = this.startFramePtr + i * this.frameStride;
    }

    this.spansX1 = new Int32Array(vpHeight);
    this.spansStepX = new Float32Array(vpHeight);
    this.spansStepY = new Float32Array(vpHeight);
    this.spansFloorLX = new Float32Array(vpHeight);
    this.spansFloorLY = new Float32Array(vpHeight);

    this.textures = raycaster.Textures;
  }
}

let renderParams: RenderParams;

function initRenderParams(
  raycaster: Raycaster,
  frameBuf32: Uint32Array,
  frameStride: number,
  texturedFloor: boolean,
) {
  renderParams = new RenderParams(
    raycaster,
    frameBuf32,
    frameStride,
    texturedFloor,
  );
}

function renderBackground(color: number) {
  assert(renderParams !== undefined);

  const { frameBuf32, frameStride, raycaster } = renderParams;

  const {
    StartX: vpStartX,
    StartY: vpStartY,
    Width: vpWidth,
    Height: vpHeight,
  } = raycaster.Viewport;

  for (
    let i = vpStartY, offset = vpStartY * frameStride;
    i < vpStartY + vpHeight;
    i++, offset += frameStride
  ) {
    frameBuf32.fill(color, offset + vpStartX, offset + vpStartX + vpWidth);
  }
}

function renderBorders(borderColor: number) {
  assert(renderParams !== undefined);

  const { frameBuf32, frameStride, raycaster } = renderParams;

  const {
    StartX: vpStartX,
    StartY: vpStartY,
    Width: vpWidth,
    Height: vpHeight,
  } = raycaster.Viewport;

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

function renderView() {
  // renderViewFullVert();
  // renderViewFullVert2();
  renderViewWallsVertFloorsHorz();
  // renderViewFullHorz(); // TODO:
}

function renderViewFullVert() {
  const {
    startFramePtr,
    frameBuf32,
    frameStride,
    frameRowPtrs,
    texturedFloor,
    raycaster,
    textures,
  } = renderParams;

  const {
    FloorMap: floorMap,
    WallSlices: wallSlices,
    MapWidth: mapWidth,
    ProjYCenter: projYCenter,
  } = raycaster;

  const {
    // StartX: vpStartX,
    // StartY: vpStartY,
    Width: vpWidth,
    Height: vpHeight,
  } = raycaster.Viewport;

  const { PosX: posX, PosY: posY, PosZ: posZ } = raycaster.Player;

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
      ProjHeight: projHeight,
      ClipTop: clipTop,
    } = wallSlices[x];

    const colPtr = startFramePtr + x;
    let framePtr = colPtr;
    let frameLimitPtr = frameRowPtrs[top] + x;

    // render ceil

    // for (let y = 0; y < top; y++) {
    for (; framePtr < frameLimitPtr; framePtr += frameStride) {
      frameBuf32[framePtr] = CEIL_COLOR;
    }
    // assert(framePtr === colPtr + top * frameStride);

    // const wallSliceHeight = bottom - top + 1;
    // frameLimitPtr = framePtr + wallSliceHeight * frameStride;
    // assert(frameLimitPtr === frameRowPtrs[bottom + 1] + x);
    frameLimitPtr = frameRowPtrs[bottom + 1] + x;

    if (hit) {
      const {
        Buf32: mipPixels,
        Width: texWidth,
        // Height: texHeight,
        Lg2Pitch: lg2Pitch,
      } = mipmap;

      // mipmap is rotated 90ccw
      // const mipStride = 1 << pitchLg2;
      const mipRowOffs = texX << lg2Pitch;

      // // wall alg1: bres
      // // const wallSliceHeight = bottom - top + 1;
      // // let numPixels = wallSliceHeight;
      // const frac = texWidth;
      // let counter = -projHeight + clipTop * frac;
      // let colIdx = mipRowOffs;
      // let color = mipPixels[colIdx];
      // // while (numPixels--) {
      // for (; framePtr < frameLimitPtr; framePtr += frameStride) {
      //   while (counter >= 0) {
      //     counter -= projHeight;
      //     colIdx++;
      //     color = mipPixels[colIdx];
      //   }
      //   frameBuf32[framePtr] = color;
      //   counter += frac;
      // }

      // wall alg2: dda vers 1
      // for (let y = top; y <= bottom; y++) {
      // for (; framePtr < frameLimitPtr; framePtr += frameStride) {
      //   const texColOffs = texY | 0;
      //   const color = mipPixels[mipRowOffs + texColOffs];
      //   // color = frameColorRGBAWasm.lightColorABGR(color, 255);
      //   // frameColorRGBAWasm.lightPixel(frameBuf32, dstPtr, 120);
      //   frameBuf32[framePtr] = color;
      //   texY += texStepY;
      // }

      // wall alg2 dda vers 2
      let offs = mipRowOffs + texY;
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        const color = mipPixels[offs | 0];
        frameBuf32[framePtr] = color;
        offs += texStepY;
      }

      // // wall alg3: fixed
      // const FIX = 16;
      // let texStepY_fix = (texStepY * (1 << FIX)) | 0;
      // let texY_fix = ((texY) * (1 << FIX)) | 0;
      // for (; framePtr < frameLimitPtr; framePtr += frameStride) {
      //   const texColOffs = texY_fix >> FIX;
      //   const color = mipPixels[mipRowOffs + texColOffs];
      //   frameBuf32[framePtr] = color;
      //   texY_fix += texStepY_fix;
      // }

      // // wall alg4: dda when min, bres when mag
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
      //   for (; framePtr < frameLimitPtr; framePtr += frameStride) {
      //     while (counter >= 0) {
      //       counter -= projHeight;
      //       colIdx++;
      //       color = mipPixels[colIdx];
      //     }
      //     frameBuf32[framePtr] = color;
      //     counter += frac;
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
      const color = side === 0 ? 0xff0000ee : 0xff0000aa;
      // for (let y = top; y <= bottom; y++) {
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        frameBuf32[framePtr] = color;
      }
    }

    // assert(framePtr === colPtr + (bottom + 1) * frameStride);

    if (!texturedFloor) {
      for (let y = bottom + 1; y < vpHeight; y++) {
        frameBuf32[framePtr] = FLOOR_COLOR;
        framePtr += frameStride;
      }
    } else {
      let prevFloorMapIdx = null;
      let floorMip;

      for (let y = bottom + 1; y < vpHeight; y++, framePtr += frameStride) {
        // y in [bottom + 1, height), dist in [1, +inf), dist == 1 when y == height
        const dist = posZ / (y - projYCenter);
        let weight = dist / wallDistance;
        // assert(weight >= 0);
        // assert(weight <= 1);
        let floorX = weight * floorWallX + (1 - weight) * posX;
        let floorY = weight * floorWallY + (1 - weight) * posY;
        const floorXidx = floorX | 0;
        const floorYidx = floorY | 0;
        const floorMapIdx = floorYidx * mapWidth + floorXidx;
        const sameFloorMapIdx = floorMapIdx === prevFloorMapIdx;
        if (
          sameFloorMapIdx ||
          (floorMapIdx >= 0 && floorMapIdx < floorMap.length)
        ) {
          if (!sameFloorMapIdx) {
            const floorTexIdx = floorMap[floorMapIdx];
            floorMip = textures[floorTexIdx].getMipmap(0).Image;
            prevFloorMapIdx = floorMapIdx;
          }
          const mip = floorMip!;
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(floorX >= 0 && floorX < 1);
          // assert(floorY >= 0 && floorY < 1);
          const floorMipX = u * mip.Width;
          const floorMipY = v * mip.Height;
          const mipOffs = (floorMipX << mip.Lg2Pitch) | floorMipY;
          // assert(mipOffs >= 0 && mipOffs < floorMip.Buf32.length);
          const color = mip.Buf32[mipOffs];
          frameBuf32[framePtr] = color;
        }
      }
    }
    // assert(framePtr === colPtr + vpHeight * frameStride);
  }

  // // render horizontal lines for minWallTop and maxWallBottom
  // const minTopRowPtr = screenPtr + minWallTop * frameStride;
  // const maxBottomRowPtr = screenPtr + maxWallBottom * frameStride;
  // for (let i = colStart; i < colEnd; i++) {
  //   frameBuf32[minTopRowPtr + i] = 0xff0000ff;
  //   frameBuf32[maxBottomRowPtr + i] = 0xff0000ff;
  // }

  // ...
  // const colPtr = renderParams.screenPtr;
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

function renderViewFullVert2() {
  const {
    startFramePtr,
    frameBuf32,
    frameStride,
    frameRowPtrs,
    spansFloorLX,
    spansFloorLY,
    spansStepX,
    spansStepY,
    raycaster,
    texturedFloor,
    textures,
  } = renderParams;

  const {
    FloorMap: floorMap,
    WallSlices: wallSlices,
    MapWidth: mapWidth,
    ProjYCenter: projYCenter,
    MinWallBottom: minWallBottom,
  } = raycaster;

  const {
    // StartX: vpStartX,
    // StartY: vpStartY,
    Width: vpWidth,
    Height: vpHeight,
  } = raycaster.Viewport;

  const {
    DirX: dirX,
    DirY: dirY,
    PosX: posX,
    PosY: posY,
    PosZ: posZ,
    PlaneX: planeX,
    PlaneY: planeY,
  } = raycaster.Player;

  const rayDirLeftX = dirX - planeX;
  const rayDirLeftY = dirY - planeY;
  const rayDirRightX = dirX + planeX;
  const rayDirRightY = dirY + planeY;
  const invWidth = 1 / vpWidth;
  const rayStepX = (rayDirRightX - rayDirLeftX) * invWidth;
  const rayStepY = (rayDirRightY - rayDirLeftY) * invWidth;

  for (let y = minWallBottom + 1; y < vpHeight; ++y) {
    const yd = y - projYCenter;
    const sDist = posZ / yd;
    spansFloorLX[y] = posX + sDist * rayDirLeftX;
    spansFloorLY[y] = posY + sDist * rayDirLeftY;
    spansStepX[y] = sDist * rayStepX;
    spansStepY[y] = sDist * rayStepY;
  }

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
      // Distance: wallDistance,
      // FloorWallX: floorWallX,
      // FloorWallY: floorWallY,
      Mipmap: mipmap,
    } = wallSlices[x];

    const colPtr = startFramePtr + x;
    let framePtr = colPtr;
    let frameLimitPtr = frameRowPtrs[top] + x;

    // render ceil
    // for (let y = 0; y < top; y++) {
    for (; framePtr < frameLimitPtr; framePtr += frameStride) {
      frameBuf32[framePtr] = CEIL_COLOR;
    }
    // assert(framePtr === colPtr + top * frameStride);
    // assert(framePtr === frameLimitPtr);

    frameLimitPtr = frameRowPtrs[bottom + 1] + x;

    if (hit) {
      const {
        Buf32: mipPixels,
        // Width: texWidth,
        // Height: texHeight,
        Lg2Pitch: lg2Pitch,
      } = mipmap;

      const mipRowOffs = texX << lg2Pitch;
      let offs = mipRowOffs + texY;
      // // wall alg2: dda
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        const color = mipPixels[offs | 0];
        frameBuf32[framePtr] = color;
        offs += texStepY;
      }
    } else {
      // no hit untextured wall
      const color = side === 0 ? 0xff0000ee : 0xff0000aa;
      // for (let y = top; y <= bottom; y++) {
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        frameBuf32[framePtr] = color;
      }
    }
    // assert(framePtr === colPtr + (bottom + 1) * frameStride);

    if (!texturedFloor) {
      for (let y = bottom + 1; y < vpHeight; y++) {
        frameBuf32[framePtr] = FLOOR_COLOR;
        framePtr += frameStride;
      }
    } else {
      let floorMip;
      let prevFloorMapIdx = null;

      for (let y = bottom + 1; y < vpHeight; y++, framePtr += frameStride) {
        const floorX = spansFloorLX[y] + x * spansStepX[y];
        const floorY = spansFloorLY[y] + x * spansStepY[y];
        const floorXidx = floorX | 0;
        const floorYidx = floorY | 0;
        const floorMapIdx = floorYidx * mapWidth + floorXidx;
        const sameFloorMapIdx = floorMapIdx === prevFloorMapIdx;
        if (
          sameFloorMapIdx ||
          (floorMapIdx >= 0 && floorMapIdx < floorMap.length)
        ) {
          if (!sameFloorMapIdx) {
            const floorTexIdx = floorMap[floorMapIdx];
            floorMip = textures[floorTexIdx].getMipmap(0).Image;
            prevFloorMapIdx = floorMapIdx;
          }
          const mip = floorMip!;
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(u >= 0 && u < 1);
          // assert(v >= 0 && v < 1);
          const floorMipX = u * mip.Width;
          const floorMipY = v * mip.Height;
          const mipOffs = (floorMipX << mip.Lg2Pitch) | floorMipY;
          // assert(mipOffs >= 0 && mipOffs < floorMip.Buf32.length);
          const color = mip.Buf32[mipOffs];
          frameBuf32[framePtr] = color;
        }
      }
    }
    // assert(framePtr === colPtr + vpHeight * frameStride);
  }
}

const renderCeilSpan = (y: number, x1: number, x2: number) => {
  const { frameBuf32, startFramePtr, frameRowPtrs } = renderParams;
  let frameRowPtr = startFramePtr + frameRowPtrs[y] + x1;
  // let frameRowLimitPtr = startFramePtr + frameRowPtrs[y] + x2;
  // for (let x = x1; x <= x2; x++) {
  // while (frameRowPtr <= frameRowLimitPtr) {
  let numPixels = Math.max(x2 - x1 + 1, 0);
  while (numPixels--) {
    frameBuf32[frameRowPtr++] = CEIL_COLOR;
  }
};

const renderFloorSpan = (y: number, x1: number, x2: number) => {
  const {
    frameBuf32,
    startFramePtr,
    spansStepX,
    spansStepY,
    spansFloorLX,
    spansFloorLY,
    frameRowPtrs,
    raycaster,
    texturedFloor,
    textures,
  } = renderParams;

  const { FloorMap: floorMap, MapWidth: mapWidth } = raycaster;

  let frameRowPtr = startFramePtr + frameRowPtrs[y] + x1;
  let numPixels = Math.max(x2 - x1 + 1, 0);
  if (!texturedFloor) {
    // for (let x = x1; x <= x2; x++) {
    while (numPixels--) {
      frameBuf32[frameRowPtr++] = FLOOR_COLOR;
    }
  } else {
    // render textured floor
    const stepX = spansStepX[y];
    const stepY = spansStepY[y];
    let floorX = spansFloorLX[y] + x1 * stepX;
    let floorY = spansFloorLY[y] + x1 * stepY;
    let prevFloorMapIdx = null;
    let floorMipmap;
    while (numPixels--) {
      const floorXidx = floorX | 0;
      const floorYidx = floorY | 0;
      const floorMapIdx = floorYidx * mapWidth + floorXidx;
      const sameFloorMapIdx = floorMapIdx === prevFloorMapIdx;
      if (
        sameFloorMapIdx ||
        (floorMapIdx >= 0 && floorMapIdx < floorMap.length)
      ) {
        if (!sameFloorMapIdx) {
          const floorTexIdx = floorMap[floorMapIdx];
          floorMipmap = textures[floorTexIdx].getMipmap(0).Image;
          prevFloorMapIdx = floorMapIdx;
        }
        const mip = floorMipmap!;
        const u = floorX - floorXidx;
        const v = floorY - floorYidx;
        // assert(u >= 0 && u < 1);
        // assert(v >= 0 && v < 1);
        const floorMipX = u * mip.Width;
        const floorMipY = v * mip.Height;
        const mipOffs = (floorMipX << mip.Lg2Pitch) | floorMipY;
        // assert(mipOffs >= 0 && mipOffs < floorMip.Buf32.length);
        const color = mip.Buf32[mipOffs];
        frameBuf32[frameRowPtr] = color;
      }
      frameRowPtr++;
      floorX += stepX;
      floorY += stepY;
    }
  }
};

function renderViewWallsVertFloorsHorz() {
  const {
    frameBuf32,
    startFramePtr,
    frameStride,
    spansStepX,
    spansStepY,
    spansFloorLX,
    spansFloorLY,
    frameRowPtrs,
    spansX1,
    raycaster,
  } = renderParams;

  const {
    WallSlices: wallSlices,
    // MapWidth: mapWidth,
    ProjYCenter: projYCenter,
    MinWallTop: minWallTop,
    MinWallBottom: minWallBottom,
    MaxWallBottom: maxWallBottom,
  } = raycaster;

  const {
    // StartX: vpStartX,
    // StartY: vpStartY,
    Width: vpWidth,
    Height: vpHeight,
  } = raycaster.Viewport;

  const {
    DirX: dirX,
    DirY: dirY,
    PosX: posX,
    PosY: posY,
    PosZ: posZ,
    PlaneX: planeX,
    PlaneY: planeY,
  } = raycaster.Player;

  const rayDirLeftX = dirX - planeX;
  const rayDirLeftY = dirY - planeY;
  const rayDirRightX = dirX + planeX;
  const rayDirRightY = dirY + planeY;
  const invWidth = 1 / vpWidth;
  const rayStepX = (rayDirRightX - rayDirLeftX) * invWidth;
  const rayStepY = (rayDirRightY - rayDirLeftY) * invWidth;

  for (let y = minWallBottom + 1; y < vpHeight; ++y) {
    const yd = y - projYCenter;
    const sDist = posZ / yd;
    spansFloorLX[y] = posX + sDist * rayDirLeftX;
    spansFloorLY[y] = posY + sDist * rayDirLeftY;
    spansStepX[y] = sDist * rayStepX;
    spansStepY[y] = sDist * rayStepY;
  }

  // render ceiling above walls with horz spans
  for (let y = 0; y < minWallTop; y++) {
    renderCeilSpan(y, 0, vpWidth - 1);
  }

  let prevWallBottom = maxWallBottom;

  // render walls vertically
  for (let x = 0; x < vpWidth; x++) {
    let {
      Hit: hit,
      Top: top,
      Bottom: bottom,
      TexX: texX,
      TexStepY: texStepY,
      TexY: texY,
      Mipmap: mipmap,
      Side: side,
    } = wallSlices[x];

    // const colPtr = startFramePtr + x;
    let framePtr = frameRowPtrs[minWallTop] + x;
    let frameLimitPtr = frameRowPtrs[top] + x;

    // for (let y = minWallTop; y < top; y++) {
    for (; framePtr < frameLimitPtr; framePtr += frameStride) {
      frameBuf32[framePtr] = CEIL_COLOR;
    }
    // assert(framePtr === colPtr + top * frameStride);

    frameLimitPtr = frameRowPtrs[bottom + 1] + x;

    if (hit) {
      const {
        Buf32: mipPixels,
        // Width: texWidth,
        // Height: texHeight,
        Lg2Pitch: lg2Pitch,
      } = mipmap;

      const mipRowOffs = texX << lg2Pitch;
      let offs = mipRowOffs + texY;

      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        const color = mipPixels[offs | 0];
        frameBuf32[framePtr] = color;
        offs += texStepY;
      }
    } else {
      const color = side === 0 ? 0xff0000ee : 0xff0000aa;
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        frameBuf32[framePtr] = color;
      }
    }

    // assert(framePtr === colPtr + (bottom + 1) * frameStride);

    let nr = prevWallBottom - bottom;

    if (nr > 0) {
      // cur wall is shorter
      // set spans start for y in [bottom + 1, prevWallBottom]
      let y = bottom + 1;
      do {
        spansX1[y++] = x;
      } while (--nr);
    } else {
      // cur wall is longer or equal
      // nr <= 0
      // render spans for y in [prevWallBottom + 1, bottom]
      let y = prevWallBottom + 1;
      while (nr++) {
        renderFloorSpan(y, spansX1[y], x - 1);
        ++y;
      }
    }

    prevWallBottom = bottom;
  }

  // render floor spans not closed: fill spans below last wall
  for (let y = prevWallBottom + 1; y <= maxWallBottom; y++) {
    renderFloorSpan(y, spansX1[y], vpWidth - 1);
  }

  // render horz floor below walls
  for (let y = maxWallBottom + 1; y < vpHeight; y++) {
    renderFloorSpan(y, 0, vpWidth - 1);
  }
}

function renderViewFullHorz() {
  const {
    frameBuf32,
    startFramePtr,
    frameStride,
    spansStepX,
    spansStepY,
    spansFloorLX,
    spansFloorLY,
    frameRowPtrs,
    raycaster,
  } = renderParams;

  const {
    FloorMap: floorMap,
    WallSlices: wallSlices,
    // MapWidth: mapWidth,
    ProjYCenter: projYCenter,
    MinWallTop: minWallTop,
    MaxWallTop: maxWallTop,
    MinWallBottom: minWallBottom,
    MaxWallBottom: maxWallBottom,
  } = raycaster;

  const {
    // StartX: vpStartX,
    // StartY: vpStartY,
    Width: vpWidth,
    Height: vpHeight,
  } = raycaster.Viewport;

  const {
    DirX: dirX,
    DirY: dirY,
    PosX: posX,
    PosY: posY,
    PosZ: posZ,
    PlaneX: planeX,
    PlaneY: planeY,
  } = raycaster.Player;

  const rayDirLeftX = dirX - planeX;
  const rayDirLeftY = dirY - planeY;
  const rayDirRightX = dirX + planeX;
  const rayDirRightY = dirY + planeY;
  const invWidth = 1 / vpWidth;
  const rayStepX = (rayDirRightX - rayDirLeftX) * invWidth;
  const rayStepY = (rayDirRightY - rayDirLeftY) * invWidth;

  for (let y = minWallBottom + 1; y < vpHeight; ++y) {
    const yd = y - projYCenter;
    const sDist = posZ / yd;
    spansFloorLX[y] = posX + sDist * rayDirLeftX;
    spansFloorLY[y] = posY + sDist * rayDirLeftY;
    spansStepX[y] = sDist * rayStepX;
    spansStepY[y] = sDist * rayStepY;
  }

  // render horz ceiling above walls
  for (let y = 0; y < minWallTop; y++) {
    renderCeilSpan(y, 0, vpWidth - 1);
  }

  let rowFramePtr = startFramePtr + frameRowPtrs[minWallTop];

  // render walls top half
  for (let y = minWallTop; y < maxWallTop; ++y, rowFramePtr += frameStride) {
    let framePtr = rowFramePtr;
    for (let x = 0; x < vpWidth; ++x, ++framePtr) {
      const wallSlice = wallSlices[x];
      if (y < wallSlice.Top) {
        frameBuf32[framePtr] = CEIL_COLOR;
      } else {
        const mipmap = wallSlices[x].Mipmap;
        const texOffs = (wallSlice.TexX << mipmap.Lg2Pitch) | wallSlice.TexY;
        frameBuf32[framePtr] = mipmap.Buf32[texOffs];
        wallSlice.TexY += wallSlice.TexStepY;
      }
    }
  }

  // render walls central part
  for (
    let y = maxWallTop;
    y <= minWallBottom;
    ++y, rowFramePtr += frameStride
  ) {
    let framePtr = rowFramePtr;
    for (let x = 0; x < vpWidth; ++x) {
      const wallSlice = wallSlices[x];
      const mipmap = wallSlices[x].Mipmap;
      const texOffs = (wallSlice.TexX << mipmap.Lg2Pitch) | wallSlice.TexY;
      frameBuf32[framePtr++] = mipmap.Buf32[texOffs];
      wallSlice.TexY += wallSlice.TexStepY;
    }
  }

  // render walls bottom half
  for (
    let y = minWallBottom + 1;
    y <= maxWallBottom;
    ++y, rowFramePtr += frameStride
  ) {
    let x1span = 0;
    let x2span = -1;
    let framePtr = rowFramePtr;
    for (let x = 0; x < vpWidth; ++x, ++framePtr) {
      const wallSlice = wallSlices[x];
      if (y <= wallSlice.Bottom) {
        // render left floor span
        renderFloorSpan(y, x1span, x2span);
        // render wall pixel
        const mipmap = wallSlices[x].Mipmap;
        const texOffs = (wallSlice.TexX << mipmap.Lg2Pitch) | wallSlice.TexY;
        frameBuf32[framePtr] = mipmap.Buf32[texOffs];
        wallSlice.TexY += wallSlice.TexStepY;
        x1span = x + 1;
        x2span = x;
      } else {
        x2span++;
      }
    }
    renderFloorSpan(y, x1span, x2span);
  }

  // render floor spans below maxWallBottom
  for (let y = maxWallBottom + 1; y < vpHeight; y++) {
    renderFloorSpan(y, 0, vpWidth - 1);
  }
}

export {
  RenderParams,
  initRenderParams,
  renderBackground,
  renderBorders,
  renderView,
};
