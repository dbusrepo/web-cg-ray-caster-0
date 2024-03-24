import assert from 'assert';
import { raycasterCfg } from './config';
// import { mainConfig } from '../../config/mainConfig';
// import type { InputEvent } from '../../app/events';
// import { AssetManager } from '../assets/assetManager';
// import { sleep } from '../utils';
import { BitImageRGBA /* , BPP_RGBA */ } from '../assets/images/bitImageRGBA';
import { InputAction, InputActionBehavior } from '../../input/inputAction';
import {
  InputManager,
  MouseCodeEnum,
  EnginePanelInputKeyCodeEnum,
} from '../../input/inputManager';
// import type { WasmEngineParams } from '../wasmEngine/wasmEngine';
// import { WasmEngine } from '../wasmEngine/wasmEngine';
import type { WasmViews } from '../wasmEngine/wasmViews';
import type { WasmEngineModule } from '../wasmEngine/wasmLoader';
import type { WasmNullPtr } from '../wasmEngine/wasmRun';
import { WasmRun, WASM_NULL_PTR } from '../wasmEngine/wasmRun';
import { Viewport, getWasmViewportView } from './viewport';
import { Player, getWasmPlayerView } from './player';
import { Sprite, getWasmSpritesView } from './sprite';
import type { Door, DoorRef } from './door';
import { newDoorView, freeDoorView, getDoorView } from './door';
import type { Slice, SliceRef } from './slice';
import {
  getWasmWallSlicesView,
  newSliceView,
  freeSliceView,
  freeTranspSliceViewsList,
} from './slice';
import Renderer from './renderer';
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

// wall map codes use 16 bits, low 8 bits are the code, high 8 bits are the flags
const WALL_FLAGS_OFFSET = 8;
const WALL_CODE_MASK = (1 << WALL_FLAGS_OFFSET) - 1;

const WALL_FLAGS = {
  IS_TRANSP: 1 << WALL_FLAGS_OFFSET,
  IS_DOOR: 1 << (WALL_FLAGS_OFFSET + 1),
};

// two types of doors, use 1 bit mask for door type
const WALL_DOOR_TYPE_OFFSET = WALL_FLAGS_OFFSET + 2;
const WALL_DOOR_TYPE_MASK = 1 << WALL_DOOR_TYPE_OFFSET;
const WALL_DOOR_TYPE_SLIDE = 0 << WALL_DOOR_TYPE_OFFSET;
const WALL_DOOR_TYPE_SPLIT = 1 << WALL_DOOR_TYPE_OFFSET;

// #define DOOR_OPENING	0x80		/* On if door is currently opening */
// #define DOOR_CLOSING	0x40		/* On if door is currently closing */

const DOOR_FLAGS_STATUS_OFFSET = 0;
const DOOR_FLAGS_STATUS_MASK = 0 << DOOR_FLAGS_STATUS_OFFSET;
const DOOR_OPENING = 0 << DOOR_FLAGS_STATUS_OFFSET;
const DOOR_CLOSING = 1 << DOOR_FLAGS_STATUS_OFFSET;

const DOOR_FLAGS_AREA_STATUS_OFFSET = 1;
const DOOR_FLAGS_AREA_STATUS_MASK = 1 << DOOR_FLAGS_AREA_STATUS_OFFSET;
const DOOR_AREA_CLOSED_FLAG = 1 << DOOR_FLAGS_AREA_STATUS_OFFSET;

const MAX_DOOR_COL_OFFSET = 1.5;
const XDOOR_TYPE = 0;
const YDOOR_TYPE = 1;

const darkWallTexKeys: typeof WALL_TEX_KEYS = Object.entries(
  WALL_TEX_KEYS,
).reduce(
  (acc, [key, val]) => {
    const DARK_TEX_SUFFIX = '_D';
    acc[key as keyof typeof WALL_TEX_KEYS] = val + DARK_TEX_SUFFIX;
    return acc;
  },
  {} as typeof WALL_TEX_KEYS,
);

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

  private inputManager: InputManager;

  private lookUp: InputAction;
  private lookDown: InputAction;
  private moveForward: InputAction;
  private moveBackward: InputAction;
  private turnLeft: InputAction;
  private turnRight: InputAction;
  private raiseHeight: InputAction;
  private lowerHeight: InputAction;

  private mouseMoveLeft: InputAction;
  private mouseMoveRight: InputAction;
  private mouseMoveUp: InputAction;
  private mouseMoveDown: InputAction;

  private raycasterPtr: number;
  private borderWidthPtr: number;
  private borderColorPtr: number;
  private wallHeightPtr: number;
  private maxWallDistancePtr: number;
  private projYCenterPtr: number;
  private minWallTopPtr: number;
  private maxWallTopPtr: number;
  private minWallBottomPtr: number;
  private maxWallBottomPtr: number;
  private activeDoorsListPtrPtr: number;

  private viewport: Viewport;
  private player: Player;
  private sprites: Sprite[];

  private activeDoors: Door[];
  private numActiveDoors: number;

  private viewSprites: Sprite[];
  private numViewSprites: number;
  private viewSpritesSrcIdxs: number[];

  private wallSlices: Slice[];
  private wallZBuffer: Float32Array;

  private wallSlicesOccludedBySprites: Uint8Array;
  private spritesTop: number[];
  private spritesBottom: number[];

  private transpSlices: SliceRef[];
  private numTranspSlicesLists: number; // num of not empty transp slices lists in transpSlices array
  private transpSplicesListsXs: number[]; // x coords of transp slices lists
  private transpSlicesListsXsIdxs: number[]; // inv map of transpSplicesListsXs

  private texSlicePartialTranspMap: {
    [texIdx: number]: { [mipLvl: number]: Uint8Array };
  };
  private texSliceFullyTranspMap: {
    [texIdx: number]: { [mipLvl: number]: Uint8Array };
  };
  private texRowSliceFullyTranspMap: {
    [texIdx: number]: { [mipLvl: number]: Uint8Array };
  };

  private mapWidth: number;
  private mapHeight: number;

  private textures: Texture[];

  private xWallMap: Uint16Array;
  private yWallMap: Uint16Array;

  private xWallMapWidth: number;
  private xWallMapHeight: number;
  private yWallMapWidth: number;
  private yWallMapHeight: number;

  private floorMap: Uint8Array;

  private backgroundColor: number;

  private renderer: Renderer;

  // vars used in main raycasting loop
  private iStep = new Int32Array(2);
  private iSideDistX = new Float32Array(2);
  private iSideDistY = new Float32Array(2);
  private iCheckWallIdxOffsX = new Int32Array(2);
  private iCheckWallIdxOffsDoorX = new Int32Array(2);
  private iCheckWallIdxOffsY = new Int32Array(2);
  private iCheckWallIdxOffsDoorY = new Int32Array(2);
  private iCheckWallIdxOffsDivFactorY = new Int32Array(2);

  private pos = new Float32Array(2);
  private rayDir = new Float32Array(2);
  private sideDist = new Float32Array(2);
  private deltaDist = new Float32Array(2);
  private step = new Int32Array(2);
  private wallMapOffs = new Int32Array(2);
  private wallMapIncOffs = new Int32Array(3);
  private checkWallIdxOffs = new Int32Array(2);
  private checkWallIdxOffsDoor = new Int32Array(2);
  private checkWallIdxOffsDivFactor = new Int32Array(2);
  private curMapPos = new Int32Array(2);
  private wallMaps = new Array<Uint16Array>(2);
  private mapLimits = new Int32Array(2);
  private floorWall = new Float32Array(2);

  // private _2float: Float32Array;
  // private _1u32: Uint32Array;

  public async init(params: RaycasterParams, inputManager: InputManager) {
    this.initInput(inputManager);
    this.initGraphics(params);
  }

  public initGraphics(params: RaycasterParams) {
    this.wasmRun = params.wasmRun;
    this.wasmViews = this.wasmRun.WasmViews;
    this.wasmEngineModule = this.wasmRun.WasmModules.engine;
    this.frameColorRGBAWasm = params.frameColorRGBAWasm;
    this.raycasterPtr = this.wasmEngineModule.getRaycasterPtr();

    this.initPtrs();
    this.initData();
    this.initRenderer();

    this.renderer.renderBorders(this.BorderColor);
  }

  private initRenderer() {
    this.renderer = new Renderer(this, {
      isFloorTextured: true,
      vertFloor: false,
      back2Front: true,
    });
  }

  private mapKeytoInputAction(
    key: EnginePanelInputKeyCodeEnum,
    action: InputAction,
  ) {
    this.inputManager.mapToKey(key, action);
  }

  private initInput(inputManager: InputManager) {
    this.inputManager = inputManager;

    this.lookUp = new InputAction('LookUp', InputActionBehavior.NORMAL);
    this.mapKeytoInputAction(EnginePanelInputKeyCodeEnum.KEY_E, this.lookUp);

    this.lookDown = new InputAction('LookDown', InputActionBehavior.NORMAL);
    this.mapKeytoInputAction(EnginePanelInputKeyCodeEnum.KEY_C, this.lookDown);

    this.moveForward = new InputAction(
      'MoveForward',
      InputActionBehavior.NORMAL,
    );
    this.mapKeytoInputAction(
      EnginePanelInputKeyCodeEnum.KEY_W,
      this.moveForward,
    );

    this.moveBackward = new InputAction(
      'MoveBackward',
      InputActionBehavior.NORMAL,
    );
    this.mapKeytoInputAction(
      EnginePanelInputKeyCodeEnum.KEY_S,
      this.moveBackward,
    );

    this.turnLeft = new InputAction('TurnLeft', InputActionBehavior.NORMAL);
    this.mapKeytoInputAction(EnginePanelInputKeyCodeEnum.KEY_A, this.turnLeft);

    this.turnRight = new InputAction('TurnRight', InputActionBehavior.NORMAL);
    this.mapKeytoInputAction(EnginePanelInputKeyCodeEnum.KEY_D, this.turnRight);

    this.raiseHeight = new InputAction(
      'RaiseHeight',
      InputActionBehavior.NORMAL,
    );
    this.mapKeytoInputAction(
      EnginePanelInputKeyCodeEnum.KEY_Q,
      this.raiseHeight,
    );

    this.lowerHeight = new InputAction(
      'LowerHeight',
      InputActionBehavior.NORMAL,
    );
    this.mapKeytoInputAction(
      EnginePanelInputKeyCodeEnum.KEY_Z,
      this.lowerHeight,
    );
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
    this.initWallZBuffer();
    this.initWallSlices();
    this.initTranspSlices();

    this.backgroundColor = FrameColorRGBAWasm.colorRGBAtoABGR(0x000000ff);
    this.ProjYCenter = this.viewport.Height / 2;
    // this.wallHeight = this.cfg.canvas.height;
    this.WallHeight = this.viewport.Height; // TODO:

    this.initPlayer();
    this.initSprites();
    this.initDoors();
    this.initMap();
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

    this.activeDoorsListPtrPtr = this.wasmEngineModule.getActiveDoorsListPtr(
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

  private initDoors() {
    const { viewport, wasmEngineModule } = this;
    this.activeDoors = [];
  }

  private initSprites(): void {
    const { viewport, wasmEngineModule } = this;
    Sprite.SPRITE_HEIGHT_LIMIT = viewport.Height * 3;

    this.numViewSprites = 0;
    this.spritesTop = new Array<number>(viewport.Width);
    this.spritesBottom = new Array<number>(viewport.Width);

    const NUM_SPRITES = 8;
    // const NUM_SPRITES = 1; // 8

    wasmEngineModule.allocSpritesArr(this.raycasterPtr, NUM_SPRITES);
    this.sprites = getWasmSpritesView(this);
    if (this.sprites.length) {
      this.viewSprites = new Array<Sprite>(1 + this.sprites.length);
      this.viewSpritesSrcIdxs = new Array<number>(1 + this.sprites.length);

      // // test sprite
      // {
      //   const tex = this.findTex(wallTexKeys.PILLAR);
      //   assert(tex);
      //   const sprite = this.sprites[0];
      //   sprite.PosX = 7.5;
      //   sprite.PosY = 8.5;
      //   sprite.PosZ = 0; // this.WallHeight; // base, 0 is the floor lvl
      //   sprite.TexIdx = tex.WasmIdx; // use wasmIndx for sprites tex
      //   sprite.Visible = 1;
      // }

      // { // test near sprite rend
      //   // const tex = this.findTex(wallTexKeys.GREEN_LIGHT);
      //   // const tex = this.findTex(wallTexKeys.BARREL);
      //   const tex = this.findTex(WALL_TEX_KEYS.PLANT);
      //   assert(tex);
      //   const sprite = this.sprites[0];
      //   // sprite.PosX = 7.5;
      //   // sprite.PosY = 8.5;
      //   // sprite.PosX = 8.5;
      //   // sprite.PosY = 0.5;
      //   // sprite.PosX = 4.5;
      //   // sprite.PosY = 1.5;
      //   // sprite.PosX = 0.9;
      //   // sprite.PosY = 1.5;
      //   sprite.PosX = 0.5;
      //   sprite.PosY = 5.5;
      //   sprite.PosZ = 0; // this.WallHeight; // base, 0 is the floor lvl
      //   sprite.TexIdx = tex.WasmIdx; // use wasmIndx for sprites tex
      //   sprite.Visible = 1;
      // }

      {
        const tex = this.findTex(WALL_TEX_KEYS.PILLAR);
        assert(tex);
        const sprite = this.sprites[0];
        sprite.PosX = 4.5;
        sprite.PosY = 6.5;
        // sprite.PosX = 3.5;
        // sprite.PosY = 1.5;
        sprite.PosZ = 0; // this.WallHeight; // base, 0 is the floor lvl
        sprite.TexIdx = tex.WasmIdx; // use wasmIndx for sprites tex
        sprite.Visible = 1;
      }

      //
      {
        const tex = this.findTex(WALL_TEX_KEYS.PILLAR);
        assert(tex);
        const sprite = this.sprites[1];
        // sprite.PosX = 5.5;
        // sprite.PosY = 1.5;
        sprite.PosX = 8.5;
        sprite.PosY = 9.5;
        sprite.PosZ = 0; // this.WallHeight; // base, 0 is the floor lvl
        sprite.TexIdx = tex.WasmIdx; // use wasmIndx for sprites tex
        sprite.Visible = 1;
      }
      //
      {
        const tex = this.findTex(WALL_TEX_KEYS.BARREL);
        assert(tex);
        const sprite = this.sprites[2];
        sprite.PosX = 4.5;
        sprite.PosY = 2.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
      }

      {
        const tex = this.findTex(WALL_TEX_KEYS.PLANT);
        assert(tex);
        const sprite = this.sprites[3];
        sprite.PosX = 0.5;
        sprite.PosY = 6.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
      }

      {
        const tex = this.findTex(WALL_TEX_KEYS.PLANT);
        assert(tex);
        const sprite = this.sprites[4];
        sprite.PosX = 0.5;
        sprite.PosY = 4.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
      }

      {
        const tex = this.findTex(WALL_TEX_KEYS.GREEN_LIGHT);
        assert(tex);
        const sprite = this.sprites[5];
        sprite.PosX = 5.5;
        sprite.PosY = 1.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
      }

      {
        const tex = this.findTex(WALL_TEX_KEYS.PLANT);
        assert(tex);
        const sprite = this.sprites[6];
        sprite.PosX = 0.5;
        sprite.PosY = 2.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
      }

      {
        const tex = this.findTex(WALL_TEX_KEYS.PILLAR);
        assert(tex);
        const sprite = this.sprites[7];
        sprite.PosX = 8.5;
        sprite.PosY = 0.5;
        sprite.PosZ = 0; // this.WallHeight; // base, 0 is the floor lvl
        sprite.TexIdx = tex.WasmIdx; // use wasmIndx for sprites tex
        sprite.Visible = 1;
      }
    }
  }

  // private initBorderColor() {
  // }

  private initWallZBuffer() {
    const wallZBufferPtr = this.wasmEngineModule.allocWallZBuffer(
      this.raycasterPtr,
    );
    assert(this.viewport, 'viewport not initialized');
    this.wallZBuffer = new Float32Array(
      this.wasmRun.WasmMem.buffer,
      wallZBufferPtr,
      this.viewport.Width,
    );
  }

  private initWallSlices() {
    assert(this.viewport, 'viewport not initialized');
    this.wasmEngineModule.allocWallSlices(this.raycasterPtr);
    this.wallSlices = getWasmWallSlicesView(this.raycasterPtr);
    this.wallSlicesOccludedBySprites = new Uint8Array(this.wallSlices.length);
  }

  private initTranspSlices() {
    assert(this.viewport, 'viewport not initialized');
    this.wasmEngineModule.allocTranspSlices(this.raycasterPtr);
    this.transpSlices = new Array<SliceRef>(this.viewport.Width);
    this.transpSplicesListsXs = new Array<number>(this.viewport.Width);
    this.transpSlicesListsXsIdxs = new Array<number>(this.viewport.Width);
    this.resetTranspSlices();
  }

  private initTextures() {
    this.initTexturesViews();
    this.genDarkWallTextures();
    this.precTexIsTranspCols();
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

  // TODO:
  private genDarkWallTextures() {
    const wallTexKeysArr = Object.values(darkWallTexKeys);
    for (let i = 0; i < wallTexKeysArr.length; i++) {
      const darkTexKey = wallTexKeysArr[i];
      const darkTex = this.findTex(darkTexKey);
      if (darkTex) {
        darkTex.makeDarker();
      }
    }
  }

  private precTexIsTranspCols() {
    this.texSlicePartialTranspMap = {}; // [texIdx][mipLvl][texX] = 1 if texId,mipLvl has transp col at texX
    this.texSliceFullyTranspMap = {}; // [texIdx][mipLvl][texX] = 1 if texId,mipLvl has fully transp col at texX
    this.texRowSliceFullyTranspMap = {}; // [texIdx][mipLvl][texY] = 1 if texId,mipLvl has fully transp row at texY
    this.textures.forEach((tex) => {
      const mipLvl = 0; // TODO: loop through mip levels
      const mipmap = tex.getMipmap(mipLvl);
      const { Image: image } = mipmap;
      const { Width: texHeight, Height: texWidth } = image;
      const { WasmIdx: texIdx } = tex;
      this.texSlicePartialTranspMap[texIdx] = {};
      this.texSliceFullyTranspMap[texIdx] = {};
      this.texRowSliceFullyTranspMap[texIdx] = {};
      const isTranspSliceArr = (this.texSlicePartialTranspMap[texIdx][mipLvl] =
        new Uint8Array(texHeight));
      const isFullyTranspSliceArr = (this.texSliceFullyTranspMap[texIdx][
        mipLvl
      ] = new Uint8Array(texHeight));
      const isFullyTranspRowArr = (this.texRowSliceFullyTranspMap[texIdx][
        mipLvl
      ] = new Uint8Array(texWidth));
      for (let texX = 0; texX < texHeight; texX++) {
        isTranspSliceArr[texX] = this.isSlicePartiallyTransp(texX, image)
          ? 1
          : 0;
        isFullyTranspSliceArr[texX] = this.isSliceFullyTransp(texX, image)
          ? 1
          : 0;
      }
      for (let texY = 0; texY < texWidth; texY++) {
        isFullyTranspRowArr[texY] = this.isRowSliceFullyTransp(texY, image)
          ? 1
          : 0;
      }
    });
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
    const { wasmEngineModule } = this;

    this.xWallMapWidth = wasmEngineModule.getXWallMapWidth(this.raycasterPtr);
    this.xWallMapHeight = wasmEngineModule.getXWallMapHeight(this.raycasterPtr);

    this.yWallMapWidth = wasmEngineModule.getYWallMapWidth(this.raycasterPtr);
    this.yWallMapHeight = wasmEngineModule.getYWallMapHeight(this.raycasterPtr);

    const xMapPtr = wasmEngineModule.getXWallMapPtr(this.raycasterPtr);
    this.xWallMap = new Uint16Array(
      this.wasmRun.WasmMem.buffer,
      xMapPtr,
      this.xWallMapWidth * this.xWallMapHeight,
    );

    const yMapPtr = wasmEngineModule.getYWallMapPtr(this.raycasterPtr);
    this.yWallMap = new Uint16Array(
      this.wasmRun.WasmMem.buffer,
      yMapPtr,
      this.yWallMapWidth * this.yWallMapHeight,
    );

    {
      const tex = this.findTex(WALL_TEX_KEYS.GREYSTONE);
      assert(tex);
      for (let i = 0; i < this.xWallMapHeight; i++) {
        this.xWallMap[i * this.xWallMapWidth] = tex.WallMapIdx;
        this.xWallMap[i * this.xWallMapWidth + (this.xWallMapWidth - 1)] =
          tex.WallMapIdx;
      }
      // this.xWallMap[0] = 0; // test hole
    }

    {
      const tex = this.findTex(WALL_TEX_KEYS.GREYSTONE);
      assert(tex);
      this.xWallMap[4] = tex.WallMapIdx;
      this.xWallMap[4 + this.xWallMapWidth * 2] = tex.WallMapIdx;
    }

    {
      const tex = this.findTex(darkWallTexKeys.GREYSTONE);
      assert(tex);
      for (let i = 0; i < this.yWallMapWidth; i++) {
        this.yWallMap[i] = tex.WallMapIdx;
        this.yWallMap[i + (this.yWallMapHeight - 1) * this.yWallMapWidth] =
          tex.WallMapIdx;
      }
    }

    {
      const tex = this.findTex(darkWallTexKeys.REDBRICK);
      assert(tex);
      this.yWallMap[4 + this.yWallMapWidth * 2] = tex.WallMapIdx;
      this.yWallMap[5 + this.yWallMapWidth * 2] = tex.WallMapIdx;
    }

    // test doors
    {
      {
        // edge cases y door
        const tex = this.findTex(WALL_TEX_KEYS.REDBRICK);
        assert(tex);
        this.xWallMap[1 + this.xWallMapWidth * 0] = tex.WallMapIdx;

        const doorTex = this.findTex(WALL_TEX_KEYS.DOOR_0);
        assert(doorTex);
        // edge case door on y edge of map
        this.yWallMap[0 + this.yWallMapWidth * 0] =
          doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        this.yWallMap[0 + this.yWallMapWidth * 1] =
          doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;

        this.xWallMap[0] = 0; // test hole

        {
          // init an active door
          const door = this.newActiveDoor();
          door.Type = 1;
          door.Flags = 0;
          door.Mpos = 0 + this.yWallMapWidth * 0;
          door.Mpos1 = 0 + this.yWallMapWidth * 1;
          door.ColOffset = 0.4;
          door.Speed = 0.0;
          door.Mcode = doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
          door.Mcode1 = doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        }
      }

      {
        // y door
        const tex = this.findTex(WALL_TEX_KEYS.GREYSTONE);
        assert(tex);
        this.xWallMap[1 + this.xWallMapWidth * 3] = tex.WallMapIdx;
        this.xWallMap[2 + this.xWallMapWidth * 3] = tex.WallMapIdx;
        // this.yWallMap[0 + this.yWallMapWidth * 3] = tex.WallMapIdx;
        // this.yWallMap[2 + this.yWallMapWidth * 3] = tex.WallMapIdx;

        const doorTex = this.findTex(WALL_TEX_KEYS.DOOR_0);
        assert(doorTex);
        this.yWallMap[1 + this.yWallMapWidth * 3] =
          doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        this.yWallMap[1 + this.yWallMapWidth * 4] =
          doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;

        // {
        //   // init an active door
        //   const door = this.newActiveDoor();
        //   door.Type = 1;
        //   door.Mpos = 1 + this.yWallMapWidth * 3;
        //   door.Mpos1 = 1 + this.yWallMapWidth * 4;
        //   door.Mcode = this.yWallMap[1 + this.yWallMapWidth * 3];
        //   door.Mcode1 = this.yWallMap[1 + this.yWallMapWidth * 4];
        //   door.ColOffset = 0.1;
        //   // door.Speed = 0.001;
        //   door.Speed = 0.007;
        //   door.Flags = DOOR_OPENING | DOOR_AREA_CLOSED_FLAG;
        //   door.Mcode = doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        //   door.Mcode1 = doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        // }
      }

      {
        // x door
        const tex = this.findTex(WALL_TEX_KEYS.REDBRICK);
        assert(tex);
        this.yWallMap[2 + this.yWallMapWidth * 8] = tex.WallMapIdx;
        this.yWallMap[2 + this.yWallMapWidth * 9] = tex.WallMapIdx;

        const doorTex = this.findTex(WALL_TEX_KEYS.DOOR_0);
        assert(doorTex);
        this.xWallMap[2 + this.xWallMapWidth * 8] =
          doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        this.xWallMap[3 + this.xWallMapWidth * 8] =
          doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;

        {
          // init an active door
          const door = this.newActiveDoor();
          door.Type = 0;
          door.Flags = 0;
          door.Mpos = 2 + this.xWallMapWidth * 8;
          door.Mpos1 = 3 + this.yWallMapWidth * 8;
          door.ColOffset = 0.2;
          door.Speed = 0.0;
          door.Mcode = doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
          door.Mcode1 = doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        }
      }

      {
        // edge case x door
        const tex = this.findTex(WALL_TEX_KEYS.REDBRICK);
        assert(tex);
        this.yWallMap[0 + this.yWallMapWidth * (this.yWallMapHeight - 2)] =
          tex.WallMapIdx;

        const doorTex = this.findTex(WALL_TEX_KEYS.DOOR_0);
        assert(doorTex);
        this.xWallMap[1 + this.xWallMapWidth * (this.xWallMapHeight - 1)] =
          doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        // edge case: door on x edge of map
        this.xWallMap[0 + this.xWallMapWidth * (this.xWallMapHeight - 1)] =
          doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;

        this.yWallMap[0 + this.yWallMapWidth * (this.yWallMapHeight - 1)] = 0; // test hole

        // {
        //   // init an active door
        //   const door = this.newActiveDoor();
        //   door.Type = 0;
        //   door.Flags = 0;
        //   door.Mpos = 0 + this.xWallMapWidth * (this.xWallMapHeight - 1);
        //   door.Mpos1 = 1 + this.xWallMapWidth * (this.xWallMapHeight - 1);
        //   door.ColOffset = 0.4;
        //   door.Speed = 0.1;
        //   door.Mcode = doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        //   door.Mcode1 = doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
        // }
      }

      // hole with door code
      // this.xWallMap[0] = doorTex.WallMapIdx | WALL_FLAGS.IS_DOOR;
    } // end test doors

    // test transp wall
    {
      // const transpTex0 = this.findTex(wallTexKeys.TRANSP0);
      // const transpTex1 = this.findTex(wallTexKeys.TRANSP1);
      // this.xWallMap[0 * this.xWallMapWidth + 2] =
      //   transpTex1.WallMapIdx | WALL_FLAGS.TRANSP;
      // this.xWallMap[0 * this.xWallMapWidth + 3] =
      //   transpTex1.WallMapIdx | WALL_FLAGS.TRANSP;
      // this.xWallMap[4 * this.xWallMapWidth + 5] =
      //   transpTex0.WallMapIdx | WALL_FLAGS.TRANSP;
      // console.log(transpTex.WallMapIdx | WALL_FLAGS.TRANSP);
    }

    // this.yWallMap[2 + this.yWallMapWidth * 5] = this.findTex(darkWallTexKeys.TRANSP2).WallMapIdx | WALL_FLAGS.TRANSP;
    // this.xWallMap[2 + this.xWallMapWidth * 5] = this.findTex(wallTexKeys.TRANSP2).WallMapIdx | WALL_FLAGS.TRANSP;

    const darkTransp2 = this.findTex(darkWallTexKeys.TRANSP2);
    assert(darkTransp2);
    const transp2 = this.findTex(WALL_TEX_KEYS.TRANSP2);
    assert(transp2);
    this.yWallMap[3 + this.yWallMapWidth * 6] =
      darkTransp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.xWallMap[3 + this.xWallMapWidth * 6] =
      transp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.yWallMap[4 + this.yWallMapWidth * 6] =
      darkTransp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.xWallMap[4 + this.xWallMapWidth * 6] =
      transp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.yWallMap[5 + this.yWallMapWidth * 6] =
      darkTransp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.xWallMap[5 + this.xWallMapWidth * 6] =
      transp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.yWallMap[6 + this.yWallMapWidth * 6] =
      darkTransp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.xWallMap[6 + this.xWallMapWidth * 6] =
      transp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.yWallMap[7 + this.yWallMapWidth * 6] =
      darkTransp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.xWallMap[7 + this.xWallMapWidth * 6] =
      transp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.yWallMap[8 + this.yWallMapWidth * 6] =
      darkTransp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;
    this.xWallMap[8 + this.xWallMapWidth * 6] =
      transp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;

    this.yWallMap[6 + this.yWallMapWidth * 7] =
      darkTransp2.WallMapIdx | WALL_FLAGS.IS_TRANSP;

    const darkTransp0 = this.findTex(darkWallTexKeys.TRANSP0);
    assert(darkTransp0);
    this.yWallMap[8 + this.yWallMapWidth * 6] =
      darkTransp0.WallMapIdx | WALL_FLAGS.IS_TRANSP;
  }

  private initFloorMap() {
    const floorMapPtr = this.wasmEngineModule.getFloorMapPtr(this.raycasterPtr);

    this.floorMap = new Uint8Array(
      this.wasmRun.WasmMem.buffer,
      floorMapPtr,
      this.mapWidth * this.mapHeight,
    );

    let tex = this.findTex(FLOOR_TEX_KEYS.FLOOR0);
    assert(tex);

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        this.floorMap[y * this.mapWidth + x] = tex.WasmIdx;
      }
    }

    tex = this.findTex(FLOOR_TEX_KEYS.FLOOR1);
    assert(tex);
    this.floorMap[4 * this.mapWidth + 4] = tex.WasmIdx;
  }

  private preProcRender() {
    this.resetTranspSlices();
    this.resetSliceSpriteOcclusionArr();
    this.initActiveDoorsList();
  }

  private isSliceFullyTransp(texX: number, image: BitImageRGBA) {
    const { Buf32: mipPixels, Width: texWidth, Lg2Pitch: lg2Pitch } = image;

    const { transpColor } = Texture;

    // image is rotated 90ccw, col texX is the row at offset texX << lg2Pitch
    for (let y = 0, rowOffs = texX << lg2Pitch; y < texWidth; y++) {
      if (mipPixels[rowOffs + y] !== transpColor) {
        return false;
      }
    }

    return true;
  }

  private isRowSliceFullyTransp(texY: number, image: BitImageRGBA) {
    const {
      Buf32: mipPixels,
      // Width: texWidth,
      Height: texHeight,
      Lg2Pitch: lg2Pitch,
    } = image;

    const { transpColor } = Texture;

    // image is rotated 90ccw
    for (
      let x = 0, colOffs = texY;
      x < texHeight;
      x++, colOffs += 1 << lg2Pitch
    ) {
      if (mipPixels[colOffs] !== transpColor) {
        return false;
      }
    }

    return true;
  }

  private isSlicePartiallyTransp(texX: number, image: BitImageRGBA): boolean {
    const {
      Buf32: mipPixels,
      Width: texWidth,
      Height: texHeight,
      Lg2Pitch: lg2Pitch,
    } = image;

    const { transpColor } = Texture;

    // image is rotated 90ccw, col texX is the row at offset texX << lg2Pitch
    for (let y = 0, rowOffs = texX << lg2Pitch; y < texWidth; y++) {
      if (mipPixels[rowOffs + y] === transpColor) {
        return true;
      }
    }

    return false;
  }

  private findActiveDoor(side: number, mPos: number): DoorRef {
    const { activeDoors } = this;
    for (let i = 0; i < activeDoors.length; i++) {
      const door = activeDoors[i];
      if (door.Type === side && door.Mpos === mPos) {
        return door;
      }
    }
    return null;
  }

  private advanceRay(side: number, nextPos: number) {
    this.curMapPos[side] = nextPos;
    this.sideDist[side] += this.deltaDist[side];
    this.wallMapOffs[side] += this.wallMapIncOffs[side];
    this.wallMapOffs[side ^ 1] += this.wallMapIncOffs[side << 1];
  }

  private updateWallSlice(slice: Slice, side: number, wallTop: number, wallBottom: number, perpWallDist: number, clipTop: number) {
    slice.Side = side;
    slice.Top = wallTop;
    slice.Bottom = wallBottom;
    slice.Distance = perpWallDist;
    slice.ClipTop = clipTop;
    slice.IsSprite = false;
  }

  private calcNextPos(side: number, steps: number): number {
    return this.curMapPos[side] + this.step[side];
  }

  private isRayValid(side: number, nextPos: number, steps: number): boolean {
    return nextPos >= 0 && nextPos < this.mapLimits[side] && --steps > 0;
  }

  private calcWallsVis() {
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
      checkWallIdxOffsDoor,
      checkWallIdxOffsDivFactor,
      wallMapIncOffs,
      xWallMapWidth,
      yWallMapWidth,
      curMapPos,
      wallMapOffs,
      sideDist,
      wallZBuffer,
      floorWall,
      textures,
      wallSlices,
      WallHeight: wallHeight,
      iStep,
      iSideDistX,
      iSideDistY,
      iCheckWallIdxOffsX,
      iCheckWallIdxOffsDoorX,
      iCheckWallIdxOffsY,
      iCheckWallIdxOffsDoorY,
      iCheckWallIdxOffsDivFactorY,
      transpSplicesListsXs,
    } = this;

    assert(posX >= 0 && posX < mapWidth, 'posX out of map bounds');
    assert(posY >= 0 && posY < mapHeight, 'posY out of map bounds');

    const projYcenter = this.ProjYCenter;

    const mapX = posX | 0;
    const mapY = posY | 0;

    const cellX = posX - mapX;
    const cellY = posY - mapY;

    const wallMapOffsX = mapY * xWallMapWidth + posX;
    const wallMapOffsY = mapY * yWallMapWidth + posX;

    let maxWallDistance = 0;
    let minWallTop = projYcenter;
    let maxWallTop = -1;
    let minWallBottom = vpHeight;
    let maxWallBottom = projYcenter;

    const P = 0;
    const N = 1;

    iStep[N] = -1;
    iStep[P] = 1;
    iSideDistX[N] = cellX;
    iSideDistX[P] = 1.0 - cellX;
    iSideDistY[N] = cellY;
    iSideDistY[P] = 1.0 - cellY;
    iCheckWallIdxOffsX[N] = 0;
    iCheckWallIdxOffsX[P] = 1;
    iCheckWallIdxOffsY[N] = 0;
    iCheckWallIdxOffsY[P] = yWallMapWidth;
    iCheckWallIdxOffsDoorX[N] = -1;
    iCheckWallIdxOffsDoorX[P] = 0;
    iCheckWallIdxOffsDoorY[N] = -yWallMapWidth;
    iCheckWallIdxOffsDoorY[P] = 0;
    iCheckWallIdxOffsDivFactorY[N] = 1;
    iCheckWallIdxOffsDivFactorY[P] = yWallMapWidth;

    const X = 0;
    const Y = 1;

    pos[X] = posX;
    pos[Y] = posY;
    wallMaps[X] = xMap;
    wallMaps[Y] = yMap;
    mapLimits[X] = mapWidth;
    mapLimits[Y] = mapHeight;

    const MAX_RAY_STEPS = 100; // TODO:

    for (let x = 0; x < vpWidth; x++) {
      const cameraX = (2 * x) / vpWidth - 1;

      rayDir[X] = dirX + planeX * cameraX;
      rayDir[Y] = dirY + planeY * cameraX;

      const sX = rayDir[X] < 0 ? N : P;
      const sY = rayDir[Y] < 0 ? N : P;

      step[X] = iStep[sX];
      deltaDist[X] = iStep[sX] / rayDir[X];
      sideDist[X] = iSideDistX[sX] * deltaDist[X];
      checkWallIdxOffs[X] = iCheckWallIdxOffsX[sX];
      checkWallIdxOffsDoor[X] = iCheckWallIdxOffsDoorX[sX];
      checkWallIdxOffsDivFactor[X] = 1;

      step[Y] = iStep[sY];
      deltaDist[Y] = iStep[sY] / rayDir[Y];
      sideDist[Y] = iSideDistY[sY] * deltaDist[Y];
      checkWallIdxOffs[Y] = iCheckWallIdxOffsY[sY];
      checkWallIdxOffsDoor[Y] = iCheckWallIdxOffsDoorY[sY];
      checkWallIdxOffsDivFactor[Y] = iCheckWallIdxOffsDivFactorY[sY];

      curMapPos[X] = mapX;
      curMapPos[Y] = mapY;
      wallMapOffs[X] = wallMapOffsX;
      wallMapOffs[Y] = wallMapOffsY;

      wallMapIncOffs[0] = step[X];
      wallMapIncOffs[1] = step[Y] * yWallMapWidth;
      wallMapIncOffs[2] = step[Y] * xWallMapWidth;

      const wallSlice = wallSlices[x];
      wallSlice.Hit = 0;

      let side: number;
      // let nextPos: number;
      let steps = MAX_RAY_STEPS;

      for (;;) {
        // side = sideDist[X] < sideDist[Y] ? X : Y;
        side = Number(sideDist[X] > sideDist[Y]);
        const checkWallIdx = wallMapOffs[side] + checkWallIdxOffs[side];
        const wallCode = wallMaps[side][checkWallIdx];
        let isRayValid = true;
        if (!(wallCode & WALL_CODE_MASK)) {
          const nextPos = this.calcNextPos(side, steps);
          isRayValid = this.isRayValid(side, nextPos, steps);
          if (isRayValid) {
            this.advanceRay(side, nextPos);
            continue;
          }
        }

        let perpWallDist = sideDist[side];
        let wallX = pos[side ^ 1] + perpWallDist * rayDir[side ^ 1];
        let iWallX = wallX | 0;
        let fWallX = wallX - iWallX;

        let texIdx: number;
        let mipLvl: number;
        let mipmap: Mipmap;
        let image: BitImageRGBA;
        let texWidth: number
        let texHeight: number;

        if (isRayValid) {
          texIdx = (wallCode & WALL_CODE_MASK) - 1;
          // assert(texIdx >= 0 && texIdx < this.textures.length, 'invalid texIdx');

          // mipmap is rotated 90ccw
          mipLvl = 0;
          mipmap = textures[texIdx].getMipmap(mipLvl);
          image = mipmap.Image;
          texWidth = image.Width;
          texHeight = image.Height;
        }

        if (wallCode & WALL_FLAGS.IS_DOOR) {
          // first check if the door in on the map edge (should not happen, if it's the case render as wall with Hit 0)
          const nextPos = this.calcNextPos(side, steps);
          isRayValid = this.isRayValid(side, nextPos, steps);
          if (isRayValid) {
            const halfDist = deltaDist[side] * 0.5;
            const nextfWallx = fWallX + halfDist * rayDir[side ^ 1];
            if (nextfWallx < 0 || nextfWallx >= 1) {
              this.advanceRay(side, nextPos);
              continue;
            } else {
              fWallX = nextfWallx;
              // assert(fWallX >= 0 && fWallX < 1, `invalid door fWallX ${fWallX}`)
              perpWallDist += halfDist;
              const mPos = checkWallIdx + checkWallIdxOffsDoor[side];
              const activeDoor = this.findActiveDoor(side, mPos);
              if (activeDoor) {
                const wallDoorType = wallCode & WALL_DOOR_TYPE_MASK;
                if (wallDoorType === WALL_DOOR_TYPE_SLIDE) {
                  const doorOffsX = activeDoor.ColOffset;
                  // assert(doorOffsX >= 0 && doorOffsX < 1, 'invalid doorOffsX here');
                  // check door open at ColOffset
                  fWallX += doorOffsX;
                  if (fWallX >= 1) {
                    this.advanceRay(side, nextPos);
                    if (sideDist[side] > sideDist[side ^ 1]) {
                      continue;
                    } else {
                      // if next int is of the same side advance 1 more time
                      const nextPos = this.calcNextPos(side, steps);
                      isRayValid = this.isRayValid(side, nextPos, steps);
                      if (isRayValid) {
                        this.advanceRay(side, nextPos);
                        continue;
                      } else {
                        // out of map, adjust dist to show not hit wall
                        perpWallDist += halfDist;
                      }
                    }
                  }
                } else {
                  // TODO: split door type
                }
              }
            }
          }
        }

        const ratio = 1 / perpWallDist;
        const wallSliceProjHeight = (wallHeight * ratio) | 0;
        const srcWallBottom = (projYcenter + posZ * ratio) | 0;
        const srcWallTop = srcWallBottom - wallSliceProjHeight + 1;
        // const sliceHeight = srcWallBottom - srcWallTop + 1;
        const clipTop = srcWallTop < 0 ? -srcWallTop : 0; // Math.max(0, -srcWallTop);
        const wallTop = srcWallTop + clipTop; // Math.max(0, srcWallTop);
        const wallBottom = srcWallBottom < vpHeight ? srcWallBottom : vpHeight - 1; // Math.min(srcWallBottom, vpHeight - 1);
        // assert(wallTop <= wallBottom, `invalid top ${wallTop} and bottom`); // <= ?

        if (isRayValid) {
          // assert(fWallX >= 0 && fWallX < 1, `invalid fWallX ${fWallX}`);
          const srcTexX = (fWallX * texHeight!) | 0;
          // const flipTexX = side === 0 ? rayDir[X] > 0 : rayDir[Y] < 0;
          // const texX = flipTexX ? texWidth - srcTexX - 1 : srcTexX;
          // const texX = texWidth - srcTexX - 1;
          const texX = srcTexX!;
          // assert(texX >= 0 && texX < texWidth, `invalid texX ${texX}`);

          const isTranspWall = (wallCode & WALL_FLAGS.IS_TRANSP) && this.texSlicePartialTranspMap[texIdx!][mipLvl!][texX];

          const slice = isTranspWall ? this.newWallTranspSlice(x) : wallSlice;

          const texStepY = texHeight! / wallSliceProjHeight;
          const texY = clipTop * texStepY;

          slice.TexX = texX;
          slice.TexY = texY;
          slice.TexStepY = texStepY;
          slice.Image = image!; // used in render ts
          slice.MipMapIdx = mipmap!.WasmIdx; // used in render wasm

          if (isTranspWall) {
            this.updateWallSlice(slice, side, wallTop, wallBottom, perpWallDist, clipTop);
            const nextPos = curMapPos[side] + step[side];
            isRayValid = this.isRayValid(side, nextPos, steps);
            if (isRayValid) {
              this.advanceRay(side, nextPos);
              continue;
            }
          }
        }

        // solid wall or map edge/max steps reached
        wallZBuffer[x] = perpWallDist;
        wallSlice.Hit = isRayValid ? 1 : 0;

        this.updateWallSlice(wallSlice, side, wallTop, wallBottom, perpWallDist, clipTop);

        if (this.IsFloorVertTextured) {
          floorWall[side ^ 1] = curMapPos[side ^ 1] + fWallX;
          const floorWallXOffs =
            checkWallIdxOffs[side] / checkWallIdxOffsDivFactor[side];
          floorWall[side] = curMapPos[side] + floorWallXOffs;
          [wallSlice.FloorWallX, wallSlice.FloorWallY] = floorWall;
        }

        if (perpWallDist > maxWallDistance) {
          maxWallDistance = perpWallDist;
        }
        if (wallTop < minWallTop) {
          minWallTop = wallTop;
        }
        if (wallTop > maxWallTop) {
          maxWallTop = wallTop;
        }
        if (wallBottom < minWallBottom) {
          minWallBottom = wallBottom;
        }
        if (wallBottom > maxWallBottom) {
          maxWallBottom = wallBottom;
        }

        break; // ray done
      }
    }

    this.MaxWallDistance = maxWallDistance;
    this.MinWallTop = minWallTop;
    this.MaxWallTop = maxWallTop;
    this.MinWallBottom = minWallBottom;
    this.MaxWallBottom = maxWallBottom;
  }

  public render(frameCnt: number) {
    this.preProcRender();
    this.calcWallsVis();
    this.processSprites();
    this.renderer.render(frameCnt);
    this.postProcRender();
  }

  private postProcRender() {
    this.freeTranspSlices();
  }

  private occludeWallSlice(
    startY: number,
    endY: number,
    tY: number,
    x: number,
  ) {
    this.wallSlicesOccludedBySprites[x] = 1;
    this.spritesTop[x] = startY;
    this.spritesBottom[x] = endY;
    this.wallZBuffer[x] = tY;
    this.MinWallTop = Math.min(this.MinWallTop, startY);
    this.MaxWallBottom = Math.max(this.MaxWallBottom, endY);
  }

  private resetSliceSpriteOcclusionArr() {
    this.wallSlicesOccludedBySprites.fill(0);
    // this.spritesTop.fill(0);
    // this.spritesBottom.fill(0);
  }

  private processSprites(): void {
    const {
      sprites,
      player,
      WallHeight,
      wallZBuffer,
      viewSprites,
      viewSpritesSrcIdxs,
      textures,
      ProjYCenter: projYCenter,
      transpSlices,
    } = this;
    const { PosX: playerX, PosY: playerY, PosZ: playerZ } = player;
    const { DirX: playerDirX, DirY: playerDirY } = player;
    const { PlaneX: playerPlaneX, PlaneY: playerPlaneY } = player;
    const { Width: vpWidth, Height: vpHeight } = this.viewport;

    const minDist = MIN_SPRITE_DIST;
    const maxDist = Math.min(this.MaxWallDistance, MAX_SPRITE_DIST);

    let numViewSprites = 0;

    for (let i = 0; i < sprites.length; i++) {
      const sprite = sprites[i];
      sprite.SrcIdx = i;

      if (!sprite.Visible) {
        continue;
      }

      const spriteX = sprite.PosX - playerX;
      const spriteY = sprite.PosY - playerY;

      const invDet =
        1.0 / (playerPlaneX * playerDirY - playerDirX * playerPlaneY);
      const tY = invDet * (-playerPlaneY * spriteX + playerPlaneX * spriteY);
      // tY is the straight distance from the player position to the sprite

      if (tY < minDist || tY > maxDist) {
        // console.log('tY behind or too far'); // behind or occluded by max (wall) distance
        continue;
      }

      const tX = invDet * (playerDirY * spriteX - playerDirX * spriteY);
      const invTy = 1.0 / tY;
      // assert(invTy > 0, 'invalid invTy');

      const spriteHeight = (WallHeight * invTy) | 0;

      if (spriteHeight <= 0) {
        // console.log('spriteHeight <= 0');
        continue;
      }

      // too big
      if (spriteHeight > Sprite.SPRITE_HEIGHT_LIMIT) {
        continue;
      }

      const spriteWidth = spriteHeight; // sprites are squared

      const spriteScreenX = ((vpWidth / 2) * (1 + tX * invTy)) | 0;
      let startX = spriteScreenX - (spriteWidth >> 1);

      if (startX >= vpWidth) {
        continue;
      }

      let endX = startX + spriteWidth - 1;

      if (endX < 0) {
        continue;
      }

      // clip startX
      const clipX = Math.max(0, -startX);
      startX += clipX;

      // clip endX
      endX = Math.min(endX, vpWidth - 1);

      // sprite cols in [startX, endX]

      const dy = (playerZ - sprite.PosZ) * invTy;
      let srcEndY = (projYCenter + dy) | 0;

      if (srcEndY < 0) {
        continue;
      }

      let srcStartY = srcEndY - spriteHeight + 1;

      if (srcStartY >= vpHeight) {
        continue;
      }

      // vertical clip
      const clipY = Math.max(0, -srcStartY);
      const startY = srcStartY + clipY;
      const endY = Math.min(srcEndY, vpHeight - 1);
      // assert(startY <= endY, `invalid startY ${startY} and endY ${endY}`);

      // sprite rows in [startY, endY]
      // sprite cols in [startX, endX]

      // sprite tex img is rotated 90ccw
      const texIdx = sprite.TexIdx;
      const tex = textures[texIdx];
      const mipLvl = 0; // TODO:
      const mipmap = tex.getMipmap(mipLvl);
      const { Image: image } = mipmap;
      const { Width: texWidth, Height: texHeight, Lg2Pitch: lg2Pitch } = image;

      const texStepY = texWidth / spriteHeight;
      const texY = clipY * texStepY;

      const srcTexStepX = texHeight / spriteWidth;
      const srcTexX = clipX * srcTexStepX;

      const texStepX = -srcTexStepX;
      const texX = texHeight - (srcTexX | 0) - 1;

      // occlusion test with walls and slice gen with cols with transp walls
      let sliceTexX = texX;

      const isTranspSliceArr = this.texSlicePartialTranspMap[texIdx][mipLvl];
      const isFullyTranspSliceArr = this.texSliceFullyTranspMap[texIdx][mipLvl];

      const {
        RenderXs: renderXs,
        TexXOffsets: texXOffsets,
        RenderBatchXs: renderBatchXs,
        RenderBatchTexXOffsets: renderBatchTexXOffsets,
        RenderBatchXLens: renderBatchXLens,
      } = sprite;
      sprite.NumRenderXs = 0;
      sprite.NumRenderBatchXs = 0;
      sprite.IsMagnified = texWidth < spriteWidth;

      for (let x = startX; x <= endX; x++, sliceTexX += texStepX) {
        const iTexX = sliceTexX | 0;
        if (isFullyTranspSliceArr[iTexX]) {
          continue;
        }
        if (!transpSlices[x]) {
          if (tY <= wallZBuffer[x]) {
            const texXOffset = iTexX << lg2Pitch;
            if (sprite.IsMagnified) {
              // when sprite is magnified, precalc batch x offsets and render by cols/rows batches
              if (
                sprite.NumRenderBatchXs === 0 ||
                texXOffset !==
                  renderBatchTexXOffsets[sprite.NumRenderBatchXs - 1] ||
                x !==
                  renderBatchXs[sprite.NumRenderBatchXs - 1] +
                    renderBatchXLens[sprite.NumRenderBatchXs - 1]
              ) {
                // start new batch
                renderBatchXs[sprite.NumRenderBatchXs] = x;
                renderBatchTexXOffsets[sprite.NumRenderBatchXs] = texXOffset;
                renderBatchXLens[sprite.NumRenderBatchXs] = 1;
                sprite.NumRenderBatchXs++;
              } else {
                // extend last batch
                renderBatchXLens[sprite.NumRenderBatchXs - 1]++;
              }
            } else {
              renderXs[sprite.NumRenderXs] = x;
              texXOffsets[sprite.NumRenderXs] = texXOffset;
              sprite.NumRenderXs++;
            }
            if (!isTranspSliceArr[iTexX]) {
              // sprite slice fully opaque
              this.occludeWallSlice(startY, endY, tY, x);
              continue;
            }
          }
        } else {
          // insert in correct decreasing distance order in circular doubly linked list transpSlices[x]
          let firstPtr = transpSlices[x] as Slice;
          let curPtr = firstPtr;
          let slice = null;

          if (tY >= firstPtr.Distance && tY > wallZBuffer[x]) {
            // sprite slice is the farthest and is occuluded by the wall slice at x
            continue;
          }

          let insertLast = false;

          // search insert position for the sprite slice
          while (tY < curPtr.Distance) {
            curPtr = curPtr.Next as Slice;
            if (curPtr === firstPtr) {
              insertLast = true;
              break;
            }
          }

          slice = newSliceView();
          // assert(slice);

          slice.Side = 0;
          slice.Distance = tY;
          slice.ClipTop = clipY;
          slice.TexX = sliceTexX;
          slice.Top = startY;
          slice.Bottom = endY;
          slice.TexY = texY;
          slice.TexStepY = texStepY;
          slice.Image = image;
          slice.MipMapIdx = mipmap.WasmIdx;
          slice.IsSprite = true;

          // insert before curPtr
          slice.Prev = curPtr.Prev;
          curPtr.Prev = slice;
          slice.Next = curPtr;
          (slice.Prev as Slice).Next = slice;

          if (curPtr === firstPtr && !insertLast) {
            this.updateTranspSliceArrayIdx(x, slice);
            firstPtr = slice;
          }

          if (!isTranspSliceArr[iTexX]) {
            // sprite slice fully opaque
            this.occludeWallSlice(startY, endY, tY, x);
            // remove transp slices behind it (so in front in the transp list)
            if (insertLast) {
              // sprite slice at the end of the list, it is the nearest slice, remove the entire transp list
              freeTranspSliceViewsList(firstPtr);
              this.updateTranspSliceArrayIdx(x, null);
              const texXOffset = iTexX << lg2Pitch;
              if (sprite.IsMagnified) {
                if (
                  sprite.NumRenderBatchXs === 0 ||
                  texXOffset !==
                    renderBatchTexXOffsets[sprite.NumRenderBatchXs - 1] ||
                  x !==
                    renderBatchXs[sprite.NumRenderBatchXs - 1] +
                      renderBatchXLens[sprite.NumRenderBatchXs - 1]
                ) {
                  // start new batch
                  renderBatchXs[sprite.NumRenderBatchXs] = x;
                  renderBatchTexXOffsets[sprite.NumRenderBatchXs] = texXOffset;
                  renderBatchXLens[sprite.NumRenderBatchXs] = 1;
                  sprite.NumRenderBatchXs++;
                } else {
                  // extend last batch
                  renderBatchXLens[sprite.NumRenderBatchXs - 1]++;
                }
              } else {
                renderXs[sprite.NumRenderXs] = x;
                texXOffsets[sprite.NumRenderXs] = texXOffset;
                sprite.NumRenderXs++;
              }
            } else if (slice !== firstPtr) {
              // remove the transp slices behind the sprite slice
              curPtr = firstPtr;
              while (curPtr !== slice) {
                const nextPtr = curPtr.Next as Slice;
                freeSliceView(curPtr);
                curPtr = nextPtr;
              }
              slice.Prev = firstPtr.Prev;
              (slice.Prev as Slice).Next = slice;
              this.updateTranspSliceArrayIdx(x, slice);
              // firstPtr = slice;
            }
          }
        }
      }

      if (sprite.NumRenderXs === 0 && sprite.NumRenderBatchXs === 0) {
        // sprite removed from the sorting list
        // if it has cols shared with transp walls slices it will be rendered later with them
        continue;
      }

      sprite.MipLevel = mipLvl;
      sprite.Image = image;
      sprite.Distance = tY;
      sprite.StartX = startX;
      sprite.EndX = endX;
      sprite.TexX = texX;
      sprite.TexStepX = texStepX;
      sprite.StartY = startY;
      sprite.EndY = endY;
      sprite.TexY = texY;
      sprite.TexStepY = texStepY;

      // precalc y offsets (used for each col)
      const { TexYOffsets: texYOffsets } = sprite;

      if (sprite.IsMagnified) {
        // when minified to precalc y offsets if you render by cols (not done now)
        for (
          let y = startY, curTexY = texY;
          y <= endY;
          y++, curTexY += texStepY
        ) {
          texYOffsets[y] = curTexY;
        }
      }

      // insertion sort on viewSprites[1...numViewSprites] on increasing distance
      let j = numViewSprites;
      viewSprites[0] = sprite; // sentinel at 0
      const spriteDist = sprite.Distance; // get float dist value
      for (; viewSprites[j].Distance > spriteDist; j--) {
        viewSprites[j + 1] = viewSprites[j];
      }
      viewSprites[j + 1] = sprite;
      // viewSprites[1...numViewSprites] is sorted on increasing distance

      viewSpritesSrcIdxs[numViewSprites] = sprite.SrcIdx;
      numViewSprites++;
      // viewSpritesSrcIdxs[0...numViewSprites-1] contains the src idxs (wrt to sprites arr) of the sprites in viewSprites[1...numViewSprites]
    }

    // remap view sprites in sprites array with their sorted order by increasing distance
    // so nearest sprites updates wallZBuffer and occludes wall slices/sprites behind them
    for (let i = 0; i < numViewSprites; i++) {
      const srcIdx = viewSpritesSrcIdxs[i];
      sprites[srcIdx] = viewSprites[i + 1];
    }

    this.numViewSprites = numViewSprites;
  }

  private updateTranspSliceArrayIdx(idx: number, newSlice: SliceRef) {
    if (!newSlice && this.transpSlices[idx]) {
      this.numTranspSlicesLists--;
      const listXsPos = this.transpSlicesListsXsIdxs[idx];
      if (listXsPos !== this.numTranspSlicesLists) {
        this.transpSplicesListsXs[listXsPos] =
          this.transpSplicesListsXs[this.numTranspSlicesLists];
        this.transpSlicesListsXsIdxs[this.transpSplicesListsXs[listXsPos]] =
          listXsPos;
      }
    }
    this.transpSlices[idx] = newSlice;
    // set ptr to first slice in transp wall slice array in wasm mem
    this.wasmEngineModule.setTranspSliceAtIdx(
      this.raycasterPtr,
      idx,
      newSlice ? newSlice.WasmPtr : WASM_NULL_PTR,
    );
  }

  private newWallTranspSlice(idx: number): Slice {
    const newSlice = newSliceView();
    this.addTranspSliceAtFront(newSlice, idx);
    return newSlice;
  }

  private addTranspSliceAtFront(newSlice: Slice, idx: number) {
    // insert at front in circular doubly linked list transpSlices[idx]
    if (this.transpSlices[idx]) {
      const frontSlice = this.transpSlices[idx] as Slice;
      newSlice.Prev = frontSlice.Prev;
      frontSlice.Prev = newSlice;
      newSlice.Next = frontSlice;
      // assert(newSlice.Prev !== WASM_NULL_PTR, 'invalid prev slice');
      (newSlice.Prev as Slice).Next = newSlice;
    } else {
      this.transpSplicesListsXs[this.numTranspSlicesLists] = idx;
      this.transpSlicesListsXsIdxs[idx] = this.numTranspSlicesLists;
      this.numTranspSlicesLists++;
      newSlice.Prev = newSlice.Next = newSlice;
    }
    this.updateTranspSliceArrayIdx(idx, newSlice);
    return newSlice;
  }

  private resetTranspSlices() {
    this.numTranspSlicesLists = 0;
    this.wasmEngineModule.resetTranspSlicesPtrs(this.raycasterPtr);
    for (let i = 0, { transpSlices } = this, { length } = transpSlices; i < length; i++) {
      transpSlices[i] = null;
    }
  }

  private freeTranspSlices() {
    if (this.numTranspSlicesLists) {
      for (let i = 0, { transpSlices } = this, { length } = transpSlices; i < length; i++) {
        if (transpSlices[i]) {
          freeTranspSliceViewsList(transpSlices[i] as Slice);
        }
      }
    }
  }

  private get IsFloorVertTextured(): boolean {
    return this.renderer.IsFloorTextured && this.renderer.VertFloor;
  }

  public update(time: number) {
    this.updatePlayer(time);
    this.updateDoors();
  }

  private get ActiveDoorsListPtr(): number {
    return this.wasmRun.WasmViews.view.getUint32(
      this.activeDoorsListPtrPtr,
      true,
    );
  }

  private set ActiveDoorsListPtr(ptr: number) {
    this.wasmRun.WasmViews.view.setUint32(
      this.activeDoorsListPtrPtr,
      ptr,
      true,
    );
  }

  private initActiveDoorsList(): void {
    this.activeDoors.length = 0;
    let wasmDoorPtr = this.ActiveDoorsListPtr;
    while (wasmDoorPtr !== WASM_NULL_PTR) {
      const curDoor = getDoorView(wasmDoorPtr);
      this.activeDoors.push(curDoor);
      wasmDoorPtr = curDoor.Next ? curDoor.Next.WasmPtr : WASM_NULL_PTR;
    }
  }

  private updateDoors() {
    // const { player } = this;
    // const { PosX: playerX, PosY: playerY } = player;
    // const mapX = playerX | 0;
    // const mapY = playerY | 0;
    // const mapOffs = mapY * map.Width + mapX;
    this.activateDoors();
    this.updateActiveDoors();
  }

  private activateDoors() {
    // TODO:
    // use newActiveDoor
  }

  private newActiveDoor(): Door {
    // insert new door at front, doubly linked list, not circular
    const newDoor = newDoorView();
    newDoor.Prev = newDoor.Next = null;
    const doorListPtr = this.ActiveDoorsListPtr;
    if (doorListPtr !== WASM_NULL_PTR) {
      const doorList = getDoorView(doorListPtr);
      newDoor.Next = doorList;
      doorList.Prev = newDoor;
    }
    this.ActiveDoorsListPtr = newDoor.WasmPtr;
    return newDoor;
  }

  private freeDoor(door: Door) {
    // remove door from doubly linked list
    const prevDoor = door.Prev;
    const nextDoor = door.Next;
    if (prevDoor) {
      prevDoor.Next = nextDoor;
    }
    if (nextDoor) {
      nextDoor.Prev = prevDoor;
    }
    if (door.WasmPtr === this.ActiveDoorsListPtr) {
      this.ActiveDoorsListPtr = nextDoor ? nextDoor.WasmPtr : WASM_NULL_PTR;
    }
    freeDoorView(door);
  }

  private updateActiveDoors() {
    this.initActiveDoorsList();
    const { activeDoors, wallMaps, xWallMap, yWallMap, player } = this;
    wallMaps[0] = xWallMap;
    wallMaps[1] = yWallMap;
    for (let door of activeDoors) {
      const { ColOffset: srcOffset } = door;
      door.ColOffset += door.Speed;
      if (door.ColOffset >= 1) {
        if (door.Flags & DOOR_AREA_CLOSED_FLAG) {
          const wallMap = wallMaps[door.Type];
          wallMap[door.Mpos] = wallMap[door.Mpos1] = 0;
          door.Flags &= ~DOOR_AREA_CLOSED_FLAG;
        } else {
          if (door.ColOffset >= MAX_DOOR_COL_OFFSET) {
            door.Speed = -door.Speed;
          }
        }
      } else {
        // colOffset < 1
        if (door.Speed < 0) {
          if (door.Flags & DOOR_AREA_CLOSED_FLAG) {
            if (door.ColOffset <= 0) {
              this.freeDoor(door);
              continue;
              // // to test opening <-> closing
              // door.ColOffset = 0;
              // door.Speed = -door.Speed;
            }
          } else {
            const { PosX: posX, PosY: posY } = player;
            const pMpos =
              (posX | 0) +
              (posY | 0) *
                (door.Type ? this.yWallMapWidth : this.xWallMapWidth);
            if (pMpos !== door.Mpos) {
              // close the area
              const wallMap = wallMaps[door.Type];
              wallMap[door.Mpos] = door.Mcode;
              wallMap[door.Mpos1] = door.Mcode1;
              door.Flags |= DOOR_AREA_CLOSED_FLAG;
            } else {
              // player is in the door cell pos, undo door movement
              door.ColOffset = srcOffset;
            }
          }
        }
      }
      // if (door.Flags & DOOR_AREA_CLOSED_FLAG) {
      //   if (door.ColOffset >= 1) {
      //     const wallMap = wallMaps[door.Type];
      //     wallMap[door.Mpos] = wallMap[door.Mpos1] = 0;
      //     door.Flags &= ~DOOR_AREA_CLOSED_FLAG;
      //     if (door.ColOffset >= 5) { // TODO:
      //       door.Speed = -door.Speed;
      //     }
      //   }
    }
  }

  private updatePlayer(time: number) {
    const LOOKUP_OFFS = 15 * time;

    if (this.lookUp.isPressed()) {
      const yCenter = this.ProjYCenter + LOOKUP_OFFS;
      this.ProjYCenter = Math.min(yCenter, (this.viewport.Height * 2) / 3);
    }

    if (this.lookDown.isPressed()) {
      const yCenter = this.ProjYCenter - LOOKUP_OFFS;
      this.ProjYCenter = Math.max(yCenter, this.viewport.Height / 3);
    }

    const MOVE_SPEED = 0.01; // 0.009; // TODO:
    const ROT_SPEED = 0.006; // TODO:
    const moveSpeed = time * MOVE_SPEED;
    const rotSpeed = time * ROT_SPEED;

    if (this.moveForward.isPressed()) {
      this.movePlayer(moveSpeed);
    }
    if (this.moveBackward.isPressed()) {
      this.movePlayer(-moveSpeed);
    }
    if (this.turnLeft.isPressed()) {
      this.rotatePlayer(-rotSpeed);
    }
    if (this.turnRight.isPressed()) {
      this.rotatePlayer(rotSpeed);
    }
    if (this.raiseHeight.isPressed()) {
      this.increasePlayerHeight(1);
    }
    if (this.lowerHeight.isPressed()) {
      this.increasePlayerHeight(-1);
    }
  }

  private increasePlayerHeight(d: number) {
    let height = this.player.PosZ + d * 10;
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
    this.wasmRun.WasmViews.view.setInt32(this.projYCenterPtr, val | 0, true);
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

  get ViewSprites(): Sprite[] {
    return this.viewSprites;
  }

  get NumViewSprites(): number {
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

  get NumTranspSlicesLists() {
    return this.numTranspSlicesLists;
  }

  get TranspSlices() {
    return this.transpSlices;
  }

  get WallZBuffer() {
    return this.wallZBuffer;
  }

  get WallSlicesOccludedBySprites() {
    return this.wallSlicesOccludedBySprites;
  }

  get SpritesTop() {
    return this.spritesTop;
  }

  get SpritesBottom() {
    return this.spritesBottom;
  }

  get TranspSplicesListsXs() {
    return this.transpSplicesListsXs;
  }

  get TexRowSliceFullyTranspMap() {
    return this.texRowSliceFullyTranspMap;
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
