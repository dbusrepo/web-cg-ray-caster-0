import assert from 'assert';
import { raycasterCfg } from './config';
// import { mainConfig } from '../../config/mainConfig';
// import type { InputEvent } from '../../app/events';
// import { AssetManager } from '../assets/assetManager';
import { BitImageRGBA /* , BPP_RGBA */ } from '../assets/images/bitImageRGBA';
// import { InputManager, keys, keyOffsets } from '../../input/inputManager';
// import { sleep } from '../utils';

// import type { WasmEngineParams } from '../wasmEngine/wasmEngine';
// import { WasmEngine } from '../wasmEngine/wasmEngine';
import type { WasmViews } from '../wasmEngine/wasmViews';
import type { WasmEngineModule } from '../wasmEngine/wasmLoader';
import type { WasmNullPtr } from '../wasmEngine/wasmRun';
import { WasmRun, WASM_NULL_PTR } from '../wasmEngine/wasmRun';
import { Viewport, getWasmViewportView } from './viewport';
import { Player, getWasmPlayerView } from './player';
import Renderer from './renderer';
import { Key, keys, keyOffsets } from '../../input/inputManager';
import {
  ascImportImages,
  imageKeys,
  TRANSP_COLOR_RGB,
} from '../../../assets/build/images';
import { Texture, initTextureWasmView, Mipmap } from '../wasmEngine/texture';
import {
  FrameColorRGBAWasm,
  // getFrameColorRGBAWasmView,
} from '../wasmEngine/frameColorRGBAWasm';

type RaycasterParams = {
  wasmRun: WasmRun;
  frameColorRGBAWasm: FrameColorRGBAWasm;
};

const WALL_TEX_KEYS = {
  GREYSTONE: imageKeys.GREYSTONE,
  BLUESTONE: imageKeys.BLUESTONE,
  REDBRICK: imageKeys.REDBRICK,
  BRICK1: imageKeys.BRICK1,
  STONE_0: imageKeys.STONE_0,
  DOOR_0: imageKeys.DOOR_0,
  TRANSP0: imageKeys.TRANSP0,
  TRANSP1: imageKeys.TRANSP1,
  TRANSP2: imageKeys.TRANSP2,
  FULL_TRANSP: imageKeys.FULL_TRANSP,
  GREEN_LIGHT: imageKeys.GREEN_LIGHT,
  BARREL: imageKeys.BARREL,
  PILLAR: imageKeys.PILLAR,
  PLANT: imageKeys.PLANT,
};

const FLOOR_TEX_KEYS = {
  FLOOR0: imageKeys.FLOOR0,
  FLOOR1: imageKeys.FLOOR1,
};

const MIN_SPRITE_DIST = 0.1;
const MAX_SPRITE_DIST = 1000; // TODO:

class Raycaster {
  private params: RaycasterParams;

  private wasmRun: WasmRun;
  private wasmViews: WasmViews;
  private wasmEngineModule: WasmEngineModule;
  private frameColorRGBAWasm: FrameColorRGBAWasm;

  private inputKeys: Uint8Array;

  private raycasterPtr: number;
  private projYCenterPtr: number;
  private borderWidthPtr: number;
  private borderColorPtr: number;

  private viewport: Viewport;
  private player: Player;

  private textures: Texture[];

  private renderer: Renderer;

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
  }

  private initData() {
    Texture.transpColor = FrameColorRGBAWasm.colorBGR(
      TRANSP_COLOR_RGB.b,
      TRANSP_COLOR_RGB.g,
      TRANSP_COLOR_RGB.r,
    );

    this.initTextures();
    this.initBorder();
    this.initViewport();

    this.ProjYCenter = this.viewport.Height / 2;

    this.initPlayer();
    this.initMap();
  }

  private initBorder() {
    this.BorderWidth = raycasterCfg.BORDER_WIDTH;
    this.BorderColor = FrameColorRGBAWasm.colorRGBAtoABGR(0xffff00ff);
  }

  private initPtrs() {
    this.borderWidthPtr = this.wasmEngineModule.getBorderWidthPtr(
      this.raycasterPtr,
    );

    this.borderColorPtr = this.wasmEngineModule.getBorderColorPtr(
      this.raycasterPtr,
    );

    this.projYCenterPtr = this.wasmEngineModule.getProjYCenterPtr(
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
    this.player.PosY = 1.5;
    // this.player.PosZ = this.WallHeight / 2; // TODO:
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

  // private initBorderColor() {}

  private initTextures() {
    this.initTexturesViews();
  }

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

  private findTex(texKey: string): Texture | null {
    let tex: Texture | null = null;
    for (let i = 0; i < this.textures.length; i++) {
      if (this.textures[i].Key === texKey) {
        tex = this.textures[i];
      }
    }
    // assert(tex !== null, `texture ${texKey} not found`);
    return tex;
  }

  public initMap() {}

  private preRender() {}

  private postRender() {}

  public render(frameCnt: number) {
    this.preRender();
    // TODO:
    this.postRender();
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
    const MOVE_SPEED = 0.01; // 0.009; // TODO:
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

  public get ProjYCenter(): number {
    return this.wasmRun.WasmViews.view.getInt32(this.projYCenterPtr, true);
  }

  private set ProjYCenter(val: number) {
    this.wasmRun.WasmViews.view.setInt32(this.projYCenterPtr, val, true);
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

  get Viewport() {
    return this.viewport;
  }

  get Player() {
    return this.player;
  }

  get Textures() {
    return this.textures;
  }

  get WasmRun() {
    return this.wasmRun;
  }

  get RaycasterPtr() {
    return this.raycasterPtr;
  }

  get ViewportWidth() {
    return this.viewport.Width;
  }

  get ViewportHeight() {
    return this.viewport.Height;
  }
}

export type { RaycasterParams };
export { Raycaster };
