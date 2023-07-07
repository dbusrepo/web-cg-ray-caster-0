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
import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';
import { Viewport, getWasmViewportView } from './viewport';
import { Player, getWasmPlayerView } from './player';

import { images } from '../../../assets/build/images';
import { loadImage } from './imageUtils'; // TODO: rename

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

  private textures: BitImageRGBA[];

  private frameBuf32: Uint32Array;
  private frameStride: number;

  private mapWidth: number;
  private mapHeight: number;

  private xGrid: Uint8Array;
  private yGrid: Uint8Array;

  private zBuffer: Float32Array;

  private wallHeight: number;

  private backgroundColor: number;

  public async init(params: RaycasterParams) {
    this.params = params;
    const { wasmRun } = params;

    this.wasmEngineModule = wasmRun.WasmModules.engine;
    this.wasmRaycasterPtr = this.wasmEngineModule.getRaycasterPtr();

    this.player = getWasmPlayerView(this.wasmEngineModule, this.wasmRaycasterPtr);
    this.viewport = getWasmViewportView(this.wasmEngineModule, this.wasmRaycasterPtr);

    this.initFrameBuf();

    this.initZBufferView();

    // this.wallHeight = this.cfg.canvas.height;
    this.wallHeight = this.viewport.Height; // TODO:

    // console.log('raycaster starting...');

    this.initTextures();

    this.backgroundColor = makeColor(0x000000ff);
    // this.renderBackground();
    // this.rotate(Math.PI / 4);

    // this.renderBorders(); // TODO:


    // this.castScene(); // TODO:
  }

  private initFrameBuf() {
    const { wasmRun } = this.params;
    const frameBuf8 = wasmRun.WasmViews.rgbaSurface0;
    this.frameBuf32 = new Uint32Array(frameBuf8.buffer,
      0, frameBuf8.byteLength / Uint32Array.BYTES_PER_ELEMENT);
    this.frameStride = this.params.frameStride;
  }

  private initZBufferView() {
    const zBufferPtr = this.wasmEngineModule.getZBufferPtr(this.wasmRaycasterPtr);
    this.zBuffer = new Float32Array(
      this.params.wasmRun.WasmMem.buffer,
      zBufferPtr,
      this.viewport.Width);
  }

  private initTextures() {
    this.textures = [];
    this.textures[0] = loadImage(images.GREYSTONE); // TODO: rename
    this.textures[1] = loadImage(images.BLUESTONE);
    this.textures[2] = loadImage(images.REDBRICK);
  }

  private renderBackground() {
    const { frameStride: stride, frameBuf32 } = this;
    const { StartX, StartY, Width, Height } = this.viewport;
    for (let i = StartY, offset = StartY * stride; i < StartY + Height; i++, offset += stride) {
      frameBuf32.fill(this.backgroundColor, offset + StartX, offset + StartX + Width);
    }
  }

  castScene() {

    // this.wasmEngine.WasmRun.WasmModules.engine.render();
    // this.wasmEngineModule.render();

    this.renderBackground();

    const { frameStride: stride, frameBuf32 } = this;

    const { StartX: startX, StartY: startY, Width: width, Height: height } = this.viewport;
    const { xGrid, yGrid } = this;
    const { PosX: posX, PosY: posY, DirX: dirX, DirY: dirY, PlaneX: planeX, PlaneY: planeY } = this.player;

    // TODO:
    // const mid = (startY + height / 2) | 0;
    // this.frameBuffer.buf32.fill(0xff00ffff, mid * this.frameBuffer.pitch + startX, mid * this.frameBuffer.pitch + startX + width);
    // this.frameBuffer.buf32.fill(0xff00ffff, startY * this.frameBuffer.pitch + startX, startY * this.frameBuffer.pitch + startX + width);
    // this.frameBuffer.buf32.fill(0xff00ffff, (startY + height - 1) * this.frameBuffer.pitch + startX, (startY + height - 1) * this.frameBuffer.pitch + startX + width);

    // console.log(`px ${pX.toFixed(2)} py ${pY.toFixed(2)}`); // dirX ${dirX} dirY ${dirY}`);// planeX ${planeX} planeY ${planeY} pitch ${pitch} posZ ${posZ}`)

    // const cameraX = 2 * (width - 1) / width - 1;
    // (2 * width - 2) / width - 1;
    // 2 - 2 / width - 1 = 1 - 2 / width
    // 2 * x / (width - 1) - 1, 
    // => x = width - 1, 2 * (width - 1) / (width - 1) - 1 = 1, x = 0, 2 * 0 / (width - 1) - 1 = -1
    // console.log(cameraX);

    const scrStartPtr = startY * stride + startX;

    const gridWidth = this.mapWidth + 1;

    // for (let x = 0; x < width; x++) {
    for (let x = 0; x < width; x++) {

      // const cameraX = 2 * x / width - 1;
      const cameraX = 2 * x / (width - 1) - 1; // TODO:
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
        }
        else {
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

      const midY = (height / 2) | 0;

      let wallTop = ((-wallSliceHeight / 2) | 0) + midY;
      if (wallTop < 0) {
        wallTop = 0;
      }

      let wallBottom = wallTop + wallSliceHeight;
      if (wallBottom > height) {
        wallBottom = height;
      }

      assert(texId >= 0 && texId < this.textures.length, `invalid texture id ${texId}`);
      const texture = this.textures[texId];

      const { Width : texWidth, Height: texHeight } = texture;

      // wallX -= Math.floor(wallX); // wallX %= 1;
      wallX -= wallX | 0;

      let texX = (wallX * texWidth) | 0;

      if (side === 0 && rayDirX > 0) {
        texX = texWidth - texX - 1;
      }
      if (side === 1 && rayDirY < 0) {
        texX = texWidth - texX - 1;
      }

      const step = 1. * texHeight / wallSliceHeight;

      let texPos = (wallTop - midY + wallSliceHeight / 2) * step;

      const colPtr = scrStartPtr + x;
      let scrPtr = colPtr + wallTop * stride; 

      for (let y = wallTop; y < wallBottom; y++) {
        const texY = texPos | 0;
        texPos += step;
        const color = texture.Buf32[texY * texWidth + texX];
        frameBuf32[scrPtr] = color;
        scrPtr += stride;
      }

      // // solid color
      // for (let y = wallTop; y < wallBottom; y++) {
      //   frameBuf32[scrPtr] = 0xff0000ff;
      //   scrPtr += stride;
      // }

      // texture wall
      // const step = texHeight / lineHeight;
    }
  }

  public initMap() {
    const { wasmRun } = this.params;

    // TODO:
    const mapWidth = 10;
    const mapHeight = 10;

    this.mapWidth = mapWidth;
    this.mapHeight = mapHeight;

    this.wasmEngineModule.allocMap(mapWidth, mapHeight);

    const xGridPtr = this.wasmEngineModule.getRaycasterXGridPtr();
    const yGridPtr = this.wasmEngineModule.getRaycasterYGridPtr();

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
    this.xGrid[4 + (mapWidth + 1) * 2] = 3;
    this.yGrid[4 + (mapWidth + 1) * 1] = 3;
  }

  get FrameBuf32() {
    return this.frameBuf32;
  }

  get FrameStride() {
    return this.frameStride;
  }

  get Viewport() {
    return this.viewport;
  }

  get Player() {
    return this.player;
  }
}

export { Raycaster, RaycasterParams };
