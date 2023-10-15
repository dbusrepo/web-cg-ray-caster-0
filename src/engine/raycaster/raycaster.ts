import assert from 'assert';
import { raycasterCfg } from './config';
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
import type { WasmRunParams, WasmNullPtr } from '../wasmEngine/wasmRun';
import { WasmRun, WASM_NULL_PTR } from '../wasmEngine/wasmRun';
import { Viewport, getWasmViewportView } from './viewport';
import { Player, getWasmPlayerView } from './player';
import { Sprite, getWasmSpritesView } from './sprite';
import {
  Slice,
  getWasmWallSlicesView,
  newSliceView,
  // freeSliceView,
  freeTranspSliceViewsList,
} from './slice';
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
  frameColorRGBAWasm: FrameColorRGBAWasm;
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
  private wasmEngineModule: WasmEngineModule;
  private frameColorRGBAWasm: FrameColorRGBAWasm;

  private inputKeys: Uint8Array;

  private borderWidthPtr: number;
  private borderColorPtr: number;
  private wallHeightPtr: number;
  private maxWallDistancePtr: number;
  private projYCenterPtr: number;
  private minWallTopPtr: number;
  private maxWallTopPtr: number;
  private minWallBottomPtr: number;
  private maxWallBottomPtr: number;
  private raycasterPtr: number;

  private viewport: Viewport;
  private player: Player;
  private sprites: Sprite[];

  private viewSprites: Sprite[];
  private numViewSprites: number;

  private wallSlices: Slice[];
  private transpSlices: (Slice | WasmNullPtr)[];
  private numTranspSlices: number;

  private zBuffer: Float32Array;

  private mapWidth: number;
  private mapHeight: number;

  private textures: Texture[];

  private xWallMap: Uint8Array;
  private yWallMap: Uint8Array;

  private xWallMapWidth: number;
  private xWallMapHeight: number;
  private yWallMapWidth: number;
  private yWallMapHeight: number;

  private floorMap: Uint8Array;

  private backgroundColor: number; // TODO:

  private frameIdx: number;
  private renderer: Renderer;

  // vars used in main raycasting loop
  private pos = new Float32Array(2);
  private rayDir = new Float32Array(2);
  private sideDist = new Float32Array(2);
  private deltaDist = new Float32Array(2);
  private step = new Int32Array(2);
  private mapOffs = new Int32Array(2);
  private checkWallIdxOffs = new Int32Array(2);
  private checkWallIdxOffsDivFactor = new Int32Array(2);
  private curMapPos = new Int32Array(2);
  private wallMaps = new Array<Uint8Array>(2);
  private mapLimits = new Int32Array(2);
  private mapIncOffs = new Int32Array(4);
  private floorWall = new Float32Array(2);

  // private _2float: Float32Array;
  // private _2u32: Uint32Array;

  public async init(params: RaycasterParams) {
    this.params = params;

    this.wasmRun = params.wasmRun;
    this.wasmViews = this.wasmRun.WasmViews;
    this.inputKeys = this.wasmViews.inputKeys;
    this.wasmEngineModule = this.wasmRun.WasmModules.engine;
    this.frameColorRGBAWasm = params.frameColorRGBAWasm;
    this.raycasterPtr = this.wasmEngineModule.getRaycasterPtr();

    this.initPtrs();
    this.initData();
    this.initRenderer();

    this.renderer.renderBorders(this.BorderColor);

    // this.renderBackground();
    // this.rotate(Math.PI / 4);

    // this._2float = new Float32Array(1);
    // example
    // this._2float[0] = tY; // convert tY to float
    // const tYf = this._2float[0];
  }

  private initRenderer() {
    this.renderer = new Renderer(this);
    this.renderer.TexturedFloor = true;
    this.renderer.UseWasm = false;
    this.renderer.VertFloor = true;
  }

  private initData() {
    this.initTextures();
    this.initBorder();
    this.initViewport();
    this.initZBuffer();
    this.initWallSlices();
    this.initTranspSlices();

    this.backgroundColor = FrameColorRGBAWasm.colorRGBAtoABGR(0x000000ff);
    this.ProjYCenter = this.viewport.Height / 2;
    // this.wallHeight = this.cfg.canvas.height;
    this.WallHeight = this.viewport.Height; // TODO:

    this.initPlayer();
    this.initSprites();
    this.initMap();

    this.frameIdx = 0;
  }

  private initBorder() {
    this.BorderWidth = raycasterCfg.BORDER_WIDTH;
    this.BorderColor = FrameColorRGBAWasm.colorRGBAtoABGR(0xffff00ff);
  }

  private initPtrs() {
    this.wallHeightPtr = this.wasmEngineModule.getWallHeightPtr(
      this.raycasterPtr,
    );

    this.borderWidthPtr = this.wasmEngineModule.getBorderWidthPtr(
      this.raycasterPtr,
    );

    this.borderColorPtr = this.wasmEngineModule.getBorderColorPtr(
      this.raycasterPtr,
    );

    this.projYCenterPtr = this.wasmEngineModule.getProjYCenterPtr(
      this.raycasterPtr,
    );

    this.minWallTopPtr = this.wasmEngineModule.getMinWallTopPtr(
      this.raycasterPtr,
    );

    this.maxWallTopPtr = this.wasmEngineModule.getMaxWallTopPtr(
      this.raycasterPtr,
    );

    this.minWallBottomPtr = this.wasmEngineModule.getMinWallBottomPtr(
      this.raycasterPtr,
    );

    this.maxWallBottomPtr = this.wasmEngineModule.getMaxWallBottomPtr(
      this.raycasterPtr,
    );

    this.maxWallDistancePtr = this.wasmEngineModule.getMaxWallDistancePtr(
      this.raycasterPtr,
    );
  }

  private initViewport() {
    this.viewport = getWasmViewportView(
      this.wasmEngineModule,
      this.raycasterPtr,
    );
    this.viewport.StartX = this.BorderWidth;
    this.viewport.StartY = this.BorderWidth;
    this.viewport.Width = this.wasmRun.FrameWidth - this.BorderWidth * 2;
    this.viewport.Height = this.wasmRun.FrameHeight - this.BorderWidth * 2;
  }

  private initPlayer() {
    this.player = getWasmPlayerView(this.wasmEngineModule, this.raycasterPtr);
    this.player.PosX = 0.5;
    this.player.PosY = 0.5;
    assert(this.WallHeight);
    this.player.PosZ = this.WallHeight / 2; // TODO:
    // rotated east
    this.player.DirX = 1;
    this.player.DirY = 0;
    this.player.PlaneX = 0;
    this.player.PlaneY = 0.66; // FOV 2*atan(0.66) ~ 60 deg
    // rotated north
    // player.DirX = 0;
    // player.DirY = -1;
    // player.PlaneX = 0.66;
    // player.PlaneY = 0; // FOV 2*atan(0.66) ~ 60 deg
  }

  private initSprites(): void {
    const NUM_SPRITES = 1;
    this.wasmEngineModule.allocSpritesArr(this.raycasterPtr, NUM_SPRITES);
    this.sprites = getWasmSpritesView(this.wasmEngineModule, this.raycasterPtr);
    if (this.sprites.length) {
      this.viewSprites = new Array<Sprite>(1 + this.sprites.length);

      // TODO: init sprites
      const sprite = this.sprites[0];
      sprite.PosX = 7.5;
      sprite.PosY = 0.5;
      sprite.PosZ = 0; // this.WallHeight; // base, 0 is the floor lvl
      sprite.TexIdx = 0;
      sprite.Visible = 1;
    }
  }

  // private initBorderColor() {
  // }

  private initZBuffer() {
    const zBufferPtr = this.wasmEngineModule.allocZBuffer(this.raycasterPtr);
    assert(this.viewport, 'viewport not initialized');
    this.zBuffer = new Float32Array(
      this.wasmRun.WasmMem.buffer,
      zBufferPtr,
      this.viewport.Width,
    );
  }

  private initWallSlices() {
    assert(this.viewport, 'viewport not initialized');
    this.wasmEngineModule.allocWallSlices(this.raycasterPtr);
    this.wallSlices = getWasmWallSlicesView(
      this.wasmEngineModule,
      this.raycasterPtr,
    );
  }

  private initTranspSlices() {
    assert(this.viewport, 'viewport not initialized');
    this.wasmEngineModule.allocTranspSlices(this.raycasterPtr);
    this.transpSlices = new Array<Slice | WasmNullPtr>(this.viewport.Width);
    this.resetTranspSlices();
  }

  private initTextures() {
    this.initTexturesViews();
    this.genDarkWallTextures();
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

  // TODO:
  private genDarkWallTextures() {
    const wallTexKeysArr = Object.values(darkWallTexKeys);
    for (let i = 0; i < wallTexKeysArr.length; i++) {
      const darkTexKey = wallTexKeysArr[i];
      const darkTex = this.findTex(darkTexKey);
      darkTex.makeDarker();
    }
  }

  public initMap() {
    // TODO:
    const MAP_WIDTH = 10;
    const MAP_HEIGHT = 10;

    this.mapWidth = MAP_WIDTH;
    this.mapHeight = MAP_HEIGHT;

    this.wasmEngineModule.allocMap(this.mapWidth, this.mapHeight);

    this.initWallMap();
    this.initFloorMap();
  }

  private initWallMap() {
    const xMapPtr = this.wasmEngineModule.getXWallMapPtr(this.raycasterPtr);
    this.xWallMapWidth = this.wasmEngineModule.getXWallMapWidth(
      this.raycasterPtr,
    );
    this.xWallMapHeight = this.wasmEngineModule.getXWallMapHeight(
      this.raycasterPtr,
    );

    const yMapPtr = this.wasmEngineModule.getYWallMapPtr(this.raycasterPtr);
    this.yWallMapWidth = this.wasmEngineModule.getYWallMapWidth(
      this.raycasterPtr,
    );
    this.yWallMapHeight = this.wasmEngineModule.getYWallMapHeight(
      this.raycasterPtr,
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
    // this.xWallMap[0] = 0; // test hole

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
    const floorMapPtr = this.wasmEngineModule.getFloorMapPtr(this.raycasterPtr);

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

  private preRender() {
    this.freeTranspSlices();
    this.frameIdx++;
  }

  private postRender() {}

  public render() {
    this.preRender();

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
    const {
      pos,
      wallMaps,
      mapLimits,
      rayDir,
      deltaDist,
      step,
      checkWallIdxOffs,
      checkWallIdxOffsDivFactor,
      mapIncOffs,
      xWallMapWidth,
      yWallMapWidth,
      curMapPos,
      mapOffs,
      sideDist,
      zBuffer,
      floorWall,
      textures,
      wallSlices,
      WallHeight: wallHeight,
    } = this;

    assert(posX >= 0 && posX < mapWidth, 'posX out of map bounds');
    assert(posY >= 0 && posY < mapHeight, 'posY out of map bounds');

    const texturedVertFloor =
      this.renderer.TexturedFloor && this.renderer.VertFloor;

    const projYcenter = this.ProjYCenter;

    const mapX = posX | 0;
    const mapY = posY | 0;

    const cellX = posX - mapX;
    const cellY = posY - mapY;

    const mapOffsX = mapY * xWallMapWidth + posX;
    const mapOffsY = mapY * yWallMapWidth + posX;

    let maxWallDistance = 0;
    let minWallTop = projYcenter;
    let maxWallTop = -1;
    let minWallBottom = vpHeight;
    let maxWallBottom = projYcenter;

    const X = 0;
    const Y = 1;

    pos[X] = posX;
    pos[Y] = posY;
    wallMaps[X] = xMap;
    wallMaps[Y] = yMap;
    mapLimits[X] = mapWidth;
    mapLimits[Y] = mapHeight;

    for (let x = 0; x < vpWidth; x++) {
      const cameraX = (2 * x) / vpWidth - 1;

      rayDir[X] = dirX + planeX * cameraX;
      rayDir[Y] = dirY + planeY * cameraX;
      deltaDist[X] = 1 / Math.abs(rayDir[X]);
      deltaDist[Y] = 1 / Math.abs(rayDir[Y]);

      if (rayDir[X] < 0) {
        step[X] = -1;
        checkWallIdxOffs[X] = 0;
        sideDist[X] = cellX * deltaDist[X];
      } else {
        step[X] = 1;
        checkWallIdxOffs[X] = 1;
        sideDist[X] = (1.0 - cellX) * deltaDist[X];
      }

      checkWallIdxOffsDivFactor[X] = 1;
      mapIncOffs[0] = mapIncOffs[1] = step[X];

      if (rayDir[Y] < 0) {
        step[Y] = -1;
        mapIncOffs[2] = -xWallMapWidth;
        mapIncOffs[3] = -yWallMapWidth;
        checkWallIdxOffs[Y] = 0;
        checkWallIdxOffsDivFactor[Y] = 1;
        sideDist[Y] = cellY * deltaDist[Y];
      } else {
        step[Y] = 1;
        mapIncOffs[2] = xWallMapWidth;
        mapIncOffs[3] = yWallMapWidth;
        checkWallIdxOffs[Y] = yWallMapWidth;
        checkWallIdxOffsDivFactor[Y] = yWallMapWidth;
        sideDist[Y] = (1.0 - cellY) * deltaDist[Y];
      }

      curMapPos[X] = mapX;
      curMapPos[Y] = mapY;
      mapOffs[X] = mapOffsX;
      mapOffs[Y] = mapOffsY;

      let MAX_STEPS = 100; // TODO:
      let perpWallDist = 0.0;
      let outOfMap = false;
      let checkWallIdx;
      let side;

      do {
        side = sideDist[X] < sideDist[Y] ? X : Y;
        checkWallIdx = mapOffs[side] + checkWallIdxOffs[side];
        const wallCode = wallMaps[side][checkWallIdx];
        if (!wallCode) {
          const nextPos = curMapPos[side] + step[side];
          if (nextPos < 0 || nextPos >= mapLimits[side]) {
            outOfMap = true;
            break;
          }
          curMapPos[side] = nextPos;
          sideDist[side] += deltaDist[side];
          mapOffs[side] += mapIncOffs[(side << 1) + side];
          mapOffs[side ^ 1] += mapIncOffs[(side << 1) + (side ^ 1)];
        } else {
          perpWallDist = sideDist[side];
          break;
        }
      } while (--MAX_STEPS);

      zBuffer[x] = perpWallDist;
      maxWallDistance = Math.max(maxWallDistance, perpWallDist);

      const ratio = 1 / perpWallDist;
      let wallBottom = (projYcenter + posZ * ratio) | 0;
      const wallSliceProjHeight = (wallHeight * ratio) | 0;
      let wallTop = wallBottom - wallSliceProjHeight + 1;
      // const sliceHeight = wallBottom - wallTop + 1;

      const clipTop = Math.max(0, -wallTop);
      wallTop += clipTop; // wallTop = Math.max(0, wallTop);
      wallBottom = Math.min(wallBottom, vpHeight - 1);
      // assert(wallTop <= wallBottom, `invalid top ${wallTop} and bottom`); // <= ?

      const wallSlice = wallSlices[x];
      wallSlice.Distance = perpWallDist;
      wallSlice.Top = wallTop;
      wallSlice.Bottom = wallBottom;
      wallSlice.Side = side;

      minWallTop = Math.min(minWallTop, wallTop);
      maxWallTop = Math.max(maxWallTop, wallTop);
      minWallBottom = Math.min(minWallBottom, wallBottom);
      maxWallBottom = Math.max(maxWallBottom, wallBottom);

      const mapWallX = pos[side ^ 1] + perpWallDist * rayDir[side ^ 1];
      const wallX = mapWallX - (mapWallX | 0);

      if (texturedVertFloor) {
        floorWall[side ^ 1] = curMapPos[side ^ 1] + wallX;
        const floorWallXOffs =
          checkWallIdxOffs[side] / checkWallIdxOffsDivFactor[side];
        floorWall[side] = curMapPos[side] + floorWallXOffs;
        [wallSlice.FloorWallX, wallSlice.FloorWallY] = floorWall;
      }

      if (outOfMap || MAX_STEPS <= 0) {
        wallSlice.Hit = 0;
        continue;
      }

      wallSlice.Hit = 1;

      const texIdx = wallMaps[side][checkWallIdx] - 1;
      // assert(texIdx >= 0 && texIdx < this.textures.length, 'invalid texIdx');

      const tex = textures[texIdx];
      const mipmap = tex.getMipmap(0); // TODO:

      const {
        Width: texWidth,
        Height: texHeight,
        // Lg2Pitch: lg2Pitch,
      } = mipmap.Image;

      const flipTexX = side === 0 ? rayDir[X] > 0 : rayDir[Y] < 0;
      const srcTexX = (wallX * texWidth) | 0;
      const texX = flipTexX ? texWidth - srcTexX - 1 : srcTexX;
      // assert(texX >= 0 && texX < texWidth, `invalid texX ${texX}`);

      const texStepY = texHeight / wallSliceProjHeight;
      const texY = clipTop * texStepY;

      wallSlice.Height = wallSliceProjHeight;
      wallSlice.ClipTop = clipTop;

      wallSlice.TexX = texX;
      wallSlice.TexStepY = texStepY;
      wallSlice.TexY = texY;
      wallSlice.MipMapIdx = mipmap.WasmIdx; // used in render wasm
      wallSlice.Mipmap = mipmap.Image; // used in render ts
    }

    this.MaxWallDistance = maxWallDistance;
    this.MinWallTop = minWallTop;
    this.MaxWallTop = maxWallTop;
    this.MinWallBottom = minWallBottom;
    this.MaxWallBottom = maxWallBottom;

    this.processSprites();
    this.renderer.render();
    this.postRender();
  }

  private processSprites(): void {
    const { sprites } = this;
    const { player } = this;
    const { PosX: playerX, PosY: playerY, PosZ: playerZ } = player;
    const { DirX: playerDirX, DirY: playerDirY } = player;
    const { PlaneX: playerPlaneX, PlaneY: playerPlaneY } = player;
    const { Width: vpWidth, Height: vpHeight } = this.viewport;

    const MIN_SPRITE_DIST = 0.1;
    const MAX_SPRITE_DIST = 1000; // TODO:

    const minDist = MIN_SPRITE_DIST;
    const maxDist = Math.min(this.MaxWallDistance, MAX_SPRITE_DIST);

    this.numViewSprites = 0;

    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];

      if (!sprite.Visible) {
        continue;
      }

      const spriteX = sprite.PosX - playerX;
      const spriteY = sprite.PosY - playerY;

      const invDet =
        1.0 / (playerPlaneX * playerDirY - playerDirX * playerPlaneY);
      const tY = invDet * (-playerPlaneY * spriteX + playerPlaneX * spriteY);

      if (tY < minDist || tY > maxDist) {
        // console.log('tY behind or too far'); // behind or occluded by max (wall) distance
        continue;
      }

      const tX = invDet * (playerDirY * spriteX - playerDirX * spriteY);
      const invTy = 1.0 / tY;

      const spriteHeight = (this.WallHeight * invTy) | 0;
      const spriteWidth = spriteHeight;

      const spriteScreenX = ((vpWidth / 2) * (1 + tX * invTy)) | 0;
      let startX = spriteScreenX - (spriteWidth >> 1);

      if (startX >= vpWidth) {
        continue;
      }

      let endX = startX + spriteWidth;

      if (endX < 0) {
        continue;
      }

      // clip startX
      const clipX = Math.max(0, -startX);
      startX += clipX;

      // clip endX
      endX = Math.min(endX, vpWidth);

      // sprite cols in [startX, endX)

      const dy = (playerZ - sprite.PosZ) * invTy;
      let endY = (this.ProjYCenter + dy) | 0;

      if (endY < 0) {
        continue;
      }

      let startY = endY - spriteHeight + 1;

      if (startY >= vpHeight) {
        continue;
      }

      // vertical clip
      const clipY = Math.max(0, -startY);
      startY += clipY;
      endY = Math.min(endY, vpHeight - 1);

      // assert(startY <= endY, `invalid startY ${startY} and endY ${endY}`);
      // sprite rows in [startY, endY]

      // sprite cols in [startX, endX)

      // occlusion test
      let x = startX;
      for (; x < endX && this.zBuffer[x] < tY; x++);

      if (x === endX) {
        // sprite is occluded
        continue;
      }

      const texIdx = sprite.TexIdx;
      const tex = this.textures[texIdx];
      const mipmap = tex.getMipmap(0); // TODO:
      const {
        Width: texWidth,
        Height: texHeight,
        // Lg2Pitch: lg2Pitch,
      } = mipmap.Image;

      const texStepX = texWidth / spriteWidth;
      const texX = (clipX * texStepX) | 0;

      const texStepY = texHeight / spriteHeight;
      const texY = (clipY * texStepY) | 0;

      sprite.Distance = tY;
      sprite.StartX = startX;
      sprite.EndX = endX;
      sprite.TexX = texX;
      sprite.TexStepX = texStepX;
      sprite.StartY = startY;
      sprite.EndY = endY;
      sprite.TexY = texY;
      sprite.TexStepY = texStepY;

      // insertion sort on viewSprites[1..numViewSprites) on descending distance
      let j = this.numViewSprites++;
      this.viewSprites[0] = sprite; // sentinel
      const spriteDist = sprite.Distance; // get float dist value
      for (; this.viewSprites[j].Distance < spriteDist; j--) {
        this.viewSprites[j + 1] = this.viewSprites[j];
      }
      this.viewSprites[j + 1] = sprite;
    }
  }

  private updateTranspSliceArrayIdx(
    idx: number,
    newSlice: Slice | WasmNullPtr,
  ) {
    this.transpSlices[idx] = newSlice;
    // set ptr to first slice in transp wall slice array in wasm mem
    this.wasmEngineModule.setTranspSliceAtIdx(
      this.raycasterPtr,
      idx,
      newSlice ? newSlice.WasmPtr : WASM_NULL_PTR,
    );
  }

  private newTranspSlice(idx: number) {
    this.numTranspSlices++;
    const newSlice = newSliceView(this.wasmEngineModule);
    // insert at front in transpSlices[idx]
    if (this.transpSlices[idx]) {
      const frontSlice = this.transpSlices[idx] as Slice;
      newSlice.Prev = frontSlice.Prev;
      frontSlice.Prev = newSlice;
      newSlice.Next = frontSlice;
      // assert(sliceView.Prev !== null);
      newSlice.Prev!.Next = newSlice;
    } else {
      newSlice.Prev = newSlice;
      newSlice.Next = newSlice;
    }
    this.updateTranspSliceArrayIdx(idx, newSlice);
    return newSlice;
  }

  private resetTranspSlices() {
    this.numTranspSlices = 0;
    this.wasmEngineModule.resetTranspSlicesPtrs(this.raycasterPtr);
    for (let i = 0; i < this.transpSlices.length; i++) {
      this.transpSlices[i] = 0;
    }
  }

  private freeTranspSlices() {
    if (this.numTranspSlices) {
      for (let i = 0; i < this.transpSlices.length; i++) {
        if (this.transpSlices[i]) {
          const slice = this.transpSlices[i] as Slice;
          freeTranspSliceViewsList(slice);
        }
      }
      this.resetTranspSlices();
    }
  }

  public update(time: number) {
    this.updateLookUpDown(time);
    this.updatePlayer(time);
  }

  // TODO:
  private updateLookUpDown(time: number) {
    const OFFS = 15 * time;
    if (this.isKeyDown(keys.KEY_E)) {
      const yCenter = this.ProjYCenter + OFFS;
      this.ProjYCenter = Math.min(yCenter, (this.viewport.Height * 2) / 3) | 0;
    }

    if (this.isKeyDown(keys.KEY_C)) {
      const yCenter = this.ProjYCenter - OFFS;
      this.ProjYCenter = Math.max(yCenter, this.viewport.Height / 3) | 0;
    }
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
    if (height > this.WallHeight - LIMIT) {
      height = this.WallHeight - LIMIT;
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

  private get WallHeight(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.wallHeightPtr, true);
  }

  private set WallHeight(val: number) {
    this.wasmRun.WasmViews.view.setUint32(this.wallHeightPtr, val, true);
  }

  public get ProjYCenter(): number {
    return this.wasmRun.WasmViews.view.getInt32(this.projYCenterPtr, true);
  }

  private set ProjYCenter(val: number) {
    this.wasmRun.WasmViews.view.setInt32(this.projYCenterPtr, val, true);
  }

  private get MaxWallDistance(): number {
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

  private get BorderWidth(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.borderWidthPtr, true);
  }

  private set BorderWidth(value: number) {
    this.wasmRun.WasmViews.view.setUint32(this.borderWidthPtr, value, true);
  }

  private get BorderColor(): number {
    return this.wasmRun.WasmViews.view.getUint32(this.borderColorPtr, true);
  }

  private set BorderColor(value: number) {
    this.wasmRun.WasmViews.view.setUint32(this.borderColorPtr, value, true);
  }

  public get ViewSprites(): Sprite[] {
    return this.viewSprites;
  }

  public get NumViewSprites(): number {
    return this.numViewSprites;
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
