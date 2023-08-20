import assert from 'assert';
import { WallSlice } from './wallslice';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { Texture } from '../wasmEngine/texture';
import { FrameColorRGBAWasm } from '../wasmEngine/frameColorRGBAWasm';
import { Raycaster } from './raycaster';

const CEIL_COLOR = 0xffbbbbbb;
const FLOOR_COLOR = 0xff555555;

class RenderParams {
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
  }
}

let renderParams: RenderParams;

function initRender(
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
  } = renderParams;

  const {
    FloorTexturesMap: floorTexturesMap,
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

      // let numPixels = wallSliceHeight;
      // // wall alg1: bres
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

      // mipPixels.vi
      // const texels = new Uint32Array(
      //   mipPixels.buffer,
      //   mipPixels.byteOffset + mipRowOffs * 4,
      //   mipPixels.byteLength / 4,
      // );
      // const texels = mipPixels.subarray(mipRowOffs, mipRowOffs + 64);

      let offs = mipRowOffs + texY;
      // // wall alg2: dda
      // for (let y = top; y <= bottom; y++) {
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        // const texColOffs = texY | 0;
        // const color = mipPixels[mipRowOffs + texColOffs];
        const color = mipPixels[offs | 0];
        // const color = texels[texColOffs];
        // const color = mipmap.Buf32[texY * texWidth + texX];
        // color = frameColorRGBAWasm.lightColorABGR(color, 255);
        frameBuf32[framePtr] = color;
        // frameColorRGBAWasm.lightPixel(frameBuf32, dstPtr, 120);
        // texY += texStepY;
        offs += texStepY;
        // framePtr += frameStride;
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
      let prevTexIdx = null;
      let floorTex;
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
        const texIdx = floorYidx * mapWidth + floorXidx;
        // assert(floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length, `floorTexMapIdx: ${floorTexMapIdx}, floorXidx: ${floorXidx}, floorYidx: ${floorYidx}, mapWidth: ${mapWidth}, mapHeight: ${mapHeight}`);
        const sameFloorTexMapIdx = texIdx === prevTexIdx;
        if (
          sameFloorTexMapIdx ||
          (texIdx >= 0 && texIdx < floorTexturesMap.length)
        ) {
          if (!sameFloorTexMapIdx) {
            floorTex = floorTexturesMap[texIdx].getMipmap(0).Image;
            prevTexIdx = texIdx;
          }
          const tex = floorTex!;
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(floorX >= 0 && floorX < 1);
          // assert(floorY >= 0 && floorY < 1);
          const floorTexX = u * tex.Width;
          const floorTexY = v * tex.Height;
          const texOffs = (floorTexX << tex.Lg2Pitch) | floorTexY;
          // assert(texOffs >= 0 && texOffs < floorTex.Buf32.length);
          const color = tex.Buf32[texOffs];
          // console.log(texOffs);
          // console.log('color: ', color);
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
    lfloorXhspans,
    lfloorYhspans,
    stepXhspans,
    stepYhspans,
    raycaster,
    texturedFloor,
  } = renderParams;

  const {
    FloorTexturesMap: floorTexturesMap,
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
        Width: texWidth,
        // Height: texHeight,
        Lg2Pitch: lg2Pitch,
      } = mipmap;

      // mipmap is rotated 90ccw
      // const mipStride = 1 << pitchLg2;
      const mipRowOffs = texX << lg2Pitch;
      let offs = mipRowOffs + texY;
      // // wall alg2: dda
      // for (let y = top; y <= bottom; y++) {
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        // const texColOffs = texY | 0;
        // const color = mipPixels[mipRowOffs + texColOffs];
        const color = mipPixels[offs | 0];
        // const color = texels[texColOffs];
        // const color = mipmap.Buf32[texY * texWidth + texX];
        // color = frameColorRGBAWasm.lightColorABGR(color, 255);
        frameBuf32[framePtr] = color;
        // frameColorRGBAWasm.lightPixel(frameBuf32, dstPtr, 120);
        // texY += texStepY;
        offs += texStepY;
        // framePtr += frameStride;
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
        lfloorXhspans[y] = posX + sDist * rayDirLeftX;
        lfloorYhspans[y] = posY + sDist * rayDirLeftY;
        stepXhspans[y] = sDist * rayStepX;
        stepYhspans[y] = sDist * rayStepY;
      }

      let prevTexIdx = null;
      let floorTex;
      for (let y = bottom + 1; y < vpHeight; y++, framePtr += frameStride) {
        const floorX = lfloorXhspans[y] + x * stepXhspans[y];
        const floorY = lfloorYhspans[y] + x * stepYhspans[y];
        const floorXidx = floorX | 0;
        const floorYidx = floorY | 0;
        const texIdx = floorYidx * mapWidth + floorXidx;
        // assert(floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length, `floorTexMapIdx: ${floorTexMapIdx}, floorXidx: ${floorXidx}, floorYidx: ${floorYidx}, mapWidth: ${mapWidth}, mapHeight: ${mapHeight}`);
        const sameFloorTexMapIdx = texIdx === prevTexIdx;
        if (
          sameFloorTexMapIdx ||
          (texIdx >= 0 && texIdx < floorTexturesMap.length)
        ) {
          if (!sameFloorTexMapIdx) {
            floorTex = floorTexturesMap[texIdx].getMipmap(0).Image;
            prevTexIdx = texIdx;
          }
          const tex = floorTex!;
          const u = floorX - floorXidx;
          const v = floorY - floorYidx;
          // assert(floorX >= 0 && floorX < 1);
          // assert(floorY >= 0 && floorY < 1);
          const floorTexX = u * tex.Width;
          const floorTexY = v * tex.Height;
          const texOffs = (floorTexX << tex.Lg2Pitch) | floorTexY;
          // assert(texOffs >= 0 && texOffs < floorTex.Buf32.length);
          const color = tex.Buf32[texOffs];
          // console.log(texOffs);
          // console.log('color: ', color);
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
    stepXhspans,
    stepYhspans,
    lfloorXhspans,
    lfloorYhspans,
    frameRowPtrs,
    raycaster,
    texturedFloor,
  } = renderParams;

  const { FloorTexturesMap: floorTexturesMap, MapWidth: mapWidth } = raycaster;

  let frameRowPtr = startFramePtr + frameRowPtrs[y] + x1;
  let numPixels = Math.max(x2 - x1 + 1, 0);
  if (!texturedFloor) {
    // for (let x = x1; x <= x2; x++) {
    while (numPixels--) {
      frameBuf32[frameRowPtr++] = FLOOR_COLOR;
    }
  } else {
    // render textured floor
    const stepX = stepXhspans[y];
    const stepY = stepYhspans[y];
    let floorX = lfloorXhspans[y] + x1 * stepX;
    let floorY = lfloorYhspans[y] + x1 * stepY;
    let prevTexIdx = null;
    let floorTex;
    // for (let x = x1; x <= x2; x++) {
    while (numPixels--) {
      const floorXidx = floorX | 0;
      const floorYidx = floorY | 0;
      const texIdx = floorYidx * mapWidth + floorXidx;
      // assert(
      //   floorTexMapIdx >= 0 && floorTexMapIdx < floorTexturesMap.length,
      //   `floorX: ${floorX} floorY: ${floorY} x1: ${x1} x2: ${x2} y: ${y}`,
      //   // `flooorX: ${floorX} floorY: ${floorY}`,
      //   // `floorTexMapIdx: ${floorTexMapIdx} floorXidx: ${floorXidx} floorYidx: ${floorYidx}
      //   //  flooorX: ${floorX} floorY: ${floorY}`,
      // );
      const sameFloorTexMapIdx = texIdx === prevTexIdx;
      if (
        sameFloorTexMapIdx ||
        (texIdx >= 0 && texIdx < floorTexturesMap.length)
      ) {
        if (!sameFloorTexMapIdx) {
          prevTexIdx = texIdx;
          floorTex = floorTexturesMap[texIdx].getMipmap(0).Image;
        }
        const tex = floorTex!;
        const u = floorX - floorXidx;
        const v = floorY - floorYidx;
        // assert(u >= 0 && u < 1);
        // assert(v >= 0 && v < 1);
        const floorTexX = u * tex.Width;
        const floorTexY = v * tex.Height;
        const texOffs = (floorTexX << tex.Lg2Pitch) | floorTexY;
        // assert(texOffs >= 0 && texOffs < floorTex.Buf32.length);
        const color = tex.Buf32[texOffs];
        // console.log(texOffs);
        // console.log('color: ', color);
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
    stepXhspans,
    stepYhspans,
    lfloorXhspans,
    lfloorYhspans,
    frameRowPtrs,
    lhspans,
    rhspans,
    initrhspans,
    raycaster,
  } = renderParams;

  const {
    FloorTexturesMap: floorTexturesMap,
    WallSlices: wallSlices,
    MapWidth: mapWidth,
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
    lfloorXhspans[y] = posX + sDist * rayDirLeftX;
    lfloorYhspans[y] = posY + sDist * rayDirLeftY;
    stepXhspans[y] = sDist * rayStepX;
    stepYhspans[y] = sDist * rayStepY;
  }

  // render horz ceiling above walls
  for (let y = 0; y < minWallTop; y++) {
    renderCeilSpan(y, 0, vpWidth - 1);
  }

  let frameColPtr = startFramePtr;

  rhspans.set(initrhspans);

  // render walls vertically
  for (let x = 0; x < vpWidth; x++, frameColPtr++) {
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

    // framePtr = frameColPtr + frameRowPtrs[top];

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

      // textured wall
      // for (let y = top; y <= bottom; y++) {
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        // const texColOffs = texY | 0;
        // const color = mipPixels[mipRowOffs + texColOffs];
        const color = mipPixels[offs | 0];
        frameBuf32[framePtr] = color;
        offs += texStepY;
        // framePtr += frameStride;
      }
    } else {
      // for (let y = top; y <= bottom; y++) {
      const color = side === 0 ? 0xff0000ee : 0xff0000aa;
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        frameBuf32[framePtr] = color;
        // framePtr += frameStride;
      }
    }

    for (let y = bottom + 1; y <= maxWallBottom; y++) {
      // check if we can extend the horizontal span
      if (x === rhspans[y] + 1) {
        rhspans[y] = x;
      } else {
        // we can't extend the horizontal span, so render it and start a new one
        renderFloorSpan(y, lhspans[y], rhspans[y]);
        lhspans[y] = rhspans[y] = x;
      }
    }
  }

  // // render ceil spans that were not closed
  // for (let y = minWallTop; y < maxWallTop; y++) {
  //   // assert(hspans[y] === 1);
  //   renderCeilSpan(y, lhspans[y], rhspans[y]);
  // }

  // render floor spans that were not closed
  for (let y = minWallBottom + 1; y <= maxWallBottom; y++) {
    // assert(hspans[y] === 1);
    renderFloorSpan(y, lhspans[y], rhspans[y]);
  }

  // render horz floor below walls
  for (let y = maxWallBottom + 1; y < vpHeight; y++) {
    renderFloorSpan(y, 0, vpWidth - 1);
  }

  // let framePtr;
  //
  // // render horz line at minWallTop
  // framePtr = startFramePtr + minWallTop * frameStride;
  // for (let x = colStart; x < colEnd; x++) {
  //   frameBuf32[framePtr++] = 0xff00ff00;
  // }
  //
  // // render horz line at maxWallTop
  // framePtr = startFramePtr + maxWallTop * frameStride;
  // for (let x = colStart; x < colEnd; x++) {
  //   frameBuf32[framePtr++] = 0xff00ff00;
  // }
  //
  // // render horz line at minWallBottom
  // framePtr = startFramePtr + minWallBottom * frameStride;
  // for (let x = colStart; x < colEnd; x++) {
  //   frameBuf32[framePtr++] = 0xffffff00;
  // }
  //
  // // render horz line at maxWallBottom
  // framePtr = startFramePtr + maxWallBottom * frameStride;
  // for (let x = colStart; x < colEnd; x++) {
  //   frameBuf32[framePtr++] = 0xffffff00;
  // }

  // render ceil/floor between walls
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

  // render floor below walls
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
  //       const texOffs = (floorTexX << tex.PitchLg2) | floorTexY;
  //       // assert(texOffs >= 0 && texOffs < floorTex.Buf32.length);
  //       const color = tex.Buf32[texOffs];
  //       // console.log(texOffs);
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

function renderViewFullHorz() {
  const {
    frameBuf32,
    startFramePtr,
    frameStride,
    stepXhspans,
    stepYhspans,
    lfloorXhspans,
    lfloorYhspans,
    frameRowPtrs,
    raycaster,
  } = renderParams;

  const {
    FloorTexturesMap: floorTexturesMap,
    WallSlices: wallSlices,
    MapWidth: mapWidth,
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
    lfloorXhspans[y] = posX + sDist * rayDirLeftX;
    lfloorYhspans[y] = posY + sDist * rayDirLeftY;
    stepXhspans[y] = sDist * rayStepX;
    stepYhspans[y] = sDist * rayStepY;
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
  initRender,
  renderBackground,
  renderBorders,
  renderView,
};
