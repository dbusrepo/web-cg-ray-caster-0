import assert from 'assert';
import { mainConfig } from '../../config/mainConfig';
import type { InputEvent } from '../../app/events';
import { AssetManager } from '../assets/assetManager';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { InputManager, keys, keyOffsets } from '../../input/inputManager';
import { sleep } from '../utils';

import type { WasmEngineParams } from '../wasmEngine/wasmEngine';
import { WasmEngine } from '../wasmEngine/wasmEngine';
import type { WasmViews } from '../wasmEngine/wasmViews';
import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { WasmRun } from '../wasmEngine/wasmRun';
import { Viewport, getWasmViewportView } from './viewport';
import { Player, getWasmPlayerView } from './player';
import { WallSlice, getWasmWallSlicesView } from './wallslice';
import {
  DrawSceneVParams,
  initDrawParams,
  drawBackground,
  drawSceneVert,
} from './draw';

import { ascImportImages } from '../../../assets/build/images';
import { Texture, initTexture, initTexturePair } from './texture';
import {
  FrameColorRGBAWasm,
  getFrameColorRGBAWasmView,
} from '../wasmEngine/frameColorRGBAWasm';

type RaycasterParams = {
  wasmRun: WasmRun;
  frameStride: number;
};

class Raycaster {
  private params: RaycasterParams;

  private viewport: Viewport;
  private player: Player;

  private wasmEngineModule: WasmEngineModule;
  private frameColorRGBAWasm: FrameColorRGBAWasm;

  private wasmRaycasterPtr: number;

  private mapWidth: number;
  private mapHeight: number;

  private wallTextures: Texture[][];
  private floorTextures: Texture[];

  private floorTexturesMap: Texture[];
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
    this.frameColorRGBAWasm = getFrameColorRGBAWasmView(this.wasmEngineModule);
    this.wasmRaycasterPtr = this.wasmEngineModule.getRaycasterPtr();

    this.player = getWasmPlayerView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );
    this.viewport = getWasmViewportView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );

    this.initZBufferView();
    this.initWallSlices();

    // this.wallHeight = this.cfg.canvas.height;
    this.wallHeight = this.viewport.Height; // TODO:

    // console.log('raycaster starting...');

    this.backgroundColor = FrameColorRGBAWasm.colorRGBAtoABGR(0x000000ff);
    // this.renderBackground();
    // this.rotate(Math.PI / 4);

    // this.renderBorders(); // TODO:

    this.initMap();
    this.initFloorMap();

    this.initFrameBuf();
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
      this.floorTexturesMap,
      this.frameColorRGBAWasm,
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

    this.floorTextures = [];
    this.floorTextures[0] = initTexture(ascImportImages.GREYSTONE);
    this.floorTextures[1] = initTexture(ascImportImages.BLUESTONE);
  }

  public initMap() {
    const { wasmRun } = this.params;

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
    // this.yGrid[2] = 0; // test hole // TODO:

    // this.xGrid[4 + (mapWidth + 1) * 2] = 3;
    this.yGrid[4 + (mapWidth + 1) * 2] = 3;
  }

  private initFloorMap() {
    let texId = 0;
    this.floorTexturesMap = new Array<Texture>(this.mapWidth * this.mapHeight);
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        texId = 0;
        assert(texId >= 0 && texId < this.floorTextures.length);
        this.floorTexturesMap[y * this.mapWidth + x] =
          this.floorTextures[texId];
      }
    }
    texId = 1;
    assert(texId >= 0 && texId < this.floorTextures.length);
    this.floorTexturesMap[4 * this.mapWidth + 4] = this.floorTextures[texId];
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

    const midY = vpHeight >> 1;

    // for (let x = 0; x < width; x++) {
    for (let x = colStart; x < colEnd; x++) {
      // const cameraX = (2 * x) / vpWidth - 1;
      const cameraX = (2 * x) / (vpWidth - 1) - 1; // TODO:
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;
      const deltaDistX = 1 / Math.abs(rayDirX);
      const deltaDistY = 1 / Math.abs(rayDirY);

      let stepX, stepY; // +1 or -1, step in map
      let offsX, offsY; // offset in linear grid
      let incX, incY; // offsets to check right/bottom walls in xgrid/ygrid
      let sideDistX, sideDistY; // distances to next x/y grid line

      if (rayDirX < 0) {
        stepX = -1;
        offsX = -1;
        incX = 0;
        sideDistX = cellX * deltaDistX;
      } else {
        stepX = 1;
        offsX = 1;
        incX = 1;
        sideDistX = (1.0 - cellX) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        offsY = -gridWidth;
        incY = 0;
        sideDistY = cellY * deltaDistY;
      } else {
        stepY = 1;
        offsY = gridWidth;
        incY = gridWidth;
        sideDistY = (1.0 - cellY) * deltaDistY;
      }

      // let hit = false;
      let side = 0;
      let gridIdx = srcMapIdx;
      let checkGridIdx;
      let MAX_STEPS = 100; // TODO:
      let perpWallDist = 0.0;
      let texId = 0;
      let wallX = 0;
      let flipTexX = false;
      let outOfGrid = false;
      let rayMapX = mapX;
      let rayMapY = mapY;

      do {
        if (sideDistX < sideDistY) {
          checkGridIdx = gridIdx + incX;
          if (checkGridIdx < 0 || checkGridIdx >= xGrid.length) {
            outOfGrid = true;
            break;
          }
          side = 0;
          perpWallDist = sideDistX;
          if (!xGrid[checkGridIdx]) {
            sideDistX += deltaDistX;
            gridIdx += offsX;
            rayMapX += stepX;
          } else {
            break;
          }
        } else {
          checkGridIdx = gridIdx + incY;
          if (checkGridIdx < 0 || checkGridIdx >= yGrid.length) {
            outOfGrid = true;
            break;
          }
          side = 1;
          perpWallDist = sideDistY;
          if (!yGrid[checkGridIdx]) {
            sideDistY += deltaDistY;
            gridIdx += offsY;
            rayMapY += stepY;
          } else {
            break;
          }
        }
      } while (--MAX_STEPS);

      this.zBuffer[x] = perpWallDist;

      const wallSliceHeight = (this.wallHeight / perpWallDist) | 0;

      const projWallTop = midY - (wallSliceHeight >> 1);
      const projWallBottom = projWallTop + wallSliceHeight;

      let wallTop = projWallTop;
      if (projWallTop < 0) {
        wallTop = 0;
      }

      let wallBottom = projWallBottom;
      if (projWallBottom >= vpHeight) {
        wallBottom = vpHeight;
      }

      // assert(wallTop <= wallBottom, `invalid top ${wallTop} and bottom`); // <= ?
      // assert(wallTop >= 0, `invalid top ${wallTop}`);
      // assert(wallBottom <= vpHeight, `invalid bottom ${wallBottom}`);

      const wallSlice = this.wallSlices[x];
      wallSlice.Distance = perpWallDist;
      wallSlice.Top = wallTop;
      wallSlice.Bottom = wallBottom;
      wallSlice.Side = side;

      if (outOfGrid || MAX_STEPS <= 0) {
        wallSlice.Hit = 0;
        // console.log('MAX_STEPS exceeded');
        // console.log('no hit');
        // break; // TODO:
        // continue loopCol;
        continue;
      }

      wallSlice.Hit = 1;

      // used for vert floor/ceil rend
      let floorWallX;
      let floorWallY;

      const sliceHeight = wallBottom - wallTop;

      if (side === 0) {
        texId = xGrid[checkGridIdx] - 1;
        wallX = posY + perpWallDist * rayDirY;
        wallX -= wallX | 0;
        flipTexX = rayDirX > 0;
        floorWallY = rayMapY + wallX;
        floorWallX = rayMapX;
        if (rayDirX > 0) {
          floorWallX += 1;
        }
      } else {
        texId = yGrid[checkGridIdx] - 1;
        wallX = posX + perpWallDist * rayDirX;
        wallX -= wallX | 0;
        flipTexX = rayDirY < 0;
        floorWallX = rayMapX + wallX;
        floorWallY = rayMapY;
        if (rayDirY > 0) {
          floorWallY += 1;
        }
      }

      wallSlice.floorWallX = floorWallX;
      wallSlice.floorWallY = floorWallY;

      // assert(
      //   texId >= 0 && texId < this.wallTextures.length,
      //   `invalid texture id ${texId}`,
      // );

      const mipLevel = 0;
      const mipmap = this.wallTextures[texId][side].getMipmap(mipLevel);
      const { Width: texWidth, Height: texHeight } = mipmap;

      // wallX -= Math.floor(wallX);
      // wallX %= 1;
      // wallX -= wallX | 0;

      let texX = (wallX * texWidth) | 0;
      if (flipTexX) {
        texX = texWidth - texX - 1;
      }
      // assert(texX >= 0 && texX < texWidth, `invalid texX ${texX}`);

      const texStepY = texHeight / wallSliceHeight;
      const texPosY = (wallTop - projWallTop) * texStepY;

      wallSlice.TexId = texId;
      wallSlice.TexX = texX;
      wallSlice.TexStepY = texStepY;
      wallSlice.TexPosY = texPosY;
      wallSlice.MipLvl = mipLevel;
      wallSlice.CachedMipmap = mipmap;

      // const sliceHeight = wallBottom - wallTop;
      // if (sliceHeight < vpHeight) {
        // floor visible
        // if (side === 0 && rayDirX > 0) {
        //   floorWallX = rayMapX + 1.0;
        //   floorWallY = rayMapY + wallX;
        // } else if (side === 0 && rayDirX < 0) {
        //   floorWallX = rayMapX;
        //   floorWallY = rayMapY + wallX;
        // } else if (side === 1 && rayDirY > 0) {
        //   floorWallX = rayMapX + wallX;
        //   floorWallY = rayMapY + 1.0;
        // } else {
        //   floorWallX = rayMapX + wallX;
        //   floorWallY = rayMapY;
        // }
        //
        // wallSlice.floorWallX = floorWallX;
        // wallSlice.floorWallY = floorWallY;
      // }
    } // end col loop

    const drawSceneVParams = {
      wallSlices: this.wallSlices,
      colStart,
      colEnd,
      posX,
      posY,
      mapWidth,
      mapHeight,
      floorTexturesMap: this.floorTexturesMap, // TODO: move
    };

    drawSceneVert(drawSceneVParams);
  }

  get Viewport() {
    return this.viewport;
  }

  get Player() {
    return this.player;
  }
}

export { Raycaster, RaycasterParams };
