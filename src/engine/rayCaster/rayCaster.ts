import assert from 'assert';
import { mainConfig } from '../../config/mainConfig';
import type { InputEvent } from '../../app/events';
import type { AuxWorkerParams } from './auxWorker';
import { AuxWorkerCommandEnum, AuxWorkerDesc } from './auxWorker';
import { AssetManager } from '../assets/assetManager';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { InputManager, keys, keyOffsets } from '../../input/inputManager';
import { randColor, makeColor, sleep } from '../utils';

import type { WasmEngineParams } from '../wasmEngine/wasmEngine';
import { WasmEngine } from '../wasmEngine/wasmEngine';
import type { WasmViews } from '../wasmEngine/wasmViews';
import type { WasmModules } from '../wasmEngine/wasmLoader';
import { WasmRun } from '../wasmEngine/wasmRun';
import { gWasmRun, gWasmView } from '../wasmEngine/wasmRun';

import { images } from '../../../assets/build/images';
import { loadImage } from './imageUtils'; // TODO: rename

import type { Viewport } from './viewport';
import { getWasmViewport } from './viewport';

import type { Player } from './player';
import { getWasmPlayer } from './player';

type RaycasterParams = {
  engineCanvas: OffscreenCanvas;
};

type Map = {
  width: number;
  height: number;
  data: Uint8Array;
};

class Raycaster {
  private params: RaycasterParams;
  private assetManager: AssetManager;
  private inputManager: InputManager;

  private auxWorkers: AuxWorkerDesc[];
  private syncArray: Int32Array;
  private sleepArray: Int32Array;

  private ctx2d: OffscreenCanvasRenderingContext2D;
  private imageData: ImageData;

  private wasmEngine: WasmEngine;
  private wasmRun: WasmRun;

  private textures: BitImageRGBA[];

  private wasmRaycasterPtr: number;

  private player: Player;
  private viewport: Viewport;

  private borderColorPtr: number;

  private frameBuf32: Uint32Array;
  private frameStride: number;

  private wallHeight: number;
  private zBuffer: Float32Array;
  private backgroundColor: number;
  private map: Map;

  public async init(params: RaycasterParams) {
    this.params = params;
    this.initGfx();
    this.initInputManager();
    await this.initAssetManager();
    await this.initWasmEngine();

    this.initFrameBuf32();
    this.initTextures();

    const { engine: wasmEngine } = this.wasmRun.WasmModules;

    this.wasmRaycasterPtr = wasmEngine.getRaycasterPtr();

    this.viewport = getWasmViewport();
    const VIEWPORT_BORDER = 10;
    this.viewport.StartX = VIEWPORT_BORDER;
    this.viewport.StartY = VIEWPORT_BORDER;
    this.viewport.Width = this.params.engineCanvas.width - VIEWPORT_BORDER * 2;
    this.viewport.Height = this.params.engineCanvas.height - VIEWPORT_BORDER * 2;

    this.borderColorPtr = wasmEngine.getRaycasterBorderColorOffset(this.wasmRaycasterPtr);
    this.BorderColor = makeColor(0xffff00ff);

    this.player = getWasmPlayer();
    this.player.PosX = 1.0;
    this.player.PosY = 1.5;
    this.player.DirX = 1;
    this.player.DirY = 0;
    this.player.PlaneX = 0;
    this.player.PlaneY = 0.66;
    this.player.Pitch = 0;
    this.player.PosZ = 0.0;


    this.renderBorders();

    // this.wallHeight = this.cfg.canvas.height;
    this.wallHeight = this.viewport.Height;

    this.backgroundColor = makeColor(0x000000ff);

    // this.postInitRaycaster(); // TODO:

    // this.renderBackground();
    // this.rotate(Math.PI / 4);

    this.initMap();

    await this.runAuxWorkers();
    // console.log('raycaster starting...');

    // console.log('main worker viewport.startX', this.viewport.StartX);
    // console.log('main worker viewport.startY', this.viewport.StartY);
    // console.log('main worker player.posX', this.player.PosX);
    // console.log('main worker player.posY', this.player.PosY);

    // console.log(JSON.stringify(this.map.data));
    this.castScene(); // TODO:
  }

  private postInitRaycaster() {
    const { engine: wasmEngine } = this.wasmRun.WasmModules;
    wasmEngine.postInitRaycaster();
    this.initWasmZBufferView();
  }

  private initFrameBuf32() {
    const frameBuf8 = this.wasmRun.WasmViews.rgbaSurface0;
    this.frameBuf32 = new Uint32Array(frameBuf8.buffer,
      0, frameBuf8.byteLength / Uint32Array.BYTES_PER_ELEMENT);
    this.frameStride = this.imageData.width;
  }

  private initWasmZBufferView() {
    const { engine: wasmEngine } = this.wasmRun.WasmModules;
    const zBufferPtr = wasmEngine.getRaycasterZBufferPtr(this.wasmRaycasterPtr);
    this.zBuffer = new Float32Array(
      this.wasmRun.WasmMem.buffer,
      zBufferPtr,
      this.viewport.Width);
  }

  private initGfx() {
    this.ctx2d = this.get2dCtxFromCanvas(this.params.engineCanvas);
    const { width, height } = this.params.engineCanvas;
    this.imageData = this.ctx2d.createImageData(width, height);
  }

  private get2dCtxFromCanvas(canvas: OffscreenCanvas) {
    const ctx = <OffscreenCanvasRenderingContext2D>(
      canvas.getContext('2d', {
        alpha: false,
        desynchronized: true, // TODO:
      })
    );
    ctx.imageSmoothingEnabled = false; // no blur, keep the pixels sharpness
    return ctx;
  }

  private initInputManager() {
    this.inputManager = new InputManager();
    // no key handlers added here, we use the wasm engine key handlers
    // and we check for key status with wasm view
    // this.initKeyHandlers();
  }

  private async initAssetManager() {
    this.assetManager = new AssetManager();
    await this.assetManager.init();
  }

  // private initKeyHandlers() {
  //   this.inputManager.addKeyHandlers(keys.KEY_A, () => {}, () => {});
  //   this.inputManager.addKeyHandlers(keys.KEY_S, () => {}, () => {});
  //   this.inputManager.addKeyHandlers(keys.KEY_D, () => {}, () => {});
  // }

  private async initWasmEngine() {
    this.wasmEngine = new WasmEngine();
    const wasmEngineParams: WasmEngineParams = {
      imageWidth: this.imageData.width,
      imageHeight: this.imageData.height,
      assetManager: this.assetManager,
      inputManager: this.inputManager,
      numAuxWasmWorkers: mainConfig.numAuxWasmWorkers,
    };
    await this.wasmEngine.init(wasmEngineParams);
    this.wasmRun = this.wasmEngine.WasmRun;
  }

  private async runAuxWorkers() {
    const numWorkers = mainConfig.numAuxAppWorkers;
    console.log(`num aux workers: ${numWorkers}`);
    const numTotalWorkers = numWorkers + 1;
    this.sleepArray = new Int32Array(new SharedArrayBuffer(numTotalWorkers * Int32Array.BYTES_PER_ELEMENT));
    Atomics.store(this.sleepArray, 0, 0); // main worker idx 0
    this.auxWorkers = [];
    if (numWorkers) {
      this.syncArray = new Int32Array(new SharedArrayBuffer(numTotalWorkers * Int32Array.BYTES_PER_ELEMENT));
      Atomics.store(this.syncArray, 0, 0);
      await this.initAuxWorkers(numWorkers);
      for (let i = 0; i < this.auxWorkers.length; ++i) {
        const { index: workerIdx } = this.auxWorkers[i];
        Atomics.store(this.sleepArray, workerIdx, 0);
        Atomics.store(this.syncArray, workerIdx, 0);
      }
      this.auxWorkers.forEach(({ worker }) => {
        worker.postMessage({
          command: AuxWorkerCommandEnum.RUN,
        });
      });
    }
  }

  private async initAuxWorkers(numAuxWorkers: number) {
    assert(numAuxWorkers > 0);
    assert(this.wasmEngine);
    assert(this.wasmRaycasterPtr);
    const initStart = Date.now();
    try {
      let nextWorkerIdx = 1; // start from 1, 0 is for the main worker
      const genWorkerIdx = () => {
        return nextWorkerIdx++;
      };
      let remWorkers = numAuxWorkers;
      await new Promise<void>((resolve, reject) => {
        for (let i = 0; i < numAuxWorkers; ++i) {
          const workerIndex = genWorkerIdx();
          const engineWorker = {
            index: workerIndex,
            worker: new Worker(
              // new URL('../../app/appWorker.ts', import.meta.url),
              new URL('./auxWorker.ts', import.meta.url),
              {
                name: `aux-app-worker-${workerIndex}`,
                type: 'module',
              },
            )
          };
          this.auxWorkers.push(engineWorker);
          const workerParams: AuxWorkerParams = {
            workerIndex,
            numWorkers: numAuxWorkers,
            syncArray: this.syncArray,
            sleepArray: this.sleepArray,
            wasmRunParams: {
              ...this.wasmEngine.WasmRunParams,
              workerIdx: workerIndex,
              raycasterPtr: this.wasmRaycasterPtr,
            },
          };
          engineWorker.worker.postMessage({
            command: AuxWorkerCommandEnum.INIT,
            params: workerParams,
          });
          engineWorker.worker.onmessage = ({ data }) => {
            --remWorkers;
            console.log(
              `Aux app worker id=${workerIndex} init, left count=${remWorkers}, time=${
Date.now() - initStart
}ms with data = ${JSON.stringify(data)}`,
            );
            if (remWorkers === 0) {
              console.log(
                `Aux app workers init done. After ${Date.now() - initStart}ms`,
              );
              resolve();
            }
          };
          engineWorker.worker.onerror = (error) => {
            console.log(`Aux app worker id=${workerIndex} error: ${error.message}\n`);
            reject(error);
          };
        }
      });
    } catch (error) {
      console.error(`Error during aux app workers init: ${JSON.stringify(error)}`);
    }
  }

  private syncWorkers() {
    for (let i = 0; i < this.auxWorkers.length; ++i) {
      const { index: workerIdx } = this.auxWorkers[i];
      Atomics.store(this.syncArray, workerIdx, 1);
      Atomics.notify(this.syncArray, workerIdx);
    }
  }

  private waitWorkers() {
    for (let i = 0; i < this.auxWorkers.length; ++i) {
      const { index: workerIdx } = this.auxWorkers[i];
      Atomics.wait(this.syncArray, workerIdx, 1);
    }
  }

  private initTextures() {
    this.textures = [];
    this.textures[0] = loadImage(images.GREYSTONE);
    this.textures[1] = loadImage(images.BLUESTONE);
    this.textures[2] = loadImage(images.REDBRICK);
  }

  private initMap() {
    const mapWidth = 16;
    const mapHeight = 16;
    const mapPtr = this.wasmEngine.WasmRun.WasmModules.engine.allocMap(mapWidth, mapHeight);
    this.map = {
      width: mapWidth,
      height: mapHeight,
      data: new Uint8Array(
        this.wasmRun.WasmMem.buffer,
        mapPtr,
        mapWidth * mapHeight,
      )
    };
    const mapBuf = this.map.data;
    for (let i = 0; i < mapHeight; i++) {
      mapBuf[i * mapWidth] = 1;
      mapBuf[i * mapWidth + mapWidth - 1] = 1;
      if (i === 0 || i === mapHeight - 1) {
        const rowOffset = i * mapWidth;
        for (let j = 0; j < mapWidth; j++) {
          mapBuf[rowOffset + j] = 1;
        }
      }
      // let mapStr = '';
      // for (let j = 0; j < width; j++) {
      //   mapStr += this.map[i * width + j] + ' ';
      // }
      // console.log(mapStr);
    } 
    mapBuf[2] = 2;
    mapBuf[3] = 3;
    mapBuf[mapWidth*2 + 2] = 3;
    // console.log(JSON.stringify(mapBuf));
    console.log('addr range map:');
    console.log(mapPtr, mapPtr + mapWidth * mapHeight);
  }

  public render() {
    this.syncWorkers();
    try {
      // this.wasmEngine.render();
      // this.castScene();
    }
    catch (e) {
      console.error(e);
    }
    this.waitWorkers();
    this.drawWasmFrame();
  }

  private drawWasmFrame() {
    this.imageData.data.set(this.wasmEngine.WasmRun.WasmViews.rgbaSurface0);
    this.ctx2d.putImageData(this.imageData, 0, 0);
  }

  private renderBorders() {
    const { frameStride: stride, frameBuf32 } = this;
    const { StartX, StartY, Width, Height } = this.viewport;
    const upperLimit = StartY * stride;
    const lowerLimit = (StartY + Height) * stride;

    frameBuf32.fill(this.BorderColor, 0, upperLimit);
    frameBuf32.fill(this.BorderColor, lowerLimit, frameBuf32.length);

    for (let i = StartY, offset = StartY * stride; i < StartY + Height; i++, offset += stride) {
      frameBuf32.fill(this.BorderColor, offset, offset + StartX);
      frameBuf32.fill(this.BorderColor, offset + StartX + Width, offset + stride);
    }
  }

  // TODO:
  private renderBackground() {
    const { frameStride: stride, frameBuf32 } = this;
    const { StartX, StartY, Width, Height } = this.viewport;
    for (let i = StartY, offset = StartY * stride; i < StartY + Height; i++, offset += stride) {
      frameBuf32.fill(this.backgroundColor, offset + StartX, offset + StartX + Width);
    }
  }

  private castScene() {
    // this.engine.WasmModules.engine.render();

    this.renderBackground();

    const { frameStride: stride, frameBuf32 } = this;

    const { StartX: startX, StartY: startY, Width: width, Height: height } = this.viewport;
    const { PosX: pX, PosY: pY, DirX: dirX, DirY: dirY, PlaneX: planeX, PlaneY: planeY } = this.player;

    const { map } = this;

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

    for (let x = 0; x < width; x++) {
      // const cameraX = 2 * x / width - 1;
      const cameraX = 2 * x / (width - 1) - 1; // TODO:
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;
      const deltaDistX = Math.abs(1 / rayDirX);
      const deltaDistY = Math.abs(1 / rayDirY);

      const mapX = pX | 0;
      const mapY = pY | 0;

      let stepX, stepY;
      let sideDistX, sideDistY;

      if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (pX - mapX) * deltaDistX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - pX) * deltaDistX;
      }

      if (rayDirY < 0) {
        stepY = -this.map.width;
        sideDistY = (pY - mapY) * deltaDistY;
      } else {
        stepY = this.map.width;
        sideDistY = (mapY + 1.0 - pY) * deltaDistY;
      }

      // let stepX = -1;
      // let sideDistX = (pX - mapX) * deltaDistX;
      // if (rayDirX > 0) {
      //   stepX = 1;
      //   sideDistX = -sideDistX + deltaDistX;
      // }
      //
      // let stepY = -width;
      // let sideDistY = (pY - mapY) * deltaDistY;
      // if (rayDirY > 0) {
      //   stepY = width;
      //   sideDistY = -sideDistY + deltaDistY;
      // }


      let hit = false;
      let side;
      let mapIdx = mapY * this.map.width + mapX;
      do {
        if (sideDistX < sideDistY) {
          sideDistX += deltaDistX;
          mapIdx += stepX;
          side = 0;
        }
        else {
          sideDistY += deltaDistY;
          mapIdx += stepY;
          side = 1;
        }
        // TODO: check if mapIdx is out of bounds
        hit = map.data[mapIdx] > 0;
        // if (map[mapIdx] > 0) {
        //   hit = true;
        // }
      } while (!hit);

      let perpWallDist: number;

      // calc perp wall dist
      if (side === 0) {
        perpWallDist = sideDistX - deltaDistX;
      } else {
        perpWallDist = sideDistY - deltaDistY;
      }

      this.zBuffer[x] = perpWallDist;
      if (x === 27) {
        console.log(this.zBuffer[x]);
      }

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

      const texId = map.data[mapIdx] - 1;
      assert(texId >= 0 && texId < this.textures.length, `invalid texture id ${texId}`);
      const texture = this.textures[texId];

      const wallX = (side === 0 ? pY + perpWallDist * rayDirY : pX + perpWallDist * rayDirX) % 1;

      const texWidth = texture.Width

      let texX = (wallX * texWidth) | 0;
      if (side === 0 && rayDirX > 0) {
        texX = texWidth - texX - 1;
      }
      if (side === 1 && rayDirY < 0) {
        texX = texWidth - texX - 1;
      }

      const step = 1. * texture.Height / wallSliceHeight;

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
      //   this.frameBuffer.buf32[scrPtr] = 0xff0000ff;
      //   scrPtr += frameBufPitch;
      // }

      // texture wall
      // const step = texHeight / lineHeight;
    }
  }

  update(time: number) {
    const { inputKeys } = this.wasmEngine.WasmViews;
    const moveSpeed = time * 0.005;

    if (inputKeys[keyOffsets[keys.KEY_W]] !== 0) {
      this.moveForward(moveSpeed, 1);
    }
    if (inputKeys[keyOffsets[keys.KEY_S]] !== 0) {
      this.moveForward(moveSpeed, -1);
    }
    if (inputKeys[keyOffsets[keys.KEY_A]] !== 0) {
      this.rotate(-moveSpeed);
    }
    if (inputKeys[keyOffsets[keys.KEY_D]] !== 0) {
      this.rotate(moveSpeed);
    }
  }

  private rotate(moveSpeed: number) {
    const { player } = this;
    const oldDirX = player.DirX;
    player.DirX = player.DirX * Math.cos(moveSpeed) - player.DirY * Math.sin(moveSpeed);
    player.DirY = oldDirX * Math.sin(moveSpeed) + player.DirY * Math.cos(moveSpeed);
    const oldPlaneX = player.PlaneX;
    player.PlaneX = player.PlaneX * Math.cos(moveSpeed) - player.PlaneY * Math.sin(moveSpeed);
    player.PlaneY = oldPlaneX * Math.sin(moveSpeed) + player.PlaneY * Math.cos(moveSpeed);
  }

  private moveForward(moveSpeed: number, dir: number) {
    const { player } = this;
    player.PosX += dir * player.DirX * moveSpeed;
    player.PosY += dir * player.DirY * moveSpeed;
  }

  onKeyDown(inputEvent: InputEvent) {
    this.inputManager.onKeyDown(inputEvent.code);
  }

  onKeyUp(inputEvent: InputEvent) {
    this.inputManager.onKeyUp(inputEvent.code);
  }

  // onMouseMove(inputEvent: InputEvent) {
  // }

  private get BorderColor(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.borderColorPtr, true);
  }

  private set BorderColor(value: number) {
    this.wasmRun.WasmViews.view.setUint32(this.borderColorPtr, value, true);
  }

}

export { Raycaster, RaycasterParams };
