import assert from 'assert';
// import { mainConfig } from '../../config/mainConfig';
// import type { InputEvent } from '../../app/events';
// import { AssetManager } from '../assets/assetManager';
import { BitImageRGBA } from '../assets/images/bitImageRGBA';
// import { InputManager, keys, keyOffsets } from '../../input/inputManager';
// import { sleep } from '../utils';

// import type { WasmEngineParams } from '../wasmEngine/wasmEngine';
// import { WasmEngine } from '../wasmEngine/wasmEngine';
import type { WasmViews } from '../wasmEngine/wasmViews';
import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { WasmRun } from '../wasmEngine/wasmRun';
import { Viewport, getWasmViewportView } from './viewport';
import { Player, getWasmPlayerView } from './player';
import { WallSlice, getWasmWallSlicesView } from './wallslice';
import Renderer from './renderer';
import { Key, keys, keyOffsets } from '../../input/inputManager';
import { ascImportImages, imageKeys } from '../../../assets/build/images';
import { Texture, initTextureWasmView } from '../wasmEngine/texture';
import {
  FrameColorRGBAWasm,
  getFrameColorRGBAWasmView,
} from '../wasmEngine/frameColorRGBAWasm';

type RaycasterParams = {
  wasmRun: WasmRun;
};

const wallTexKeys = {
  GREYSTONE: imageKeys.GREYSTONE,
  BLUESTONE: imageKeys.BLUESTONE,
  REDBRICK: imageKeys.REDBRICK,
  EAGLE: imageKeys.EAGLE,
  BRICK1: imageKeys.BRICK1,
};

const darkWallTexKeys: typeof wallTexKeys = Object.entries(wallTexKeys).reduce(
  (acc, [key, val]) => {
    const DARK_TEX_SUFFIX = '_D';
    acc[key as keyof typeof wallTexKeys] = val + DARK_TEX_SUFFIX;
    return acc;
  },
  {} as typeof wallTexKeys,
);

const floorTexKeys = {
  FLOOR0: imageKeys.FLOOR0,
  FLOOR1: imageKeys.FLOOR1,
};

class Raycaster {
  private params: RaycasterParams;
  private wasmRun: WasmRun;
  private wasmViews: WasmViews;
  private inputKeys: Uint8Array;

  private viewport: Viewport;
  private player: Player;

  private wasmEngineModule: WasmEngineModule;
  private frameColorRGBAWasm: FrameColorRGBAWasm;

  private wasmRaycasterPtr: number;

  private mapWidth: number;
  private mapHeight: number;

  private textures: Texture[];

  // wall maps with tex indices in wallTextures
  private xWallMap: Uint8Array;
  private yWallMap: Uint8Array;

  private xWallMapWidth: number;
  private xWallMapHeight: number;
  private yWallMapWidth: number;
  private yWallMapHeight: number;

  private floorMap: Uint8Array;

  private wallSlices: WallSlice[];

  private zBuffer: Float32Array;

  private maxWallDistancePtr: number;
  private projYCenterPtr: number;
  private minWallTopPtr: number;
  private maxWallTopPtr: number;
  private minWallBottomPtr: number;
  private maxWallBottomPtr: number;

  private wallHeight: number;

  private borderColorPtr: number;

  private backgroundColor: number;

  private renderer: Renderer;

  public async init(params: RaycasterParams) {
    this.params = params;

    this.wasmRun = params.wasmRun;
    this.wasmViews = this.wasmRun.WasmViews;
    this.inputKeys = this.wasmViews.inputKeys;

    this.wasmEngineModule = this.wasmRun.WasmModules.engine;

    this.frameColorRGBAWasm = getFrameColorRGBAWasmView(this.wasmEngineModule);

    this.initTextures();

    this.wasmRaycasterPtr = this.wasmEngineModule.getRaycasterPtr();

    this.viewport = getWasmViewportView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );

    this.player = getWasmPlayerView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
    );

    this.borderColorPtr = this.wasmEngineModule.getBorderColorPtr(
      this.wasmRaycasterPtr,
    );

    this.initZBufferView();
    this.initWallSlicesView();

    this.projYCenterPtr = this.wasmEngineModule.getProjYCenterPtr(
      this.wasmRaycasterPtr,
    );

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

    this.maxWallDistancePtr = this.wasmEngineModule.getMaxWallDistancePtr(
      this.wasmRaycasterPtr,
    );

    this.ProjYCenter = this.viewport.Height / 2;

    // TODO:
    // this.wallHeight = this.cfg.canvas.height;
    this.wallHeight = this.viewport.Height; // TODO:

    // TODO: player height
    this.player.PosZ = this.wallHeight / 2;

    this.backgroundColor = FrameColorRGBAWasm.colorRGBAtoABGR(0x000000ff);
    // this.renderBackground();
    // this.rotate(Math.PI / 4);

    this.initMap();

    this.renderer = new Renderer(this);
    this.renderer.renderBorders(this.BorderColor);
  }

  private initBorderColor() {
  }

  private initZBufferView() {
    const zBufferPtr = this.wasmEngineModule.getZBufferPtr(
      this.wasmRaycasterPtr,
    );
    this.zBuffer = new Float32Array(
      this.wasmRun.WasmMem.buffer,
      zBufferPtr,
      this.viewport.Width,
    );
  }

  private initWallSlicesView() {
    const numWallSlices = this.viewport.Width;
    this.wallSlices = getWasmWallSlicesView(
      this.wasmEngineModule,
      this.wasmRaycasterPtr,
      numWallSlices,
    );
  }

  // TODO:
  private initTexturesViews() {
    const wasmTexturesImport = Object.entries(ascImportImages);
    let wasmMipIdx = 0;
    this.textures = [];
    wasmTexturesImport.forEach(([texName, wasmTexIdx]) => {
      const texture = initTextureWasmView(texName, wasmTexIdx, wasmMipIdx);
      this.textures.push(texture);
      wasmMipIdx += texture.NumMipmaps;
    });
  }

  private initTextures() {
    this.initTexturesViews();
    this.genDarkWallTextures();
  }

  private findTex(texKey: string): Texture {
    let tex: Texture | null = null;
    for (let i = 0; i < this.textures.length; i++) {
      if (this.textures[i].Key === texKey) {
        tex = this.textures[i];
      }
    }
    assert(tex !== null, `texture ${texKey} not found`);
    return tex;
  }

  private genDarkWallTextures() {
    const wallTexKeysArr = Object.values(darkWallTexKeys);
    for (let i = 0; i < wallTexKeysArr.length; i++) {
      const darkTexKey = wallTexKeysArr[i];
      const darkTex = this.findTex(darkTexKey);
      darkTex.makeDarker();
    }
  }

  public initMap() {
    this.mapWidth = 10;
    this.mapHeight = 10;

    this.wasmEngineModule.initMap(this.mapWidth, this.mapHeight);

    this.initWallMap();
    this.initFloorMap();
  }

  private initWallMap() {
    const xMapPtr = this.wasmEngineModule.getXWallMapPtr(this.wasmRaycasterPtr);
    this.xWallMapWidth = this.wasmEngineModule.getXWallMapWidth(
      this.wasmRaycasterPtr,
    );
    this.xWallMapHeight = this.wasmEngineModule.getXWallMapHeight(
      this.wasmRaycasterPtr,
    );

    const yMapPtr = this.wasmEngineModule.getYWallMapPtr(this.wasmRaycasterPtr);
    this.yWallMapWidth = this.wasmEngineModule.getYWallMapWidth(
      this.wasmRaycasterPtr,
    );
    this.yWallMapHeight = this.wasmEngineModule.getYWallMapHeight(
      this.wasmRaycasterPtr,
    );

    this.xWallMap = new Uint8Array(
      this.wasmRun.WasmMem.buffer,
      xMapPtr,
      this.xWallMapWidth * this.xWallMapHeight,
    );

    this.yWallMap = new Uint8Array(
      this.wasmRun.WasmMem.buffer,
      yMapPtr,
      this.yWallMapWidth * this.yWallMapHeight,
    );

    let tex = this.findTex(wallTexKeys.GREYSTONE);
    for (let i = 0; i < this.xWallMapHeight; i++) {
      this.xWallMap[i * this.xWallMapWidth] = tex.WallMapIdx;
      this.xWallMap[i * this.xWallMapWidth + (this.xWallMapWidth - 1)] =
        tex.WallMapIdx;
    }

    tex = this.findTex(wallTexKeys.BRICK1);
    this.xWallMap[4] = tex.WallMapIdx;
    this.xWallMap[4 + this.xWallMapWidth * 2] = tex.WallMapIdx;

    tex = this.findTex(darkWallTexKeys.GREYSTONE);
    for (let i = 0; i < this.yWallMapWidth; i++) {
      this.yWallMap[i] = tex.WallMapIdx;
      this.yWallMap[i + (this.yWallMapHeight - 1) * this.yWallMapWidth] =
        tex.WallMapIdx;
    }
    // this.yMap[2] = 0; // test hole

    tex = this.findTex(darkWallTexKeys.REDBRICK);
    this.yWallMap[4 + this.yWallMapWidth * 2] = tex.WallMapIdx;
    this.yWallMap[5 + this.yWallMapWidth * 2] = tex.WallMapIdx;
  }

  private initFloorMap() {
    const floorMapPtr = this.wasmEngineModule.getFloorMapPtr(
      this.wasmRaycasterPtr,
    );

    this.floorMap = new Uint8Array(
      this.wasmRun.WasmMem.buffer,
      floorMapPtr,
      this.mapWidth * this.mapHeight,
    );

    let tex = this.findTex(floorTexKeys.FLOOR0);

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        this.floorMap[y * this.mapWidth + x] = tex.WasmIdx;
      }
    }

    tex = this.findTex(floorTexKeys.FLOOR1);
    this.floorMap[4 * this.mapWidth + 4] = tex.WasmIdx;
  }

  render() {
    const { mapWidth, mapHeight } = this;
    const { xWallMap: xMap, yWallMap: yMap } = this;
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

    const projYcenter = this.ProjYCenter;

    let minWallTop = projYcenter;
    let maxWallTop = -1;
    let minWallBottom = vpHeight;
    let maxWallBottom = projYcenter;

    let maxWallDistance = 0;

    const { wallSlices } = this;

    for (let x = 0; x < vpWidth; x++) {
      const cameraX = (2 * x) / vpWidth - 1;
      // TODO: horz floor casting gives out bounds with rayDirX
      // const cameraX = (2 * x) / (vpWidth - 1) - 1;
      const rayDirX = dirX + planeX * cameraX;
      const rayDirY = dirY + planeY * cameraX;
      const deltaDistX = 1 / Math.abs(rayDirX);
      const deltaDistY = 1 / Math.abs(rayDirY);

      let sideDistX, sideDistY; // distances to next x/y line
      let stepX, stepY; // +1 or -1, step in map
      let xStepYOffs; // step y in x map
      let yStepYOffs; // step y in y map
      let xChkIdx, yChkOff, yChkIdx; // check offsets in x/y maps

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
        xStepYOffs = -this.xWallMapWidth;
        yStepYOffs = -this.yWallMapWidth;
        yChkOff = 0;
        yChkIdx = 0;
        sideDistY = cellY * deltaDistY;
      } else {
        stepY = 1;
        xStepYOffs = this.xWallMapWidth;
        yStepYOffs = this.yWallMapWidth;
        yChkOff = this.yWallMapWidth;
        yChkIdx = 1;
        sideDistY = (1.0 - cellY) * deltaDistY;
      }

      // ray map position
      let curMapX = mapX;
      let curMapY = mapY;
      let nextMapX, nextMapY;

      let xMapOffs = curMapY * this.xWallMapWidth + curMapX;
      let yMapOffs = curMapY * this.yWallMapWidth + curMapX;

      let MAX_STEPS = 100; // TODO:
      let perpWallDist = 0.0;
      let wallX = 0;
      let flipTexX = false;
      let outOfMap = false;

      let checkWallIdx = -1;

      let side = 0;

      do {
        if (sideDistX < sideDistY) {
          side = 0;
          perpWallDist = sideDistX;
          checkWallIdx = xMapOffs + xChkIdx;
          if (xMap[checkWallIdx]) {
            break;
          }
          nextMapX = curMapX + stepX;
          if (nextMapX < 0 || nextMapX >= mapWidth) {
            outOfMap = true;
            break;
          }
          curMapX = nextMapX;
          sideDistX += deltaDistX;
          xMapOffs += stepX;
          yMapOffs += stepX;
        } else {
          side = 1;
          perpWallDist = sideDistY;
          checkWallIdx = yMapOffs + yChkOff;
          if (yMap[checkWallIdx]) {
            break;
          }
          nextMapY = curMapY + stepY;
          if (nextMapY < 0 || nextMapY >= mapHeight) {
            outOfMap = true;
            break;
          }
          curMapY = nextMapY;
          sideDistY += deltaDistY;
          yMapOffs += yStepYOffs;
          xMapOffs += xStepYOffs;
        }
      } while (--MAX_STEPS);

      this.zBuffer[x] = perpWallDist;
      if (perpWallDist > maxWallDistance) {
        maxWallDistance = perpWallDist;
      }

      const ratio = 1 / perpWallDist;
      const projWallBottom = (projYcenter + posZ * ratio) | 0;
      const wallSliceProjHeight = (this.wallHeight * ratio) | 0;
      const projWallTop = projWallBottom - wallSliceProjHeight + 1;
      // const sliceHeight = projWallBottom - projWallTop + 1;

      let wallTop = projWallTop;
      let clipTop = 0;
      if (projWallTop < 0) {
        clipTop = -projWallTop;
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

      // used only for vert floor/ceil rend
      let floorWallX;
      let floorWallY;

      let wallMap;

      if (side === 0) {
        wallMap = xMap;
        wallX = posY + perpWallDist * rayDirY;
        wallX -= wallX | 0;
        flipTexX = rayDirX > 0;
        floorWallY = curMapY + wallX;
        floorWallX = curMapX + xChkIdx;
      } else {
        wallMap = yMap;
        wallX = posX + perpWallDist * rayDirX;
        wallX -= wallX | 0;
        flipTexX = rayDirY < 0;
        floorWallX = curMapX + wallX;
        floorWallY = curMapY + yChkIdx;
      }

      wallSlice.FloorWallX = floorWallX;
      wallSlice.FloorWallY = floorWallY;

      if (outOfMap || MAX_STEPS <= 0) {
        wallSlice.Hit = 0;
        // console.log('MAX_STEPS exceeded');
        // console.log('no hit');
        // break; // TODO:
        // continue loopCol;
        continue;
      }

      wallSlice.Hit = 1;

      const texIdx = wallMap[checkWallIdx] - 1;
      // assert(texIdx >= 0 && texIdx < this.textures.length, 'invalid texIdx');

      const tex = this.textures[texIdx];
      const mipmap = tex.getMipmap(0);
      const {
        Width: texWidth,
        Height: texHeight,
        // Lg2Pitch: lg2Pitch,
      } = mipmap.Image;

      let texX = (wallX * texWidth) | 0;
      if (flipTexX) {
        texX = texWidth - texX - 1;
      }
      // assert(texX >= 0 && texX < texWidth, `invalid texX ${texX}`);

      const texStepY = texHeight / wallSliceProjHeight;

      const texY = clipTop * texStepY;

      wallSlice.ProjHeight = wallSliceProjHeight;
      wallSlice.ClipTop = clipTop;

      wallSlice.TexX = texX;
      wallSlice.TexStepY = texStepY;
      wallSlice.TexY = texY;
      wallSlice.MipMapIdx = mipmap.WasmIdx; // used in render wasm
      wallSlice.Mipmap = mipmap.Image; // used in render ts
    } // end col loop

    this.MaxWallDistance = maxWallDistance;
    this.MinWallTop = minWallTop;
    this.MaxWallTop = maxWallTop;
    this.MinWallBottom = minWallBottom;
    this.MaxWallBottom = maxWallBottom;

    this.renderer.TexturedFloor = true;
    this.renderer.UseWasm = false;
    this.renderer.render();
  }

  update(time: number) {
    this.updateLookUpDown(time);
    this.updatePlayer(time);
  }

  private updateLookUpDown(time: number) {
    const OFFS = 15 * time;
    if (this.isKeyDown(keys.KEY_E)) {
      this.lookUp(OFFS);
    }

    if (this.isKeyDown(keys.KEY_C)) {
      this.lookDown(OFFS);
    }
  }

  public lookUp(upOffs: number) {
    const yCenter = this.ProjYCenter + upOffs;
    this.ProjYCenter = Math.min(yCenter, (this.viewport.Height * 2) / 3) | 0;
  }

  public lookDown(downOffs: number) {
    const yCenter = this.ProjYCenter - downOffs;
    this.ProjYCenter = Math.max(yCenter, this.viewport.Height / 3) | 0;
  }

  private isKeyDown(key: Key): boolean {
    return this.inputKeys[keyOffsets[key]] !== 0;
  }

  private updatePlayer(time: number) {
    const MOVE_SPEED = 0.009; // TODO:
    const ROT_SPEED = 0.006; // TODO:
    const moveSpeed = time * MOVE_SPEED;
    const rotSpeed = time * ROT_SPEED;

    if (this.isKeyDown(keys.KEY_W)) {
      this.movePlayer(moveSpeed);
    }
    if (this.isKeyDown(keys.KEY_S)) {
      this.movePlayer(-moveSpeed);
    }
    if (this.isKeyDown(keys.KEY_A)) {
      this.rotatePlayer(-rotSpeed);
    }
    if (this.isKeyDown(keys.KEY_D)) {
      this.rotatePlayer(rotSpeed);
    }
    if (this.isKeyDown(keys.KEY_Q)) {
      this.updatePlayerHeight(1);
    }
    if (this.isKeyDown(keys.KEY_Z)) {
      this.updatePlayerHeight(-1);
    }
  }

  private updatePlayerHeight(dir: number) {
    let height = this.player.PosZ + dir * 10;
    const LIMIT = 100;
    if (height < LIMIT) {
      height = LIMIT;
    }
    if (height > this.wallHeight - LIMIT) {
      height = this.wallHeight - LIMIT;
    }
    this.player.PosZ = height;
  }

  private movePlayer(moveSpeed: number) {
    const { player } = this;
    player.PosX += player.DirX * moveSpeed;
    player.PosY += player.DirY * moveSpeed;
  }

  public rotatePlayer(rotSpeed: number) {
    const { player } = this;
    const cos = Math.cos(rotSpeed);
    const sin = Math.sin(rotSpeed);
    const oldDirX = player.DirX;
    player.DirX = player.DirX * cos - player.DirY * sin;
    player.DirY = oldDirX * sin + player.DirY * cos;
    const oldPlaneX = player.PlaneX;
    player.PlaneX = player.PlaneX * cos - player.PlaneY * sin;
    player.PlaneY = oldPlaneX * sin + player.PlaneY * cos;
  }

  get ProjYCenter(): number {
    return this.wasmRun.WasmViews.view.getInt32(this.projYCenterPtr, true);
  }

  private set ProjYCenter(val: number) {
    this.wasmRun.WasmViews.view.setInt32(this.projYCenterPtr, val, true);
  }

  get MaxWallDistance(): number {
    return this.wasmRun.WasmViews.view.getFloat32(
      this.maxWallDistancePtr,
      true,
    );
  }

  private set MaxWallDistance(val: number) {
    this.wasmRun.WasmViews.view.setFloat32(this.maxWallDistancePtr, val, true);
  }

  get MinWallTop(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.minWallTopPtr, true);
  }

  private set MinWallTop(val: number) {
    this.wasmRun.WasmViews.view.setUint32(this.minWallTopPtr, val, true);
  }

  get MaxWallTop(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.maxWallTopPtr, true);
  }

  private set MaxWallTop(val: number) {
    this.wasmRun.WasmViews.view.setUint32(this.maxWallTopPtr, val, true);
  }

  get MinWallBottom(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.minWallBottomPtr, true);
  }

  private set MinWallBottom(val: number) {
    this.wasmRun.WasmViews.view.setUint32(this.minWallBottomPtr, val, true);
  }

  get MaxWallBottom(): number {
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

  get FloorMap() {
    return this.floorMap;
  }

  get WallSlices() {
    return this.wallSlices;
  }

  get MapWidth() {
    return this.mapWidth;
  }

  get Textures() {
    return this.textures;
  }

  get WasmRun() {
    return this.wasmRun;
  }
}

export { Raycaster, RaycasterParams };
