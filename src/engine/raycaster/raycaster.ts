import assert from 'assert';
import { mainConfig } from '../../config/mainConfig';
import type { InputEvent } from '../../app/events';
import { AssetManager } from '../assets/assetManager';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { InputManager, keys, keyOffsets } from '../../input/inputManager';
import { randColor, makeColor, sleep } from '../utils';

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
import { Texture, initTexture } from './texture';

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

  private wallTextures: Texture[];

  private mapWidth: number;
  private mapHeight: number;

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

    this.backgroundColor = makeColor(0x000000ff);
    // this.renderBackground();
    // this.rotate(Math.PI / 4);

    // this.renderBorders(); // TODO:
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
    // this.wallTextures[0] = initTexture(wasmViews, ascImportImages.BLUESTONE);
    this.wallTextures[0] = initTexture(ascImportImages.GREYSTONE);
    this.wallTextures[1] = initTexture(ascImportImages.BLUESTONE);
    this.wallTextures[2] = initTexture(ascImportImages.REDBRICK);
  }

  castScene() {
    // this.wasmEngine.WasmRun.WasmModules.engine.render();
    // this.wasmEngineModule.render();

    // drawBackground(this.backgroundColor);

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

    const gridWidth = this.mapWidth + 1;

    // for (let x = 0; x < width; x++) {
    for (let x = 0; x < vpWidth; x++) {
      // const cameraX = 2 * x / width - 1;
      const cameraX = (2 * x) / (vpWidth - 1) - 1; // TODO:
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;
      const deltaDistX = Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(1 / rayDirY);

      let stepX, stepY;
      let sideDistX, sideDistY;
      let incX, incY;

      const mapX = posX | 0;
      const mapY = posY | 0;

      if (rayDirX < 0) {
        stepX = -1;
        incX = 0;
        sideDistX = (posX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        incX = 1;
        sideDistX = (mapX + 1.0 - posX) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -gridWidth;
        incY = 0;
        sideDistY = (posY - mapY) * deltaDistY;
      } else {
        stepY = gridWidth;
        incY = gridWidth;
        sideDistY = (mapY + 1.0 - posY) * deltaDistY;
      }

      let hit = false;
      let side;
      let mapIdx = mapY * gridWidth + mapX;
      let MAX_STEPS = 100;
      let perpWallDist = 0.0;
      let texId = 0;
      let wallX = 0;

      do {
        // TODO: check if mapIdx is out of bounds
        if (sideDistX < sideDistY) {
          side = 0;
          if (xGrid[mapIdx + incX] > 0) {
            mapIdx += incX;
            perpWallDist = sideDistX;
            texId = xGrid[mapIdx] - 1;
            wallX = posY + perpWallDist * rayDirY;
            hit = true;
          } else {
            sideDistX += deltaDistX;
            mapIdx += stepX;
          }
        } else {
          side = 1;
          if (yGrid[mapIdx + incY] > 0) {
            mapIdx += incY;
            perpWallDist = sideDistY;
            texId = yGrid[mapIdx] - 1;
            wallX = posX + perpWallDist * rayDirX;
            hit = true;
          } else {
            sideDistY += deltaDistY;
            mapIdx += stepY;
          }
        }
      } while (!hit && --MAX_STEPS);

      if (!hit) {
        // console.log('no hit');
        // break; // TODO:
        continue;
      }

      this.zBuffer[x] = perpWallDist;

      const wallSliceHeight = (this.wallHeight / perpWallDist) | 0;

      const midY = vpHeight >> 1;

      const projWallTop = midY - (wallSliceHeight >> 1);
      const projWallBottom = projWallTop + wallSliceHeight;

      let wallTop = projWallTop < 0 ? 0 : projWallTop;
      let wallBottom =
        projWallBottom >= vpHeight ? vpHeight - 1 : projWallBottom;

      assert(wallTop <= wallBottom, `invalid top ${wallTop} and bottom`); // <= ?
      assert(wallTop >= 0, `invalid top ${wallTop}`);
      assert(wallBottom < vpHeight, `invalid bottom ${wallBottom}`);
      assert(
        texId >= 0 && texId < this.wallTextures.length,
        `invalid texture id ${texId}`,
      );

      const mipLevel = 0;
      const mipmap = this.wallTextures[texId].getMipmap(mipLevel);
      const { Width: texWidth, Height: texHeight } = mipmap;

      // wallX -= Math.floor(wallX);
      // wallX %= 1;
      wallX -= wallX | 0;

      let texX = (wallX * texWidth) | 0;

      if ((side === 0 && rayDirX > 0) || (side === 1 && rayDirY < 0)) {
        texX = texWidth - texX - 1;
      }

      const texStepY = (1 * texHeight) / wallSliceHeight;
      const texPosY = (wallTop - projWallTop) * texStepY;

      const wallSlice = this.wallSlices[x];
      wallSlice.Distance = perpWallDist;
      wallSlice.ColIdx = x;
      wallSlice.Top = wallTop;
      wallSlice.Bottom = wallBottom;
      wallSlice.TexX = texX;
      wallSlice.TexStepY = texStepY;
      wallSlice.TexPosY = texPosY;
      wallSlice.TexId = texId;
      wallSlice.MipLvl = mipLevel;
      wallSlice.CachedMipmap = mipmap;
    }

    // console.log(`render time: ${Date.now() - t0} ms`);
    //
    drawSceneV(this.wallSlices);
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
    // this.xGrid[4 + (mapWidth + 1) * 2] = 3;
    // this.yGrid[4 + (mapWidth + 1) * 1] = 3;
  }

  get Viewport() {
    return this.viewport;
  }

  get Player() {
    return this.player;
  }
}

export { Raycaster, RaycasterParams };
