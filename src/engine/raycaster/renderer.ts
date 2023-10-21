// import assert from 'assert';
import type { WasmNullPtr } from '../wasmEngine/wasmRun';
import { WasmRun, WASM_NULL_PTR } from '../wasmEngine/wasmRun';
import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { Texture } from '../wasmEngine/texture';
import { FrameColorRGBAWasm } from '../wasmEngine/frameColorRGBAWasm';
import { Raycaster } from './raycaster';
import { Sprite } from './sprite';
import { Slice } from './slice';

const CEIL_COLOR = 0xffbbbbbb;
const FLOOR_COLOR = 0xff555555;

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
  private isFloorTextured = false;
  private useWasm = false;
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

  public set IsFloorTextured(isFloorTextured: boolean) {
    this.isFloorTextured = isFloorTextured;
  }

  public get IsFloorTextured(): boolean {
    return this.isFloorTextured;
  }

  public set UseWasm(useWasm: boolean) {
    this.useWasm = useWasm;
  }

  public set VertFloor(vertFloor: boolean) {
    this.vertFloor = vertFloor;
  }

  public get VertFloor(): boolean {
    return this.vertFloor;
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

  private renderViewFullVert() {
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
        Height: projHeight,
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

      // let occPtr = occlusionBufRowPtrs[top] + x; // TODO: remove

      if (hit) {
        const {
          Buf32: mipPixels,
          // Width: texWidth,
          // Height: texHeight,
          Lg2Pitch: lg2Pitch,
        } = mipmap;

        // mipmap is rotated 90ccw
        // const mipStride = 1 << pitchLg2;
        const mipRowOffs = texX << lg2Pitch;

        // let offs = mipRowOffs + texY;
        // for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        //   const color = mipPixels[offs | 0];
        //   frameBuf32[framePtr] = color;
        //   offs += texStepY;
        // }

        let offs = mipRowOffs + texY;
        for (; framePtr < frameLimitPtr; framePtr += frameStride) {
          const color = mipPixels[offs | 0];
          frameBuf32[framePtr] = color;
          offs += texStepY;
        }
      } else {
        // no hit untextured wall
        const color = side === 0 ? 0xff0000ee : 0xff0000aa; // TODO:
        // for (let y = top; y <= bottom; y++) {
        for (; framePtr < frameLimitPtr; framePtr += frameStride) {
          frameBuf32[framePtr] = color;
        }
      }

      // assert(framePtr === colPtr + (bottom + 1) * frameStride);

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

  private renderViewFullVertWithTransps() {
    const {
      startFramePtr,
      frameBuf32,
      frameStride,
      frameRowPtrs,
      isFloorTextured,
      raycaster,
      textures,
      occlusionBuf8,
      occlusionBufRowPtrs,
    } = this;

    const {
      FloorMap: floorMap,
      WallSlices: wallSlices,
      MapWidth: mapWidth,
      ProjYCenter: projYCenter,
      TranspSlices: transpSlices,
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
        Height: projHeight,
        ClipTop: clipTop,
      } = wallSlices[x];

      const colPtr = startFramePtr + x;
      let framePtr = colPtr;
      let frameLimitPtr = frameRowPtrs[top] + x;

      let occPtr = colPtr;

      // render ceil

      // for (let y = 0; y < top; y++) {
      for (; framePtr < frameLimitPtr; framePtr += frameStride, occPtr += frameStride) {
        if (!occlusionBuf8[occPtr]) {
          frameBuf32[framePtr] = CEIL_COLOR;
        }
      }
      // assert(framePtr === colPtr + top * frameStride);

      // const wallSliceHeight = bottom - top + 1;
      // frameLimitPtr = framePtr + wallSliceHeight * frameStride;
      // assert(frameLimitPtr === frameRowPtrs[bottom + 1] + x);
      frameLimitPtr = frameRowPtrs[bottom + 1] + x;
      // let occPtr = occlusionBufRowPtrs[top] + x; // TODO: remove

      const isTranspCol = transpSlices[x] !== WASM_NULL_PTR;

      if (hit) {
        const {
          Buf32: mipPixels,
          // Width: texWidth,
          // Height: texHeight,
          Lg2Pitch: lg2Pitch,
        } = mipmap;

        // mipmap is rotated 90ccw
        // const mipStride = 1 << pitchLg2;
        const mipRowOffs = texX << lg2Pitch;

        // let offs = mipRowOffs + texY;
        // for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        //   const color = mipPixels[offs | 0];
        //   frameBuf32[framePtr] = color;
        //   offs += texStepY;
        // }

        let offs = mipRowOffs + texY;
        if (isTranspCol) {
          for (; framePtr < frameLimitPtr; framePtr += frameStride, occPtr += frameStride) {
            if (!occlusionBuf8[occPtr]) {
              const color = mipPixels[offs | 0];
              frameBuf32[framePtr] = color;
            }
            offs += texStepY;
          }
        } else {
          for (; framePtr < frameLimitPtr; framePtr += frameStride) {
            const color = mipPixels[offs | 0];
            frameBuf32[framePtr] = color;
            offs += texStepY;
          }
        }
      } else {
        // no hit untextured wall
        const color = side === 0 ? 0xff0000ee : 0xff0000aa; // TODO:
        // for (let y = top; y <= bottom; y++) {
        for (; framePtr < frameLimitPtr; framePtr += frameStride, occPtr += frameStride) {
          if (!occlusionBuf8[occPtr]) {
            frameBuf32[framePtr] = color;
          }
        }
      }

      // assert(framePtr === colPtr + (bottom + 1) * frameStride);

      if (!isFloorTextured) {
        for (let y = bottom + 1; y < vpHeight; y++, framePtr += frameStride, occPtr += frameStride) {
          if (!occlusionBuf8[occPtr]) {
            frameBuf32[framePtr] = FLOOR_COLOR;
          }
        }
      } else {
        let prevFloorMapIdx = null;
        let floorMip;

        if (isTranspCol) {
          for (let y = bottom + 1; y < vpHeight; y++, framePtr += frameStride, occPtr += frameStride) {
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
        } else {
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
      }
      // assert(framePtr === colPtr + vpHeight * frameStride);
    }
  }

  private renderViewFullVert2() {
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
      isFloorTextured: texturedFloor,
      textures,
    } = this;

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

  private renderCeilSpan(y: number, x1: number, x2: number) {
    const { frameBuf32, startFramePtr, frameRowPtrs } = this;
    let frameRowPtr = startFramePtr + frameRowPtrs[y] + x1;
    // let frameRowLimitPtr = startFramePtr + frameRowPtrs[y] + x2;
    // for (let x = x1; x <= x2; x++) {
    // while (frameRowPtr <= frameRowLimitPtr) {
    let numPixels = Math.max(x2 - x1 + 1, 0);
    while (numPixels--) {
      frameBuf32[frameRowPtr++] = CEIL_COLOR;
    }
  }

  private renderFloorSpan(y: number, x1: number, x2: number) {
    const {
      frameBuf32,
      startFramePtr,
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
  }

  private renderViewWallsVertFloorsHorz() {
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
    } = this;

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

  private renderViewFullHorz() {
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
    } = this;

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
      this.renderCeilSpan(y, 0, vpWidth - 1);
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
          this.renderFloorSpan(y, x1span, x2span);
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
      this.renderFloorSpan(y, x1span, x2span);
    }

    // render floor spans below maxWallBottom
    for (let y = maxWallBottom + 1; y < vpHeight; y++) {
      this.renderFloorSpan(y, 0, vpWidth - 1);
    }
  }

  private renderTranspSlicesB2F() {
    const {
      startFramePtr,
      frameBuf32,
      frameStride,
      frameRowPtrs,
      raycaster,
      textures,
    } = this;

    const {
      TranspSlices: transpSlices,
      NumTranspSlicesList: numTranspSlicesList,
      MapWidth: mapWidth,
    } = raycaster;

    const {
      // StartX: vpStartX,
      // StartY: vpStartY,
      Width: vpWidth,
      Height: vpHeight,
    } = raycaster.Viewport;

    if (!numTranspSlicesList) {
      return;
    }

    const renderSlice = (slice: Slice, x: number) => {
      const {
        Hit: hit,
        Top: top,
        Bottom: bottom,
        TexX: texX,
        TexStepY: texStepY,
        TexY: texY,
        Mipmap: mipmap,
        Side: side,
      } = slice;

      const {
        Buf32: mipPixels,
        // Width: texWidth,
        // Height: texHeight,
        Lg2Pitch: lg2Pitch,
      } = mipmap;

      const { transpColor } = Texture;

      let offs = (texX << lg2Pitch) + texY;

      let framePtr = frameRowPtrs[top] + x;
      let frameLimitPtr = frameRowPtrs[bottom + 1] + x;

      for (; framePtr < frameLimitPtr; framePtr += frameStride) {
        const color = mipPixels[offs | 0];
        if (color !== transpColor) {
          frameBuf32[framePtr] = color;
        }
        offs += texStepY;
      }
      // assert(framePtr === colPtr + (bottom + 1) * frameStride);
    };

    for (let x = 0; x < vpWidth; x++) {
      const startPtr = transpSlices[x]; // double linked list
      if (startPtr !== WASM_NULL_PTR) {
        let curPtr = startPtr;
        do {
          renderSlice(curPtr, x);
          curPtr = curPtr.Next as Slice;
        } while (curPtr !== startPtr);
      }
    }
  }

  private renderTranspSlicesF2B() {
    const {
      startFramePtr,
      frameBuf32,
      occlusionBuf8,
      occlusionBufRowPtrs,
      frameStride,
      frameRowPtrs,
      raycaster,
      textures,
    } = this;

    // memset occlusion buffer TODO:
    const occlusionBufSize = occlusionBuf8.length;
    for (let i = 0; i < occlusionBufSize; ++i) {
      occlusionBuf8[i] = 0;
    }

    const {
      TranspSlices: transpSlices,
      NumTranspSlicesList: numTranspSlicesList,
      MapWidth: mapWidth,
    } = raycaster;

    const {
      // StartX: vpStartX,
      // StartY: vpStartY,
      Width: vpWidth,
      Height: vpHeight,
    } = raycaster.Viewport;

    if (!numTranspSlicesList) {
      return;
    }

    const renderSlice = (slice: Slice, x: number) => {
      const {
        Hit: hit,
        Top: top,
        Bottom: bottom,
        TexX: texX,
        TexStepY: texStepY,
        TexY: texY,
        Mipmap: mipmap,
        Side: side,
      } = slice;

      const {
        Buf32: mipPixels,
        // Width: texWidth,
        // Height: texHeight,
        Lg2Pitch: lg2Pitch,
      } = mipmap;

      const { transpColor } = Texture;

      let offs = (texX << lg2Pitch) + texY;

      let framePtr = frameRowPtrs[top] + x;
      let frameLimitPtr = frameRowPtrs[bottom + 1] + x;

      let occPtr = occlusionBufRowPtrs[top] + x;

      for (; framePtr < frameLimitPtr; framePtr += frameStride, occPtr += frameStride) {
        const color = mipPixels[offs | 0];
        if (!occlusionBuf8[occPtr] && color !== transpColor) {
          frameBuf32[framePtr] = color;
          occlusionBuf8[occPtr] = 1;
        }
        offs += texStepY;
      }
      // assert(framePtr === colPtr + (bottom + 1) * frameStride);
    };

    for (let x = 0; x < vpWidth; x++) {
      if (transpSlices[x] !== WASM_NULL_PTR) {
        const startPtr = (transpSlices[x] as Slice).Prev as Slice; // double linked list
        let curPtr = startPtr;
        do {
          renderSlice(curPtr, x);
          curPtr = curPtr.Prev as Slice;
        } while (curPtr !== startPtr);
      }
    }
  }

  private renderSprite(sprite: Sprite) {
    // TODO:
  }

  private renderSprites() {
    const viewSprites = this.raycaster.ViewSprites;
    const numViewSprites = this.raycaster.NumViewSprites;

    for (let i = 0; i < numViewSprites; ++i) {
      this.renderSprite(viewSprites[i]);
    }
  }

  private renderWalls() {
    const { raycaster } = this;
    const { NumTranspSlicesList } = raycaster;
    if (this.VertFloor) {
      if (NumTranspSlicesList) {
        this.renderViewFullVertWithTransps();
      } else {
        this.renderViewFullVert();
      }
      // this.renderViewFullVert2();
    } else {
      this.renderViewWallsVertFloorsHorz();
      // this.renderViewFullHorz(); // TODO:
    }
  }

  public render() {
    // if (this.useWasm) {
    //   this.wasmEngineModule.render();
    // } else {
    this.renderTranspSlicesF2B();
    this.renderWalls();
    // this.renderTranspSlicesB2F();
    this.renderSprites(); // TODO:
  }
}

export default Renderer;
