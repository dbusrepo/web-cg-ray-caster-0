import assert from 'assert';
import type { WasmEngineParams } from '../wasmEngine/wasmEngine';
import { WasmEngine } from '../wasmEngine/wasmEngine';
import type { InputEvent } from '../../app/events';
import type { WasmViews } from '../wasmEngine/wasmViews';
import type { WasmModules } from '../wasmEngine/wasmLoader';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
import { loadTexture } from './textureUtils';
import { images } from '../../assets/build/images';
import { AssetManager } from '../assets/assetManager';
import { InputManager, keys } from '../../input/inputManager';
import { EngineWorkerCommandEnum } from '../engineWorker';
import { EngineWorkerDesc } from '../engineWorker';

type RayCasterParams = {
  engineCanvas: OffscreenCanvas;
  assetManager: AssetManager;
  inputManager: InputManager;
  engineWorkers: EngineWorkerDesc[];
  mainWorkerIdx: number;
};

type Viewport = {
  startX: number;
  startY: number;
  width: number;
  height: number;
  borderColor: number;
}

type FrameBuffer = {
  buf8: Uint8ClampedArray;
  buf32: Uint32Array;
  pitch: number;
}

type Map = {
  width: number;
  height: number;
  data: Uint8Array;
};

type KeyOffset = {
  KeyW: number,
  KeyS: number,
  KeyA: number,
  KeyD: number,
};

class RayCaster {
  private params: RayCasterParams;
  private wasmEngine: WasmEngine;
  private wasmViews: WasmViews;
  private wasmMem: WebAssembly.Memory;
  private wasmModules: WasmModules;

  private inputManager: InputManager;
  private key2Offset: KeyOffset;

  private pX: number;
  private pY: number;
  private dirX: number;
  private dirY: number;
  private planeX: number;
  private planeY: number;
  // private pitch: number;
  // private posZ: number;
  private wallHeight: number;
  private viewport: Viewport;
  private zBuffer: Float32Array;
  private frameBuffer: FrameBuffer;
  private backgroundColor: number;
  private map: Map;
  private textures: BitImageRGBA[];

  public async init(params: RayCasterParams) {
    this.params = params;
    this.initInputManager();
    await this.initWasmEngine(); // TODO:
    // ray caster init stuff
    this.initMap();
    this.initTextures();
    this.pX = 1.0;
    this.pY = 1.5;
    this.dirX = 1;
    this.dirY = 0;
    this.planeX = 0;
    this.planeY = 0.66;
    // this.pitch = 0; // TODO: rename this plz
    // this.posZ = 0.0;
    const VIEWPORT_BORDER = 0;
    this.viewport = {
      startX: VIEWPORT_BORDER,
      startY: VIEWPORT_BORDER,
      width: this.params.engineCanvas.width - VIEWPORT_BORDER * 2,
      height: this.params.engineCanvas.height - VIEWPORT_BORDER * 2,
      borderColor: 0xff444444, // TODO:
    };
    // this.wallHeight = this.cfg.canvas.height;
    this.wallHeight = this.viewport.height;
    this.zBuffer = new Float32Array(this.viewport.width);
    const frameBuf = this.wasmViews.rgbaSurface0;
    this.frameBuffer = {
      buf8: frameBuf,
      buf32: new Uint32Array(
        frameBuf.buffer,
        0,
        frameBuf.byteLength / Uint32Array.BYTES_PER_ELEMENT),
      pitch: this.params.engineCanvas.width,
    };
    this.renderBorders();
    this.backgroundColor = 0xff000000; // TODO:
    // this.renderBackground();
    // this.rotate(Math.PI / 4);
    // this.castScene(); // TODO:
  }

  private async initWasmEngine() {
    this.wasmEngine = new WasmEngine();
    const wasmEngineParams: WasmEngineParams = {
      engineCanvas: this.params.engineCanvas,
      assetManager: this.params.assetManager,
      engineWorkers: this.params.engineWorkers,
      mainWorkerIdx: this.params.mainWorkerIdx,
      inputManager: this.inputManager,
      runLoopInWorker: false, // WARN:
    };
    await this.wasmEngine.init(wasmEngineParams);
    this.wasmViews = this.wasmEngine.WasmRun.WasmViews
    this.wasmMem = this.wasmEngine.WasmMem;
    this.wasmModules = this.wasmEngine.WasmRun.WasmModules;
  }

  initTextures() {
    const NUM_TEXTURES = 1;
    this.textures = new Array(NUM_TEXTURES);
    this.textures[0] = loadTexture(this.wasmViews, images.GREYSTONE);
    this.textures[1] = loadTexture(this.wasmViews, images.BLUESTONE);
    this.textures[2] = loadTexture(this.wasmViews, images.REDBRICK);
  }

  initMap() {
    const mapWidth = 16;
    const mapHeight = 16;
    const mapPtr = this.wasmEngine.WasmRun.WasmModules.engine.allocMap(mapWidth, mapHeight);
    this.map = {
      width: mapWidth,
      height: mapHeight,
      data: new Uint8Array(
        this.wasmMem.buffer,
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
  }

  public render() {
    this.wasmEngine.syncWorkers();
    try {
      this.castScene();
    }
    catch (e) {
      console.error(e);
    }
    this.wasmEngine.waitWorkers();
    this.wasmEngine.drawFrame();
  }

  private renderBorders() {
    const { buf32, pitch } = this.frameBuffer;
    const { startX, startY, width, height, borderColor } = this.viewport;
    const upperLimit = startY * pitch;
    const lowerLimit = (startY + height) * pitch;
    buf32.fill(borderColor, 0, upperLimit);
    buf32.fill(borderColor, lowerLimit, buf32.length);
    for (let i = startY, offset = startY * pitch; i < startY + height; i++, offset += pitch) {
      buf32.fill(borderColor, offset, offset + startX);
      buf32.fill(borderColor, offset + startX + width, offset + pitch);
    }
 }

  private renderBackground() {
    const { buf32, pitch } = this.frameBuffer;
    const { startX, startY, width, height } = this.viewport;
    for (let i = startY, offset = startY * pitch; i < startY + height; i++, offset += pitch) {
      buf32.fill(this.backgroundColor, offset + startX, offset + startX + width);
    }
  }

  private castScene() {
    // this.engine.WasmModules.engine.render();

    this.renderBackground();

    const { startX, startY, width, height } = this.viewport;
    const { map, pX, pY, dirX, dirY, planeX, planeY } = this;

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

    const frameBufPitch = this.frameBuffer.pitch;
    const scrStartPtr = startY * frameBufPitch + startX;

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

      let perpWallDist;

      // calc perp wall dist
      if (side === 0) {
        perpWallDist = sideDistX - deltaDistX;
      } else {
        perpWallDist = sideDistY - deltaDistY;
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
      let scrPtr = colPtr + wallTop * frameBufPitch; 

      for (let y = wallTop; y < wallBottom; y++) {
        const texY = texPos | 0;
        texPos += step;
        const color = texture.Buf32[texY * texWidth + texX];
        this.frameBuffer.buf32[scrPtr] = color;
        scrPtr += frameBufPitch;
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

  public update(time: number) {

    const inputKeys = this.wasmEngine.WasmViews.inputKeys;

    const moveSpeed = time * 0.005;

    if (inputKeys[this.key2Offset.KeyW] !== 0) {
      this.moveForward(moveSpeed, 1);
    }
    if (inputKeys[this.key2Offset.KeyS] !== 0) {
      this.moveForward(moveSpeed, -1);
    }
    if (inputKeys[this.key2Offset.KeyA] !== 0) {
      this.rotate(-moveSpeed);
    }
    if (inputKeys[this.key2Offset.KeyD] !== 0) {
      this.rotate(moveSpeed);
    }
  }

  private rotate(moveSpeed: number) {
    const oldDirX = this.dirX;
    this.dirX = this.dirX * Math.cos(moveSpeed) - this.dirY * Math.sin(moveSpeed);
    this.dirY = oldDirX * Math.sin(moveSpeed) + this.dirY * Math.cos(moveSpeed);
    const oldPlaneX = this.planeX;
    this.planeX = this.planeX * Math.cos(moveSpeed) - this.planeY * Math.sin(moveSpeed);
    this.planeY = oldPlaneX * Math.sin(moveSpeed) + this.planeY * Math.cos(moveSpeed);
  }

  private moveForward(moveSpeed: number, dir: number) {
    this.pX += dir * this.dirX * moveSpeed;
    this.pY += dir * this.dirY * moveSpeed;
  }

  private initInputManager() {
    this.inputManager = new InputManager();
    this.key2Offset = {
      KeyW: 0,
      KeyS: 1,
      KeyA: 2,
      KeyD: 3,
      // check mem size inputKeysSize
    };
    this.initInputHandlers();
  }

  private initInputHandlers() {
    this.inputManager.addKeyHandlers(keys.KEY_A, () => { }, () => { });
    // this.inputManager.addKeyHandlers(keys.KEY_S, () => { }, () => { });
    // this.inputManager.addKeyHandlers(keys.KEY_D, () => { }, () => { });
  }

  public onKeyDown(inputEvent: InputEvent) {
    this.inputManager.onKeyDown(inputEvent.code);
  }

  public onKeyUp(inputEvent: InputEvent) {
    this.inputManager.onKeyUp(inputEvent.code);
  }
}

export { RayCaster, RayCasterParams };
