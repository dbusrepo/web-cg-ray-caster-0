// import assert from 'assert';
import type { WasmNullPtr } from '../wasmEngine/wasmRun';
import { WasmRun, WASM_NULL_PTR } from '../wasmEngine/wasmRun';
import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { Texture } from '../wasmEngine/texture';
import { FrameColorRGBAWasm } from '../wasmEngine/frameColorRGBAWasm';
import { FrameColorRGBA } from '../frameColorRGBA';
import { Raycaster } from './raycaster';
import { Sprite } from './sprite';
import { Slice } from './slice';

const CEIL_COLOR = 0xffbbbbbb;
const FLOOR_COLOR = 0xff555555;
const NO_HIT_WALL_COL = 0xff0000ee;
const NO_HIT_WALL_SIDES_COL = [
  NO_HIT_WALL_COL, // side 0
  FrameColorRGBA.darkColor(NO_HIT_WALL_COL), // side 1
];

class Renderer {
  private raycaster: Raycaster;
  private wasmRun: WasmRun;
  private wasmEngineModule: WasmEngineModule;
  private frameBuf32: Uint32Array;
  private occlusionBuf8: Uint8Array;
  private frameStride: number;
  private startFramePtr: number;
  private frameRowPtrs: Uint32Array;
  private occlusionBufRowPtrs: Uint32Array;
  private textures: Texture[];
  private spansX1: Int32Array;
  private spansStepX: Float32Array;
  private spansStepY: Float32Array;
  private spansFloorLX: Float32Array;
  private spansFloorLY: Float32Array;
  private frameCnt: number;
  private useWasmRenderer = false;
  private isFloorTextured = false;
  private back2front = false;
  private vertFloor = false;

  constructor(raycaster: Raycaster) {
    this.raycaster = raycaster;
    const viewport = raycaster.Viewport;
    const {
      StartX: vpStartX,
      StartY: vpStartY,
      Width: vpWidth,
      Height: vpHeight,
    } = viewport;

    this.wasmRun = raycaster.WasmRun;
    this.wasmEngineModule = this.wasmRun.WasmModules.engine;

    this.frameStride = this.wasmRun.FrameStride;

    const { rgbaSurface0: frameBuf8 } = this.wasmRun.WasmViews;

    this.frameBuf32 = new Uint32Array(
      frameBuf8.buffer,
      0,
      frameBuf8.byteLength / Uint32Array.BYTES_PER_ELEMENT,
    );

    this.occlusionBuf8 = new Uint8Array(this.frameBuf32.length); // js buf

    this.startFramePtr = vpStartY * this.frameStride + vpStartX;

    this.frameRowPtrs = new Uint32Array(vpHeight + 1);
    for (let i = 0; i <= vpHeight; i++) {
      this.frameRowPtrs[i] = this.startFramePtr + i * this.frameStride;
    }

    this.occlusionBufRowPtrs = new Uint32Array(vpHeight + 1);
    for (let i = 0; i <= vpHeight; i++) {
      this.occlusionBufRowPtrs[i] = this.startFramePtr + i * this.frameStride;
    }

    // const frameRows = this.frameBuf32.length / this.frameStride;

    this.spansX1 = new Int32Array(vpHeight);
    this.spansStepX = new Float32Array(vpHeight);
    this.spansStepY = new Float32Array(vpHeight);
    this.spansFloorLX = new Float32Array(vpHeight);
    this.spansFloorLY = new Float32Array(vpHeight);

    this.textures = raycaster.Textures;
  }

  public get UseWasmRenderer(): boolean {
    return this.useWasmRenderer;
  }

  // public set UseWasmRenderer(useWasmRenderer: boolean) { // not used
  //   this.useWasmRenderer = useWasmRenderer;
  // }

  public set IsFloorTextured(isFloorTextured: boolean) {
    this.isFloorTextured = isFloorTextured;
  }

  public get IsFloorTextured(): boolean {
    return this.isFloorTextured;
  }

  public set VertFloor(vertFloor: boolean) {
    this.vertFloor = vertFloor;
  }

  public get VertFloor(): boolean {
    return this.vertFloor;
  }

  public get Back2Front(): boolean {
    return this.back2front;
  }

  public set Back2Front(useBack2Front: boolean) {
    this.back2front = useBack2Front;
  }

  public renderBackground(color: number) {
    const { frameBuf32, frameStride, raycaster } = this;

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

  public renderBorders(borderColor: number) {
    const { frameBuf32, frameStride, raycaster } = this;

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

  private renderWallsFloorsVert() {
    const {
      startFramePtr,
      frameBuf32,
      frameStride,
      frameRowPtrs,
      isFloorTextured,
      raycaster,
      textures,
    } = this;

    const {
      FloorMap: floorMap,
      WallSlices: wallSlices,
      MapWidth: mapWidth,
      ProjYCenter: projYCenter,
      WallSlicesOccludedBySprites: wallSlicesOccludedBySprites,
      SpritesTop: spritesTop,
      SpritesBottom: spritesBottom,
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
        // ClipTop: clipTop,
      } = wallSlices[x];

      const colPtr = startFramePtr + x;
      const isWallSliceOccludedBySprite = wallSlicesOccludedBySprites[x];
      top = isWallSliceOccludedBySprite ? spritesTop[x] : top;
      let frameLimitPtr = frameRowPtrs[top] + x;
      let framePtr = colPtr;

      // render ceil
      // for (let y = 0; y < top; y++) {
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        frameBuf32[framePtr] = CEIL_COLOR;
      }
      // assert(framePtr === colPtr + top * frameStride);

      if (!isWallSliceOccludedBySprite) {
        frameLimitPtr = frameRowPtrs[bottom + 1] + x;
        if (hit) {
          const { Buf32: mipPixels, Lg2Pitch: lg2Pitch } = mipmap;

          for (
            let yOffs = (texX << lg2Pitch) + texY; // mipmap is rotated 90ccw
            framePtr < frameLimitPtr;
            framePtr += frameStride, yOffs += texStepY
          ) {
            const color = mipPixels[yOffs | 0];
            frameBuf32[framePtr] = color;
          }
        } else {
          // no hit untextured wall
          // for (let y = top; y <= bottom; y++) {
          for (
            const color = NO_HIT_WALL_SIDES_COL[side];
            framePtr < frameLimitPtr;
            framePtr += frameStride
          ) {
            frameBuf32[framePtr] = color;
          }
        }
        // assert(framePtr === colPtr + (bottom + 1) * frameStride);
      } else {
        // framePtr = frameLimitPtr;
        bottom = spritesBottom[x];
        framePtr = frameRowPtrs[bottom + 1] + x;
      }

      if (!isFloorTextured) {
        for (let y = bottom + 1; y < vpHeight; y++, framePtr += frameStride) {
          frameBuf32[framePtr] = FLOOR_COLOR;
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
  }

  private renderWallsFloorsVertOcclusionChk() {
    const {
      startFramePtr,
      frameBuf32,
      frameStride,
      frameRowPtrs,
      isFloorTextured,
      raycaster,
      textures,
      occlusionBuf8,
    } = this;

    const {
      FloorMap: floorMap,
      WallSlices: wallSlices,
      MapWidth: mapWidth,
      ProjYCenter: projYCenter,
      WallSlicesOccludedBySprites: wallSlicesOccludedBySprites,
      SpritesTop: spritesTop,
      SpritesBottom: spritesBottom,
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
        // Height: projHeight,
        // ClipTop: clipTop,
      } = wallSlices[x];

      const colPtr = startFramePtr + x;
      const isWallSliceOccludedBySprite = wallSlicesOccludedBySprites[x];
      top = isWallSliceOccludedBySprite ? spritesTop[x] : top;
      let frameLimitPtr = frameRowPtrs[top] + x;
      let framePtr = colPtr;
      let occPtr = colPtr;

      // render ceil
      // for (let y = 0; y < top; y++) {
      for (
        ;
        framePtr < frameLimitPtr;
        framePtr += frameStride, occPtr += frameStride
      ) {
        if (!occlusionBuf8[occPtr]) {
          frameBuf32[framePtr] = CEIL_COLOR;
        }
      }
      // assert(framePtr === colPtr + top * frameStride);

      if (!isWallSliceOccludedBySprite) {
        frameLimitPtr = frameRowPtrs[bottom + 1] + x;
        if (hit) {
          const { Buf32: mipPixels, Lg2Pitch: lg2Pitch } = mipmap;

          for (
            let yOffs = (texX << lg2Pitch) + texY;
            framePtr < frameLimitPtr;
            framePtr += frameStride, yOffs += texStepY, occPtr += frameStride
          ) {
            if (!occlusionBuf8[occPtr]) {
              const color = mipPixels[yOffs | 0];
              frameBuf32[framePtr] = color;
            }
          }
        } else {
          // no hit untextured wall
          // for (let y = top; y <= bottom; y++) {
          for (
            const color = NO_HIT_WALL_SIDES_COL[side];
            framePtr < frameLimitPtr;
            framePtr += frameStride, occPtr += frameStride
          ) {
            if (!occlusionBuf8[occPtr]) {
              frameBuf32[framePtr] = color;
            }
          }
        }
        // assert(framePtr === colPtr + (bottom + 1) * frameStride);
      } else {
        bottom = spritesBottom[x];
        framePtr = frameRowPtrs[bottom + 1] + x;
        occPtr = framePtr;
      }

      if (!isFloorTextured) {
        for (
          let y = bottom + 1;
          y < vpHeight;
          y++, framePtr += frameStride, occPtr += frameStride
        ) {
          if (!occlusionBuf8[occPtr]) {
            frameBuf32[framePtr] = FLOOR_COLOR;
          }
        }
      } else {
        let prevFloorMapIdx = null;
        let floorMip;

        for (
          let y = bottom + 1;
          y < vpHeight;
          y++, framePtr += frameStride, occPtr += frameStride
        ) {
          if (occlusionBuf8[occPtr]) {
            continue;
          }
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
  }

  private renderCeilSpan(y: number, x1: number, x2: number) {
    const { frameBuf32, frameRowPtrs } = this;
    let frameRowPtr = frameRowPtrs[y] + x1;
    // let frameRowLimitPtr = startFramePtr + frameRowPtrs[y] + x2;
    // for (let x = x1; x <= x2; x++) {
    // while (frameRowPtr <= frameRowLimitPtr) {
    let numPixels = Math.max(x2 - x1 + 1, 0);
    while (numPixels--) {
      frameBuf32[frameRowPtr++] = CEIL_COLOR;
    }
  }

  private renderCeilSpanOcclusionChk(y: number, x1: number, x2: number) {
    const { frameBuf32, frameRowPtrs, occlusionBuf8, occlusionBufRowPtrs } =
      this;
    let frameRowPtr = frameRowPtrs[y] + x1;
    let occPtr = occlusionBufRowPtrs[y] + x1;
    // let frameRowLimitPtr = startFramePtr + frameRowPtrs[y] + x2;
    // for (let x = x1; x <= x2; x++) {
    // while (frameRowPtr <= frameRowLimitPtr) {
    let numPixels = Math.max(x2 - x1 + 1, 0);
    while (numPixels--) {
      if (!occlusionBuf8[occPtr++]) {
        frameBuf32[frameRowPtr] = CEIL_COLOR;
      }
      frameRowPtr++;
    }
  }

  private renderFloorSpan(y: number, x1: number, x2: number) {
    const {
      frameBuf32,
      spansStepX,
      spansStepY,
      spansFloorLX,
      spansFloorLY,
      frameRowPtrs,
      raycaster,
      textures,
      isFloorTextured: texturedFloor,
    } = this;

    const { FloorMap: floorMap, MapWidth: mapWidth } = raycaster;

    let frameRowPtr = frameRowPtrs[y] + x1;
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
  }

  private renderFloorSpanOcclusionChk(y: number, x1: number, x2: number) {
    const {
      frameBuf32,
      spansStepX,
      spansStepY,
      spansFloorLX,
      spansFloorLY,
      frameRowPtrs,
      raycaster,
      textures,
      isFloorTextured,
      occlusionBuf8,
      occlusionBufRowPtrs,
    } = this;

    const { FloorMap: floorMap, MapWidth: mapWidth } = raycaster;

    let frameRowPtr = frameRowPtrs[y] + x1;
    let occPtr = occlusionBufRowPtrs[y] + x1;
    let numPixels = Math.max(x2 - x1 + 1, 0);
    if (!isFloorTextured) {
      // for (let x = x1; x <= x2; x++) {
      while (numPixels--) {
        if (!occlusionBuf8[occPtr++]) {
          frameBuf32[frameRowPtr] = FLOOR_COLOR;
        }
        frameRowPtr++;
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
        if (!occlusionBuf8[occPtr++]) {
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
        }
        frameRowPtr++;
        floorX += stepX;
        floorY += stepY;
      }
    }
  }

  private renderWallsFloorsHorz() {
    const {
      frameBuf32,
      frameStride,
      spansStepX,
      spansStepY,
      spansFloorLX,
      spansFloorLY,
      frameRowPtrs,
      spansX1,
      raycaster,
    } = this;

    const {
      WallSlices: wallSlices,
      // MapWidth: mapWidth,
      ProjYCenter: projYCenter,
      MinWallTop: minWallTop,
      MinWallBottom: minWallBottom,
      MaxWallBottom: maxWallBottom,
      WallSlicesOccludedBySprites: wallSlicesOccludedBySprites,
      SpritesTop: spritesTop,
      SpritesBottom: spritesBottom,
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
      this.renderCeilSpan(y, 0, vpWidth - 1);
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
      const isWallSliceOccludedBySprite = wallSlicesOccludedBySprites[x];
      top = isWallSliceOccludedBySprite ? spritesTop[x] : top;
      let frameLimitPtr = frameRowPtrs[top] + x;

      // render ceil
      // for (let y = minWallTop; y < top; y++) {
      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        frameBuf32[framePtr] = CEIL_COLOR;
      }
      // assert(framePtr === colPtr + top * frameStride);

      if (!isWallSliceOccludedBySprite) {
        frameLimitPtr = frameRowPtrs[bottom + 1] + x;
        if (hit) {
          const { Buf32: mipPixels, Lg2Pitch: lg2Pitch } = mipmap;

          for (
            let yOffs = (texX << lg2Pitch) + texY;
            framePtr < frameLimitPtr;
            framePtr += frameStride, yOffs += texStepY
          ) {
            const color = mipPixels[yOffs | 0];
            frameBuf32[framePtr] = color;
          }
        } else {
          // no hit untextured wall
          for (
            const color = NO_HIT_WALL_SIDES_COL[side];
            framePtr < frameLimitPtr;
            framePtr += frameStride
          ) {
            frameBuf32[framePtr] = color;
          }
        }
        // assert(framePtr === colPtr + (bottom + 1) * frameStride);
      } else {
        // framePtr = frameLimitPtr;
        bottom = spritesBottom[x];
      }

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
          this.renderFloorSpan(y, spansX1[y], x - 1);
          ++y;
        }
      }

      prevWallBottom = bottom;
    }

    // render floor spans not closed: fill spans below last wall
    for (let y = prevWallBottom + 1; y <= maxWallBottom; y++) {
      this.renderFloorSpan(y, spansX1[y], vpWidth - 1);
    }

    // render horz floor below walls
    for (let y = maxWallBottom + 1; y < vpHeight; y++) {
      this.renderFloorSpan(y, 0, vpWidth - 1);
    }
  }

  private renderWallsFloorsHorzOcclusionChk() {
    const {
      // startFramePtr,
      frameBuf32,
      frameStride,
      spansStepX,
      spansStepY,
      spansFloorLX,
      spansFloorLY,
      frameRowPtrs,
      spansX1,
      raycaster,
      occlusionBuf8,
      occlusionBufRowPtrs,
    } = this;

    const {
      WallSlices: wallSlices,
      // MapWidth: mapWidth,
      ProjYCenter: projYCenter,
      MinWallTop: minWallTop,
      MinWallBottom: minWallBottom,
      MaxWallBottom: maxWallBottom,
      WallSlicesOccludedBySprites: wallSlicesOccludedBySprites,
      SpritesTop: spritesTop,
      SpritesBottom: spritesBottom,
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
      this.renderCeilSpanOcclusionChk(y, 0, vpWidth - 1);
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
      const isWallSliceOccludedBySprite = wallSlicesOccludedBySprites[x];
      top = isWallSliceOccludedBySprite ? spritesTop[x] : top;
      let frameLimitPtr = frameRowPtrs[top] + x;
      let occPtr = occlusionBufRowPtrs[minWallTop] + x;

      // render ceil
      // for (let y = minWallTop; y < top; y++) {
      for (
        ;
        framePtr < frameLimitPtr;
        framePtr += frameStride, occPtr += frameStride
      ) {
        if (!occlusionBuf8[occPtr]) {
          frameBuf32[framePtr] = CEIL_COLOR;
        }
      }
      // assert(framePtr === colPtr + top * frameStride);

      if (!isWallSliceOccludedBySprite) {
        frameLimitPtr = frameRowPtrs[bottom + 1] + x;
        if (hit) {
          const { Buf32: mipPixels, Lg2Pitch: lg2Pitch } = mipmap;

          for (
            let offs = (texX << lg2Pitch) + texY;
            framePtr < frameLimitPtr;
            framePtr += frameStride, offs += texStepY, occPtr += frameStride
          ) {
            if (!occlusionBuf8[occPtr]) {
              const color = mipPixels[offs | 0];
              frameBuf32[framePtr] = color;
            }
          }
        } else {
          // no hit untextured wall
          for (
            const color = NO_HIT_WALL_SIDES_COL[side];
            framePtr < frameLimitPtr;
            framePtr += frameStride, occPtr += frameStride
          ) {
            if (!occlusionBuf8[occPtr]) {
              frameBuf32[framePtr] = color;
            }
          }
        }
        // assert(framePtr === colPtr + (bottom + 1) * frameStride);
      } else {
        bottom = spritesBottom[x];
      }

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
          this.renderFloorSpanOcclusionChk(y, spansX1[y], x - 1);
          ++y;
        }
      }

      prevWallBottom = bottom;
    }

    // render floor spans not closed: fill spans below last wall
    for (let y = prevWallBottom + 1; y <= maxWallBottom; y++) {
      this.renderFloorSpanOcclusionChk(y, spansX1[y], vpWidth - 1);
    }

    // render horz floor below walls
    for (let y = maxWallBottom + 1; y < vpHeight; y++) {
      this.renderFloorSpanOcclusionChk(y, 0, vpWidth - 1);
    }
  }

  private renderTranspSliceB2F(slice: Slice, x: number) {
    const { frameBuf32, frameRowPtrs, frameStride } = this;

    const {
      Top: top,
      Bottom: bottom,
      TexX: texX,
      TexStepY: texStepY,
      TexY: texY,
      Mipmap: mipmap,
    } = slice;

    const { Buf32: mipPixels, Lg2Pitch: lg2Pitch } = mipmap;

    let framePtr = frameRowPtrs[top] + x;
    let frameLimitPtr = frameRowPtrs[bottom + 1] + x;
    const { transpColor } = Texture;

    for (
      let yOffs = (texX << lg2Pitch) + texY;
      framePtr < frameLimitPtr;
      framePtr += frameStride, yOffs += texStepY
    ) {
      const color = mipPixels[yOffs | 0];
      if (color !== transpColor) {
        frameBuf32[framePtr] = color;
      }
    }
  }

  private renderTranspSlicesB2F() {
    const { raycaster } = this;

    const {
      TranspSlices: transpSlices,
      TranspSplicesListsXs: transpSlicesListsXs, // xs of not empty transp slices lists
      NumTranspSlicesLists: numTranspSlicesLists,
    } = raycaster;

    if (!numTranspSlicesLists) {
      return;
    }

    for (let ix = 0; ix < numTranspSlicesLists; ix++) {
      const x = transpSlicesListsXs[ix];
      const startPtr = transpSlices[x] as Slice;
      // the circular doubly linked list is sort by decreasing distance
      let curPtr = startPtr;
      do {
        this.renderTranspSliceB2F(curPtr, x);
        curPtr = curPtr.Next as Slice;
      } while (curPtr !== startPtr);
    }
  }

  private initOcclusionBuf() {
    this.occlusionBuf8.fill(0);
    // const { occlusionBuf8 } = this;
    // for (let i = 0; i < occlusionBuf8.length; ++i) {
    //   occlusionBuf8[i] = 0;
    // }
  }

  private renderTranspSliceF2B(slice: Slice, x: number) {
    const {
      frameBuf32,
      frameStride,
      frameRowPtrs,
      occlusionBuf8,
      occlusionBufRowPtrs,
    } = this;

    const {
      Top: top,
      Bottom: bottom,
      TexX: texX,
      TexStepY: texStepY,
      TexY: texY,
      Mipmap: mipmap,
    } = slice;

    const { Buf32: mipPixels, Lg2Pitch: lg2Pitch } = mipmap;

    let framePtr = frameRowPtrs[top] + x;
    let frameLimitPtr = frameRowPtrs[bottom + 1] + x;
    let occPtr = occlusionBufRowPtrs[top] + x;
    const { transpColor } = Texture;

    for (
      let yOffs = (texX << lg2Pitch) + texY;
      framePtr < frameLimitPtr;
      framePtr += frameStride, yOffs += texStepY, occPtr += frameStride
    ) {
      if (!occlusionBuf8[occPtr]) {
        const color = mipPixels[yOffs | 0];
        if (color !== transpColor) {
          frameBuf32[framePtr] = color;
          occlusionBuf8[occPtr] = 1;
        }
      }
    }
    // assert(framePtr === colPtr + (bottom + 1) * frameStride);
  }

  private renderTranspSlicesF2B() {
    const { raycaster } = this;

    const {
      TranspSlices: transpSlices,
      TranspSplicesListsXs: transpSlicesListsXs,
      NumTranspSlicesLists: numTranspSlicesLists,
    } = raycaster;

    if (!numTranspSlicesLists) {
      return;
    }

    for (let ix = 0; ix < numTranspSlicesLists; ix++) {
      const x = transpSlicesListsXs[ix];
      const startPtr = (transpSlices[x] as Slice).Prev as Slice;
      let curPtr = startPtr;
      do {
        this.renderTranspSliceF2B(curPtr, x);
        curPtr = curPtr.Prev as Slice;
      } while (curPtr !== startPtr);
    }
  }

  private renderSpriteB2F(sprite: Sprite) {
    const { frameBuf32, frameStride, frameRowPtrs } = this;

    const {
      // TexIdx: texIdx,
      // Distance: distance,
      Mipmap: mipmap,
      // StartX: startX,
      // EndX: endX,
      // TexX: startTexX,
      // TexStepX: texStepX,
      StartY: startY,
      EndY: endY,
      TexYOffsets: texYOffsets,
      // MipLevel: mipLvl,
      RenderXs: renderXs,
      NumRenderXs: numRenderXs,
      TexXOffsets: texXOffsets,
      // TexY: texY,
      // TexStepY: texStepY,
    } = sprite;

    const { Buf32: mipPixels, Lg2Pitch: lg2Pitch } = mipmap;

    const { transpColor } = Texture;

    for (let ix = 0; ix < numRenderXs; ++ix) {
      const mipRowOffs = texXOffsets[ix] << lg2Pitch;
      let framePtr = frameRowPtrs[startY] + renderXs[ix];
      for (let y = startY; y <= endY; y++, framePtr += frameStride) {
        const color = mipPixels[mipRowOffs + texYOffsets[y]];
        if (color !== transpColor) {
          frameBuf32[framePtr] = color;
        }
      }
    }
  }

  private renderSpriteF2B(sprite: Sprite) {
    const {
      frameBuf32,
      frameStride,
      frameRowPtrs,
      occlusionBuf8,
      occlusionBufRowPtrs,
    } = this;

    const {
      // TexIdx: texIdx,
      // Distance: distance,
      Mipmap: mipmap,
      // StartX: startX,
      // EndX: endX,
      // TexX: startTexX,
      // TexStepX: texStepX,
      StartY: startY,
      EndY: endY,
      TexYOffsets: texYOffsets,
      // MipLevel: mipLvl,
      RenderXs: renderXs,
      NumRenderXs: numRenderXs,
      TexXOffsets: texXOffsets,
      // TexY: texY,
      // TexStepY: texStepY,
    } = sprite;

    const { Buf32: mipPixels, Lg2Pitch: lg2Pitch } = mipmap;

    const { transpColor } = Texture;

    for (let ix = 0; ix < numRenderXs; ++ix) {
      const mipRowOffs = texXOffsets[ix] << lg2Pitch;
      let framePtr = frameRowPtrs[startY] + renderXs[ix];
      let occPtr = occlusionBufRowPtrs[startY] + renderXs[ix];
      for (
        let y = startY;
        y <= endY;
        y++, framePtr += frameStride, occPtr += frameStride
      ) {
        if (!occlusionBuf8[occPtr]) {
          const color = mipPixels[mipRowOffs + texYOffsets[y]];
          if (color !== transpColor) {
            frameBuf32[framePtr] = color;
            occlusionBuf8[occPtr] = 1;
          }
        }
      }
    }
  }

  private renderSpritesB2F() {
    const { raycaster } = this;
    const { ViewSprites: viewSprites } = raycaster;
    const { NumViewSprites: numViewSprites } = raycaster;

    // from farthest to nearest
    for (let i = numViewSprites; i > 0; --i) {
      this.renderSpriteB2F(viewSprites[i]);
    }
  }

  private renderSpritesF2B() {
    const { raycaster } = this;
    const { ViewSprites: viewSprites } = raycaster;
    const { NumViewSprites: numViewSprites } = raycaster;

    // from nearest to farthest
    for (let i = 1; i <= numViewSprites; ++i) {
      this.renderSpriteF2B(viewSprites[i]);
    }
  }

  private isOcclusionCheckNeeded() {
    const { raycaster } = this;
    const {
      NumTranspSlicesLists: numTranspSlicesLists,
      NumViewSprites: numViewSprites,
    } = raycaster;
    return numTranspSlicesLists || numViewSprites;
  }

  private renderWallsFloorsF2B() {
    if (this.VertFloor) {
      if (this.isOcclusionCheckNeeded()) {
        this.renderWallsFloorsVertOcclusionChk();
      } else {
        this.renderWallsFloorsVert();
      }
    } else if (this.isOcclusionCheckNeeded()) {
      this.renderWallsFloorsHorzOcclusionChk();
    } else {
      this.renderWallsFloorsHorz();
    }
  }

  private renderWallsFloorsB2F() {
    if (this.VertFloor) {
      this.renderWallsFloorsVert();
    } else {
      this.renderWallsFloorsHorz();
    }
  }

  public render(frameCnt: number) {
    this.frameCnt = frameCnt;
    if (this.back2front) {
      this.renderWallsFloorsB2F();
      this.renderTranspSlicesB2F();
      this.renderSpritesB2F();
    } else {
      this.initOcclusionBuf();
      this.renderSpritesF2B();
      this.renderTranspSlicesF2B();
      this.renderWallsFloorsF2B();
    }
  }
}

export default Renderer;
