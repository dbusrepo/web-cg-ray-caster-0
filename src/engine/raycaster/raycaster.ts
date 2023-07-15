import assert from 'assert';
import { mainConfig } from '../../config/mainConfig';
import type { InputEvent } from '../../app/events';
import { AssetManager } from '../assets/assetManager';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { InputManager, keys, keyOffsets } from '../../input/inputManager';
import { randColor, colorRGBAtoABGR, sleep } from '../utils';

import type { WasmEngineParams } from '../wasmEngine/wasmEngine';
import { WasmEngine } from '../wasmEngine/wasmEngine';
import type { WasmViews } from '../wasmEngine/wasmViews';
import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { WasmRun } from '../wasmEngine/wasmRun';
import { Viewport, getWasmViewportView } from './viewport';
import { Player, getWasmPlayerView } from './player';
import { WallSlice, getWasmWallSlicesView } from './wallslice';
import { initDrawParams, drawBackground, drawSceneV } from './draw';

import { ascImportImages } from '../../../assets/build/images';
import { Texture, initTexturePair } from './texture';

type RaycasterParams = {
  wasmRun: WasmRun;
  frameStride: number;
};

class Raycaster {
  private params: RaycasterParams;

  private viewport: Viewport;
  private player: Player;

  private wasmEngineModule: WasmEngineModule;

  private wasmRaycasterPtr: number;

  private wallTextures: Texture[][];

  private mapWidth: number;
  private mapHeight: number;

  private floorMap: Uint8Array;
  // private ceilingMap: Uint8Array;

  private xGrid: Uint8Array;
  private yGrid: Uint8Array;

  private zBuffer: Float32Array;
  private wallSlices: WallSlice[];

  private wallHeight: number;

  private backgroundColor: number;

  public async init(params: RaycasterParams) {
    this.params = params;
    const { wasmRun } = params;

    this.initTextures();

    this.wasmEngineModule = wasmRun.WasmModules.engine;
    this.wasmRaycasterPtr = this.wasmEngineModule.getRaycasterPtr();

    this.player = getWasmPlayerView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );
    this.viewport = getWasmViewportView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );

    this.initFrameBuf();

    this.initZBufferView();
    this.initWallSlices();

    // this.wallHeight = this.cfg.canvas.height;
    this.wallHeight = this.viewport.Height; // TODO:

    // console.log('raycaster starting...');

    this.backgroundColor = colorRGBAtoABGR(0x000000ff);
    // this.renderBackground();
    // this.rotate(Math.PI / 4);

    // this.renderBorders(); // TODO:

    this.initMap();
    this.initFloorMap();
  }

  private initFrameBuf() {
    const { wasmRun } = this.params;
    const { rgbaSurface0: frameBuf8 } = wasmRun.WasmViews;

    const frameBuf32 = new Uint32Array(
      frameBuf8.buffer,
      0,
      frameBuf8.byteLength / Uint32Array.BYTES_PER_ELEMENT,
    );

    const { frameStride } = this.params;

    assert(this.wallTextures, 'wall textures not initialized');

    initDrawParams(
      frameBuf32,
      frameStride,
      this.viewport.StartX,
      this.viewport.StartY,
      this.viewport.Width,
      this.viewport.Height,
      this.wallTextures,
    );
  }

  private initZBufferView() {
    const zBufferPtr = this.wasmEngineModule.getZBufferPtr(
      this.wasmRaycasterPtr,
    );
    this.zBuffer = new Float32Array(
      this.params.wasmRun.WasmMem.buffer,
      zBufferPtr,
      this.viewport.Width,
    );
  }

  private initWallSlices() {
    const numWallSlices = this.viewport.Width;
    this.wallSlices = getWasmWallSlicesView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
      numWallSlices,
    );
  }

  private initTextures() {
    this.wallTextures = [];
    this.wallTextures[0] = initTexturePair(
      ascImportImages.GREYSTONE,
      ascImportImages.GREYSTONE_D,
    );
    this.wallTextures[1] = initTexturePair(
      ascImportImages.BLUESTONE,
      ascImportImages.BLUESTONE_D,
    );
    this.wallTextures[2] = initTexturePair(
      ascImportImages.REDBRICK,
      ascImportImages.REDBRICK_D,
    );
  }

  public initMap() {
    const { wasmRun } = this.params;

    // TODO:
    const mapWidth = 10;
    const mapHeight = 10;

    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    this.wasmEngineModule.allocMap(mapWidth, mapHeight);

    const xGridPtr = this.wasmEngineModule.getXGridPtr(this.wasmRaycasterPtr);
    const yGridPtr = this.wasmEngineModule.getYGridPtr(this.wasmRaycasterPtr);

    // console.log(`xGridPtr=${xGridPtr}, yGridPtr=${yGridPtr}`);

    this.xGrid = new Uint8Array(
      wasmRun.WasmMem.buffer,
      xGridPtr,
      (mapWidth + 1) * mapHeight,
    );

    this.yGrid = new Uint8Array(
      wasmRun.WasmMem.buffer,
      yGridPtr,
      (mapWidth + 1) * (mapHeight + 1),
    );

    for (let i = 0; i < mapHeight; i++) {
      this.xGrid[i * (mapWidth + 1)] = 1;
      this.xGrid[i * (mapWidth + 1) + mapWidth] = 1;
    }

    // ignore last col mapWidth, it's there to have the same width as xGrid
    for (let i = 0; i < mapWidth; i++) {
      this.yGrid[i] = 1;
      this.yGrid[mapHeight * (mapWidth + 1) + i] = 1;
    }

    this.xGrid[4] = 1;
    this.yGrid[2] = 0;

    // this.xGrid[4 + (mapWidth + 1) * 2] = 3;
    this.yGrid[4 + (mapWidth + 1) * 2] = 3;
  }

  private initFloorMap() {
    this.floorMap = new Uint8Array(this.mapWidth * this.mapHeight);
  }

  castScene() {
    // this.wasmEngine.WasmRun.WasmModules.engine.render();
    // this.wasmEngineModule.render();

    // drawBackground(this.backgroundColor);

    const { mapWidth, mapHeight } = this;
    const { xGrid, yGrid } = this;
    const { Width: vpWidth, Height: vpHeight } = this.viewport;
    const {
      PosX: posX,
      PosY: posY,
      DirX: dirX,
      DirY: dirY,
      PlaneX: planeX,
      PlaneY: planeY,
    } = this.player;

    const mapX = posX | 0;
    const mapY = posY | 0;
    assert(mapX >= 0 && mapX < mapWidth, 'mapX out of bounds');
    assert(mapY >= 0 && mapY < mapHeight, 'mapY out of bounds');

    const cellX = posX - mapX;
    const cellY = posY - mapY;

    const gridWidth = mapWidth + 1;
    const srcMapIdx = mapY * gridWidth + mapX;

    const colStart = 0;
    const colEnd = vpWidth;

    // for (let x = 0; x < width; x++) {
    for (let x = colStart; x < colEnd; x++) {
      // const cameraX = (2 * x) / vpWidth - 1;
      const cameraX = (2 * x) / (vpWidth - 1) - 1; // TODO:
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;
      const deltaDistX = 1 / Math.abs(rayDirX);
      const deltaDistY = 1 / Math.abs(rayDirY);

      let stepX, stepY;
      let sideDistX, sideDistY;
      let incX, incY;

      if (rayDirX < 0) {
        stepX = -1;
        incX = 0;
        sideDistX = cellX * deltaDistX;
      } else {
        stepX = 1;
        incX = 1;
        sideDistX = (1.0 - cellX) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -gridWidth;
        incY = 0;
        sideDistY = cellY * deltaDistY;
      } else {
        stepY = gridWidth;
        incY = gridWidth;
        sideDistY = (1.0 - cellY) * deltaDistY;
      }

      // let hit = false;
      let side = 0;
      let gridIdx = srcMapIdx;
      let MAX_STEPS = 100; // TODO:
      let perpWallDist = 0.0;
      let texId = 0;
      let wallX = 0;
      let flipTexX = false;
      let outOfGrid = false;

      do {
        if (sideDistX < sideDistY) {
          const checkGridIdx = gridIdx + incX;
          if (checkGridIdx < 0 || checkGridIdx >= xGrid.length) {
            outOfGrid = true;
            break;
          }
          side = 0;
          perpWallDist = sideDistX;
          if (xGrid[checkGridIdx] > 0) {
            texId = xGrid[checkGridIdx] - 1;
            wallX = posY + perpWallDist * rayDirY;
            flipTexX = rayDirX > 0;
            break;
          } else {
            sideDistX += deltaDistX;
            gridIdx += stepX;
          }
        } else {
          const checkGridIdx = gridIdx + incY;
          if (checkGridIdx < 0 || checkGridIdx >= yGrid.length) {
            outOfGrid = true;
            break;
          }
          side = 1;
          perpWallDist = sideDistY;
          if (yGrid[checkGridIdx] > 0) {
            texId = yGrid[checkGridIdx] - 1;
            wallX = posX + perpWallDist * rayDirX;
            flipTexX = rayDirY < 0;
            break;
          } else {
            sideDistY += deltaDistY;
            gridIdx += stepY;
          }
        }
      } while (--MAX_STEPS);

      this.zBuffer[x] = perpWallDist;

      const wallSliceHeight = (this.wallHeight / perpWallDist) | 0;

      const midY = vpHeight >> 1;
      const projWallTop = midY - (wallSliceHeight >> 1);
      const projWallBottom = projWallTop + wallSliceHeight;

      let wallTop = projWallTop;
      if (projWallTop < 0) {
        wallTop = 0;
      }

      let wallBottom = projWallBottom;
      if (projWallBottom >= vpHeight) {
        wallBottom = vpHeight - 1;
      }

      assert(wallTop <= wallBottom, `invalid top ${wallTop} and bottom`); // <= ?
      assert(wallTop >= 0, `invalid top ${wallTop}`);
      assert(wallBottom < vpHeight, `invalid bottom ${wallBottom}`);

      const wallSlice = this.wallSlices[x];
      wallSlice.Distance = perpWallDist;
      wallSlice.Top = wallTop;
      wallSlice.Bottom = wallBottom;

      if (outOfGrid || MAX_STEPS <= 0) {
        wallSlice.Hit = 0;
        // console.log('MAX_STEPS exceeded');
        // console.log('no hit');
        // break; // TODO:
        // continue loopCol;
        continue;
      }

      wallSlice.Hit = 1;
      wallSlice.Side = side;

      assert(
        texId >= 0 && texId < this.wallTextures.length,
        `invalid texture id ${texId}`,
      );

      const mipLevel = 0;
      const mipmap = this.wallTextures[texId][side].getMipmap(mipLevel);
      const { Width: texWidth, Height: texHeight } = mipmap;

      // wallX -= Math.floor(wallX);
      // wallX %= 1;
      wallX -= wallX | 0;
      if (flipTexX) {
        wallX = 1 - wallX;
      }

      const texX = wallX * texWidth;

      assert(texX >= 0 && texX < texWidth, `invalid texX ${texX}`);

      const texStepY = texHeight / wallSliceHeight;
      const texPosY = (wallTop - projWallTop) * texStepY;

      wallSlice.TexId = texId;
      wallSlice.TexX = texX;
      wallSlice.TexStepY = texStepY;
      wallSlice.TexPosY = texPosY;
      wallSlice.MipLvl = mipLevel;
      wallSlice.CachedMipmap = mipmap;
    }

    // console.log(`render time: ${Date.now() - t0} ms`);

    // console.log('Rendering ', wallSliceIdx, ' wall slices');
    drawSceneV(this.wallSlices, colStart, colEnd);
  }

  get Viewport() {
    return this.viewport;
  }

  get Player() {
    return this.player;
  }
}

export { Raycaster, RaycasterParams };
