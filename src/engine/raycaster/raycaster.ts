import assert from 'assert';
// import { mainConfig } from '../../config/mainConfig';
// import type { InputEvent } from '../../app/events';
// import { AssetManager } from '../assets/assetManager';
// import { BitImageRGBA } from '../assets/images/bitImageRGBA';
// import { InputManager, keys, keyOffsets } from '../../input/inputManager';
// import { sleep } from '../utils';

// import type { WasmEngineParams } from '../wasmEngine/wasmEngine';
// import { WasmEngine } from '../wasmEngine/wasmEngine';
// import type { WasmViews } from '../wasmEngine/wasmViews';
import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { WasmRun } from '../wasmEngine/wasmRun';
import { Viewport, getWasmViewportView } from './viewport';
import { Player, getWasmPlayerView } from './player';
import { WallSlice, getWasmWallSlicesView } from './wallslice';
import {
  drawBorders,
  DrawViewParams,
  initDrawParams,
  drawBackground,
  drawViewVert,
  drawViewVertHorz,
  drawViewHorz,
} from './draw';

import { ascImportImages } from '../../../assets/build/images';
import { Texture, initTexture, initTexturePair } from './texture';
import {
  FrameColorRGBAWasm,
  getFrameColorRGBAWasmView,
} from '../wasmEngine/frameColorRGBAWasm';

type RaycasterParams = {
  wasmRun: WasmRun;
};

class Raycaster {
  private params: RaycasterParams;
  private wasmRun: WasmRun;

  private viewport: Viewport;
  private player: Player;

  private wasmEngineModule: WasmEngineModule;
  private frameColorRGBAWasm: FrameColorRGBAWasm;

  private wasmRaycasterPtr: number;

  private mapWidth: number;
  private mapHeight: number;

  private wallTextures: Texture[][];
  private floorTextures: Texture[];

  // private ceilingMap: Uint8Array;
  // private floorMap: Uint8Array;
  private floorTexturesMap: Texture[];

  private xGrid: Uint8Array;
  private yGrid: Uint8Array;

  private wallSlices: WallSlice[];

  private zBuffer: Float32Array;
  private projYCenterPtr: number;
  private minWallTopPtr: number;
  private maxWallTopPtr: number;
  private minWallBottomPtr: number;
  private maxWallBottomPtr: number;

  private wallHeight: number;

  private borderColorPtr: number;

  private backgroundColor: number;

  public async init(params: RaycasterParams) {
    this.params = params;

    this.wasmRun = params.wasmRun;

    this.initTextures();

    this.wasmEngineModule = this.wasmRun.WasmModules.engine;

    this.frameColorRGBAWasm = getFrameColorRGBAWasmView(this.wasmEngineModule);

    this.wasmRaycasterPtr = this.wasmEngineModule.getRaycasterPtr();

    this.initViewport();
    this.initPlayer();
    this.initBorderColor();

    this.wasmEngineModule.initRaycaster();

    this.initZBuffer();
    this.initWallSlices();

    this.projYCenterPtr = this.wasmEngineModule.getProjYCenterPtr(
      this.wasmRaycasterPtr,
    );
    this.ProjYCenter = this.viewport.Height / 2;

    this.minWallTopPtr = this.wasmEngineModule.getMinWallTopPtr(
      this.wasmRaycasterPtr,
    );
    this.maxWallTopPtr = this.wasmEngineModule.getMaxWallTopPtr(
      this.wasmRaycasterPtr,
    );
    this.minWallBottomPtr = this.wasmEngineModule.getMinWallBottomPtr(
      this.wasmRaycasterPtr,
    );
    this.maxWallBottomPtr = this.wasmEngineModule.getMaxWallBottomPtr(
      this.wasmRaycasterPtr,
    );

    // TODO:
    // this.wallHeight = this.cfg.canvas.height;
    this.wallHeight = this.viewport.Height; // TODO:
    this.player.PosZ = this.wallHeight / 2;

    // console.log('raycaster starting...');

    this.backgroundColor = FrameColorRGBAWasm.colorRGBAtoABGR(0x000000ff);
    // this.renderBackground();
    // this.rotate(Math.PI / 4);

    // this.renderBorders(); // TODO:

    this.initMap();
    this.initFloorMap();

    this.initFrameBuf();

    drawBorders(this.BorderColor);
  }

  private initFrameBuf() {
    const { rgbaSurface0: frameBuf8 } = this.wasmRun.WasmViews;

    const frameBuf32 = new Uint32Array(
      frameBuf8.buffer,
      0,
      frameBuf8.byteLength / Uint32Array.BYTES_PER_ELEMENT,
    );

    const frameStride = this.params.wasmRun.FrameStride;

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

  private initViewport() {
    const viewport = getWasmViewportView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );
    const frameWidth = this.wasmRun.FrameWidth;
    const frameHeight = this.wasmRun.FrameHeight;
    const VIEWPORT_BORDER = 0; // TODO: move to config
    viewport.StartX = VIEWPORT_BORDER;
    viewport.StartY = VIEWPORT_BORDER;
    viewport.Width = frameWidth - VIEWPORT_BORDER * 2;
    viewport.Height = frameHeight - VIEWPORT_BORDER * 2;
    this.viewport = viewport;
  }

  private initPlayer() {
    const player = getWasmPlayerView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );
    player.PosX = 0.5;
    player.PosY = 0.5;
    // rotated east
    player.DirX = 1;
    player.DirY = 0;
    player.PlaneX = 0;
    player.PlaneY = 0.66; // FOV 2*atan(0.66) ~ 60 deg
    // rotated north
    // player.DirX = 0;
    // player.DirY = -1;
    // player.PlaneX = 0.66;
    // player.PlaneY = 0; // FOV 2*atan(0.66) ~ 60 deg
    player.Pitch = 0;
    player.PosZ = 0.0;
    this.player = player;
  }

  private initBorderColor() {
    this.borderColorPtr = this.wasmEngineModule.getBorderColorPtr(
      this.wasmRaycasterPtr,
    );
    this.BorderColor = FrameColorRGBAWasm.colorRGBAtoABGR(0xffff00ff);
  }

  private initZBuffer() {
    const zBufferPtr = this.wasmEngineModule.getZBufferPtr(
      this.wasmRaycasterPtr,
    );
    this.zBuffer = new Float32Array(
      this.wasmRun.WasmMem.buffer,
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
    this.initWallTextures();
    this.initFloorTextures();
  }

  private initWallTextures() {
    this.wallTextures = [];

    // const wallTexNames = [ 

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

  private initFloorTextures() {
    this.floorTextures = [];
    this.floorTextures[0] = initTexture(ascImportImages.GREYSTONE);
    this.floorTextures[1] = initTexture(ascImportImages.BLUESTONE);
  }

  public initMap() {
    const mapWidth = 10;
    const mapHeight = 10;

    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    this.wasmEngineModule.allocMap(mapWidth, mapHeight);

    const xGridPtr = this.wasmEngineModule.getXGridPtr(this.wasmRaycasterPtr);
    const yGridPtr = this.wasmEngineModule.getYGridPtr(this.wasmRaycasterPtr);

    // console.log(`xGridPtr=${xGridPtr}, yGridPtr=${yGridPtr}`);

    const gridWidth = mapWidth + 1; // use the same
    const xGridHeight = mapHeight;
    // const yGridWidth = mapWidth;
    const yGridHeight = mapHeight + 1;

    this.xGrid = new Uint8Array(
      this.wasmRun.WasmMem.buffer,
      xGridPtr,
      gridWidth * xGridHeight,
    );

    this.yGrid = new Uint8Array(
      this.wasmRun.WasmMem.buffer,
      yGridPtr,
      gridWidth * yGridHeight,
    );

    for (let i = 0; i < xGridHeight; i++) {
      this.xGrid[i * gridWidth] = 1;
      this.xGrid[i * gridWidth + (gridWidth - 1)] = 1;
    }

    for (let i = 0; i < gridWidth; i++) {
      this.yGrid[i] = 1;
      this.yGrid[i + (yGridHeight - 1) * gridWidth] = 1;
    }

    this.xGrid[4] = 1;
    // // this.yGrid[2] = 0; // test hole // TODO:

    this.xGrid[4 + gridWidth * 2] = 1;
    this.yGrid[4 + gridWidth * 2] = 3;
    this.yGrid[5 + gridWidth * 2] = 3;
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

  drawView() {
    // this.wasmEngine.WasmRun.WasmModules.engine.render();
    // this.wasmEngineModule.render();

    // drawBackground(this.backgroundColor);

    const { mapWidth, mapHeight } = this;
    const { xGrid, yGrid } = this;
    const { Width: vpWidth, Height: vpHeight } = this.viewport;
    const {
      PosX: posX,
      PosY: posY,
      PosZ: posZ,
      DirX: dirX,
      DirY: dirY,
      PlaneX: planeX,
      PlaneY: planeY,
    } = this.player;

    assert(posX >= 0 && posX < mapWidth, 'posX out of map bounds');
    assert(posY >= 0 && posY < mapHeight, 'posY out of map bounds');

    const mapX = posX | 0;
    const mapY = posY | 0;

    const cellX = posX - mapX;
    const cellY = posY - mapY;

    const gridWidth = mapWidth + 1;
    const xGridHeight = mapHeight;
    // const yGridWidth = mapWidth;
    const yGridHeight = mapHeight + 1;

    // const gridHeight = mapHeight + 1;
    // const srcMapIdx = mapY * gridWidth + mapX;

    const projYcenter = this.ProjYCenter;

    let minWallTop = projYcenter;
    let maxWallTop = -1;
    let minWallBottom = vpHeight;
    let maxWallBottom = projYcenter;

    const { wallSlices } = this;

    for (let x = 0; x < vpWidth; x++) {
      const cameraX = (2 * x) / vpWidth - 1;
      // TODO: horz floor casting gives out bounds with rayDirX 
      // const cameraX = (2 * x) / (vpWidth - 1) - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;
      const deltaDistX = 1 / Math.abs(rayDirX);
      const deltaDistY = 1 / Math.abs(rayDirY);

      let sideDistX, sideDistY; // distances to next x/y grid line
      let stepX, stepY; // +1 or -1, step in map
      let stepYoff; // offset for ygrid step
      let xChkIdx, yChkOff, yChkIdx; // check offsets in xgrid/ygrid

      if (rayDirX < 0) {
        stepX = -1;
        xChkIdx = 0;
        sideDistX = cellX * deltaDistX;
      } else {
        stepX = 1;
        xChkIdx = 1;
        sideDistX = (1.0 - cellX) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -1;
        stepYoff = -gridWidth;
        yChkOff = 0;
        yChkIdx = 0;
        sideDistY = cellY * deltaDistY;
      } else {
        stepY = 1;
        stepYoff = gridWidth;
        yChkOff = gridWidth;
        yChkIdx = 1;
        sideDistY = (1.0 - cellY) * deltaDistY;
      }

      // let hit = false;
      let side = 0;

      let gridX = mapX;
      let gridY = mapY;
      let nextGridX, nextGridY;
      // let gridYoff = gridY * gridWidth;
      let gridOff = gridY * gridWidth + gridX;
      let checkGridX, checkGridY;
      let checkGridIdx = -1;

      let MAX_STEPS = 100; // TODO:
      let perpWallDist = 0.0;
      let texId = 0;
      let wallX = 0;
      let flipTexX = false;
      let outOfGrid = false;

      do {
        if (sideDistX < sideDistY) {
          side = 0;
          perpWallDist = sideDistX;
          checkGridIdx = gridOff + xChkIdx;
          if (xGrid[checkGridIdx]) {
            break;
          }
          nextGridX = gridX + stepX;
          if (nextGridX < 0 || nextGridX >= mapWidth) {
            outOfGrid = true;
            break;
          }
          gridX = nextGridX;
          sideDistX += deltaDistX;
          gridOff += stepX;
        } else {
          side = 1;
          perpWallDist = sideDistY;
          checkGridIdx = gridOff + yChkOff;
          if (yGrid[checkGridIdx]) {
            break;
          }
          nextGridY = gridY + stepY;
          if (nextGridY < 0 || nextGridY >= mapHeight) {
            outOfGrid = true;
            break;
          }
          gridY = nextGridY;
          sideDistY += deltaDistY;
          gridOff += stepYoff;
        }
      } while (--MAX_STEPS);

      this.zBuffer[x] = perpWallDist;

      const wallSliceHeight = (this.wallHeight / perpWallDist) | 0;

      const projWallBottom = projYcenter + (wallSliceHeight >> 1);
      const projWallTop = projWallBottom - wallSliceHeight + 1;

      // const projWallTop = midY - (wallSliceHeight >> 1);
      // const projWallBottom = projWallTop + wallSliceHeight - 1;
      // const sliceHeight = projWallBottom - projWallTop + 1;

      let wallTop = projWallTop;
      if (projWallTop < 0) {
        wallTop = 0;
      }

      let wallBottom = projWallBottom;
      if (projWallBottom >= vpHeight) {
        wallBottom = vpHeight - 1;
      }

      // assert(wallTop <= wallBottom, `invalid top ${wallTop} and bottom`); // <= ?

      const wallSlice = wallSlices[x];
      wallSlice.Distance = perpWallDist;
      wallSlice.Top = wallTop;
      wallSlice.Bottom = wallBottom;
      wallSlice.Side = side;

      if (wallTop < minWallTop) {
        minWallTop = wallTop;
      } else if (wallTop > maxWallTop) {
        maxWallTop = wallTop;
      }

      if (wallBottom > maxWallBottom) {
        maxWallBottom = wallBottom;
      } else if (wallBottom < minWallBottom) {
        minWallBottom = wallBottom;
      }

      let wallGrid;

      // used only for vert floor/ceil rend
      let floorWallX;
      let floorWallY;

      if (side === 0) {
        wallGrid = xGrid;
        wallX = posY + perpWallDist * rayDirY;
        wallX -= wallX | 0;
        flipTexX = rayDirX > 0;
        floorWallY = gridY + wallX;
        floorWallX = gridX + xChkIdx;
      } else {
        wallGrid = yGrid;
        wallX = posX + perpWallDist * rayDirX;
        wallX -= wallX | 0;
        flipTexX = rayDirY < 0;
        floorWallX = gridX + wallX;
        floorWallY = gridY + yChkIdx;
      }

      wallSlice.FloorWallX = floorWallX;
      wallSlice.FloorWallY = floorWallY;

      if (outOfGrid || MAX_STEPS <= 0) {
        wallSlice.Hit = 0;
        // console.log('MAX_STEPS exceeded');
        // console.log('no hit');
        // break; // TODO:
        // continue loopCol;
        continue;
      }

      wallSlice.Hit = 1;

      texId = wallGrid[checkGridIdx] - 1;

      // assert(
      //   texId >= 0 && texId < this.wallTextures.length,
      //   `invalid texture id ${texId}`,
      // );

      texId = 2;
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
      const texY = (wallTop - projWallTop) * texStepY;

      wallSlice.TexId = texId;
      wallSlice.MipLvl = mipLevel;
      wallSlice.TexX = texX;
      wallSlice.TexStepY = texStepY;
      wallSlice.TexY = texY;
      wallSlice.CachedMipmap = mipmap;
    } // end col loop

    this.MinWallTop = minWallTop;
    this.MaxWallTop = maxWallTop;
    this.MinWallBottom = minWallBottom;
    this.MaxWallBottom = maxWallBottom;

    const drawViewParams: DrawViewParams = {
      posX,
      posY,
      posZ,
      dirX,
      dirY,
      planeX,
      planeY,
      wallSlices,
      mapWidth,
      mapHeight,
      projYcenter,
      minWallTop,
      maxWallTop,
      minWallBottom,
      maxWallBottom,
    };
    // drawViewVert(drawViewParams);
    // drawViewVertHorz(drawViewParams);
    // drawViewHorz(drawViewParams);

    this.wasmEngineModule.render();
  }

  private get ProjYCenter(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.projYCenterPtr, true);
  }

  private set ProjYCenter(val: number) {
    this.wasmRun.WasmViews.view.setUint32(this.projYCenterPtr, val, true);
  }

  private get MinWallTop(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.minWallTopPtr, true);
  }

  private set MinWallTop(val: number) {
    this.wasmRun.WasmViews.view.setUint32(this.minWallTopPtr, val, true);
  }

  private get MaxWallTop(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.maxWallTopPtr, true);
  }

  private set MaxWallTop(val: number) {
    this.wasmRun.WasmViews.view.setUint32(this.maxWallTopPtr, val, true);
  }

  private get MinWallBottom(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.minWallBottomPtr, true);
  }

  private set MinWallBottom(val: number) {
    this.wasmRun.WasmViews.view.setUint32(this.minWallBottomPtr, val, true);
  }

  private get MaxWallBottom(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.maxWallBottomPtr, true);
  }

  private set MaxWallBottom(val: number) {
    this.wasmRun.WasmViews.view.setUint32(this.maxWallBottomPtr, val, true);
  }

  private get BorderColor(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.borderColorPtr, true);
  }

  private set BorderColor(value: number) {
    this.wasmRun.WasmViews.view.setUint32(this.borderColorPtr, value, true);
  }

  get Viewport() {
    return this.viewport;
  }

  get Player() {
    return this.player;
  }
}

export { Raycaster, RaycasterParams };
