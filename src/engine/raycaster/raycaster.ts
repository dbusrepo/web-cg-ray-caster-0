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
import { Sprite, getWasmSpritesView } from './sprite';
import {
  Slice,
  getWasmWallSlicesView,
  newSliceView,
  freeSliceView,
  freeTranspSliceViewsList,
} from './slice';
import Renderer from './renderer';
import { Key, keys, keyOffsets } from '../../input/inputManager';
import {
  ascImportImages,
  imageKeys,
  TRANSP_COLOR_RGB,
} from '../../../assets/build/images';
import { Texture, initTextureWasmView } from '../wasmEngine/texture';
import {
  FrameColorRGBAWasm,
  // getFrameColorRGBAWasmView,
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
  TRANSP0: imageKeys.TRANSP0,
  TRANSP1: imageKeys.TRANSP1,
  TRANSP2: imageKeys.TRANSP2,
  FULL_TRANSP: imageKeys.FULL_TRANSP,
  GREEN_LIGHT: imageKeys.GREEN_LIGHT,
  BARREL: imageKeys.BARREL,
  PILLAR: imageKeys.PILLAR,
  PLANT: imageKeys.PLANT,
};

const WALL_FLAGS_OFFSET = 13;
const WALL_CODE_MASK = (1 << WALL_FLAGS_OFFSET) - 1;

const WALL_FLAGS = {
  TRANSP: 1 << WALL_FLAGS_OFFSET,
  IS_DOOR: 1 << (WALL_FLAGS_OFFSET + 1),
  IS_SECRET: 1 << (WALL_FLAGS_OFFSET + 2),
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

const MIN_SPRITE_DIST = 0.1;
const MAX_SPRITE_DIST = 1000; // TODO:

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
  private wallZBuffer: Float32Array;

  private wallSlicesOccludedBySprites: Uint8Array;
  private spritesTop: number[];
  private spritesBottom: number[];

  private transpSlices: (Slice | WasmNullPtr)[];
  private numTranspSlicesLists: number; // num of not empty transp slices lists in transpSlices array
  private texSlicePartialTranspMap: {
    [texIdx: number]: { [mipLvl: number]: { [texX: number]: boolean } };
  };
  private texSliceFullyTranspMap: {
    [texIdx: number]: { [mipLvl: number]: { [texX: number]: boolean } };
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
  private iCheckWallIdxOffsY = new Int32Array(2);
  private iCheckWallIdxOffsDivFactorY = new Int32Array(2);

  private pos = new Float32Array(2);
  private rayDir = new Float32Array(2);
  private sideDist = new Float32Array(2);
  private deltaDist = new Float32Array(2);
  private step = new Int32Array(2);
  private wallMapOffs = new Int32Array(2);
  private wallMapIncOffs = new Int32Array(3);
  private checkWallIdxOffs = new Int32Array(2);
  private checkWallIdxOffsDivFactor = new Int32Array(2);
  private curMapPos = new Int32Array(2);
  private wallMaps = new Array<Uint16Array>(2);
  private mapLimits = new Int32Array(2);
  private floorWall = new Float32Array(2);

  // private _2float: Float32Array;
  // private _1u32: Uint32Array;

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
    this.renderer.IsFloorTextured = true;
    this.renderer.VertFloor = false;
    this.renderer.Back2Front = true;
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
    Sprite.SPRITE_HEIGHT_LIMIT = this.viewport.Height * 3;
    const YOFFSETS_ARR_LENGTH = this.viewport.Height;

    this.numViewSprites = 0;
    this.spritesTop = new Array<number>(this.viewport.Width);
    this.spritesBottom = new Array<number>(this.viewport.Width);

    const NUM_SPRITES = 7;

    this.wasmEngineModule.allocSpritesArr(this.raycasterPtr, NUM_SPRITES);
    this.sprites = getWasmSpritesView(this.wasmEngineModule, this.raycasterPtr);
    if (this.sprites.length) {
      this.viewSprites = new Array<Sprite>(1 + this.sprites.length);

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
      //   sprite.allocYOffsets(YOFFSETS_ARR_LENGTH);
      // }

      // {
      //   const tex = this.findTex(wallTexKeys.PILLAR);
      //   assert(tex);
      //   const sprite = this.sprites[0];
      //   sprite.PosX = 7.5;
      //   sprite.PosY = 8.5;
      //   sprite.PosZ = 0; // this.WallHeight; // base, 0 is the floor lvl
      //   sprite.TexIdx = tex.WasmIdx; // use wasmIndx for sprites tex
      //   sprite.Visible = 1;
      //   sprite.allocYOffsets(YOFFSETS_ARR_LENGTH);
      // }

      {
        const tex = this.findTex(wallTexKeys.PILLAR);
        assert(tex);
        const sprite = this.sprites[0];
        sprite.PosX = 7.5;
        sprite.PosY = 0.5;
        sprite.PosZ = 0; // this.WallHeight; // base, 0 is the floor lvl
        sprite.TexIdx = tex.WasmIdx; // use wasmIndx for sprites tex
        sprite.Visible = 1;
        sprite.allocYOffsets(YOFFSETS_ARR_LENGTH);
      }

      {
        const tex = this.findTex(wallTexKeys.PILLAR);
        assert(tex);
        const sprite = this.sprites[1];
        sprite.PosX = 5.5;
        sprite.PosY = 6.5;
        sprite.PosZ = 0; // this.WallHeight; // base, 0 is the floor lvl
        sprite.TexIdx = tex.WasmIdx; // use wasmIndx for sprites tex
        sprite.Visible = 1;
        sprite.allocYOffsets(YOFFSETS_ARR_LENGTH);
      }

      {
        const tex = this.findTex(wallTexKeys.BARREL);
        assert(tex);
        const sprite = this.sprites[2];
        sprite.PosX = 4.5;
        sprite.PosY = 2.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
        sprite.allocYOffsets(YOFFSETS_ARR_LENGTH);
      }

      {
        const tex = this.findTex(wallTexKeys.PLANT);
        assert(tex);
        const sprite = this.sprites[3];
        sprite.PosX = 0.5;
        sprite.PosY = 6.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
        sprite.allocYOffsets(YOFFSETS_ARR_LENGTH);
      }

      {
        const tex = this.findTex(wallTexKeys.PLANT);
        assert(tex);
        const sprite = this.sprites[4];
        sprite.PosX = 0.5;
        sprite.PosY = 4.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
        sprite.allocYOffsets(YOFFSETS_ARR_LENGTH);
      }

      {
        const tex = this.findTex(wallTexKeys.GREEN_LIGHT);
        assert(tex);
        const sprite = this.sprites[5];
        sprite.PosX = 5.5;
        sprite.PosY = 1.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
        sprite.allocYOffsets(YOFFSETS_ARR_LENGTH);
      }

      {
        const tex = this.findTex(wallTexKeys.PLANT);
        assert(tex);
        const sprite = this.sprites[6];
        sprite.PosX = 0.5;
        sprite.PosY = 2.5;
        sprite.PosZ = 0;
        sprite.TexIdx = tex.WasmIdx;
        sprite.Visible = 1;
        sprite.allocYOffsets(YOFFSETS_ARR_LENGTH);
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
    this.wallSlices = getWasmWallSlicesView(
      this.wasmEngineModule,
      this.raycasterPtr,
    );
    this.wallSlicesOccludedBySprites = new Uint8Array(this.wallSlices.length);
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
    this.precTexIsTranspCols();
    console.log('AHOOO');
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
    this.textures.forEach((tex) => {
      const mipLvl = 0; // TODO:
      const mipmap = tex.getMipmap(mipLvl);
      const { Image: image } = mipmap;
      const { Width: texWidth } = image;
      for (let texX = 0; texX < texWidth; texX++) {
        this.isSlicePartiallyTransp(tex.WasmIdx, mipLvl, texX, image);
        this.isSliceFullyTransp(tex.WasmIdx, mipLvl, texX, image);
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
      const tex = this.findTex(wallTexKeys.GREYSTONE);
      assert(tex);
      for (let i = 0; i < this.xWallMapHeight; i++) {
        this.xWallMap[i * this.xWallMapWidth] = tex.WallMapIdx;
        this.xWallMap[i * this.xWallMapWidth + (this.xWallMapWidth - 1)] =
          tex.WallMapIdx;
      }
      // this.xWallMap[0] = 0; // test hole
    }

    {
      const tex = this.findTex(wallTexKeys.GREYSTONE);
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
    // this.yMap[2] = 0; // test hole

    {
      const tex = this.findTex(darkWallTexKeys.REDBRICK);
      assert(tex);
      this.yWallMap[4 + this.yWallMapWidth * 2] = tex.WallMapIdx;
      this.yWallMap[5 + this.yWallMapWidth * 2] = tex.WallMapIdx;
    }

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
    const transp2 = this.findTex(wallTexKeys.TRANSP2);
    assert(transp2);
    this.yWallMap[3 + this.yWallMapWidth * 6] = darkTransp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.xWallMap[3 + this.xWallMapWidth * 6] = transp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.yWallMap[4 + this.yWallMapWidth * 6] = darkTransp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.xWallMap[4 + this.xWallMapWidth * 6] = transp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.yWallMap[5 + this.yWallMapWidth * 6] = darkTransp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.xWallMap[5 + this.xWallMapWidth * 6] = transp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.yWallMap[6 + this.yWallMapWidth * 6] = darkTransp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.xWallMap[6 + this.xWallMapWidth * 6] = transp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.yWallMap[7 + this.yWallMapWidth * 6] = darkTransp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.xWallMap[7 + this.xWallMapWidth * 6] = transp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.yWallMap[8 + this.yWallMapWidth * 6] = darkTransp2.WallMapIdx | WALL_FLAGS.TRANSP;
    this.xWallMap[8 + this.xWallMapWidth * 6] = transp2.WallMapIdx | WALL_FLAGS.TRANSP;

    this.yWallMap[6 + this.yWallMapWidth * 7] = darkTransp2.WallMapIdx | WALL_FLAGS.TRANSP;

    const darkTransp0 = this.findTex(darkWallTexKeys.TRANSP0);
    assert(darkTransp0);
    this.yWallMap[8 + this.yWallMapWidth * 6] = darkTransp0.WallMapIdx | WALL_FLAGS.TRANSP;
  }

  private initFloorMap() {
    const floorMapPtr = this.wasmEngineModule.getFloorMapPtr(this.raycasterPtr);

    this.floorMap = new Uint8Array(
      this.wasmRun.WasmMem.buffer,
      floorMapPtr,
      this.mapWidth * this.mapHeight,
    );

    let tex = this.findTex(floorTexKeys.FLOOR0);
    assert(tex);

    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        this.floorMap[y * this.mapWidth + x] = tex.WasmIdx;
      }
    }

    tex = this.findTex(floorTexKeys.FLOOR1);
    assert(tex);
    this.floorMap[4 * this.mapWidth + 4] = tex.WasmIdx;
  }

  private preRender() {
    this.freeTranspSlices();
    this.wallSlicesOccludedBySprites.fill(0);
  }

  private postRender() {}

  private isSliceFullyTransp(
    texIdx: number,
    mipLvl: number,
    srcTexX: number,
    image: BitImageRGBA,
  ) {
    const { texSliceFullyTranspMap } = this;

    if (!texSliceFullyTranspMap[texIdx]) {
      texSliceFullyTranspMap[texIdx] = {};
    }

    const mipLvl2IsSliceFullyTransp = texSliceFullyTranspMap[texIdx];

    if (!mipLvl2IsSliceFullyTransp[mipLvl]) {
      mipLvl2IsSliceFullyTransp[mipLvl] = {};
    }

    const isSliceFullyTranspMap = mipLvl2IsSliceFullyTransp[mipLvl];

    const texX = srcTexX | 0;

    if (isSliceFullyTranspMap[texX] !== undefined) {
      // console.log(`Wall texture col transparency cache hit at texIdx ${texIdx}, texX ${texX}, value ${isColTranspMap[texX]}`);
      return isSliceFullyTranspMap[texX];
    }

    const { Buf32: mipPixels, Width: texWidth, Lg2Pitch: lg2Pitch } = image;

    // image is rotated 90ccw
    const { transpColor } = Texture;
    const rowOffs = texX << lg2Pitch;
    let y = 0;
    for (; y < texWidth && mipPixels[rowOffs + y] === transpColor; y++) {}

    return (isSliceFullyTranspMap[texX] = y === texWidth);
  }

  private isSlicePartiallyTransp(
    texIdx: number,
    mipLvl: number,
    srcTexX: number,
    image: BitImageRGBA,
  ) {
    const { texSlicePartialTranspMap } = this;

    if (!texSlicePartialTranspMap[texIdx]) {
      texSlicePartialTranspMap[texIdx] = {};
    }

    const mipLvl2isSliceTransp = texSlicePartialTranspMap[texIdx];

    if (!mipLvl2isSliceTransp[mipLvl]) {
      mipLvl2isSliceTransp[mipLvl] = {};
    }

    const isSliceTranspMap = mipLvl2isSliceTransp[mipLvl];

    const texX = srcTexX | 0;

    if (isSliceTranspMap[texX] !== undefined) {
      // console.log(`Wall texture col transparency cache hit at texIdx ${texIdx}, texX ${texX}, value ${isColTranspMap[texX]}`);
      return isSliceTranspMap[texX];
    }

    const { Buf32: mipPixels, Width: texWidth, Lg2Pitch: lg2Pitch } = image;

    // image is rotated 90ccw
    const { transpColor } = Texture;
    const rowOffs = texX << lg2Pitch;
    let y = 0;
    for (; y < texWidth && mipPixels[rowOffs + y] !== transpColor; y++) {}

    return (isSliceTranspMap[texX] = y < texWidth);
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
      iCheckWallIdxOffsY,
      iCheckWallIdxOffsDivFactorY,
    } = this;

    assert(posX >= 0 && posX < mapWidth, 'posX out of map bounds');
    assert(posY >= 0 && posY < mapHeight, 'posY out of map bounds');

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
      checkWallIdxOffsDivFactor[X] = 1;

      step[Y] = iStep[sY];
      deltaDist[Y] = iStep[sY] / rayDir[Y];
      sideDist[Y] = iSideDistY[sY] * deltaDist[Y];
      checkWallIdxOffs[Y] = iCheckWallIdxOffsY[sY];
      checkWallIdxOffsDivFactor[Y] = iCheckWallIdxOffsDivFactorY[sY];

      wallMapIncOffs[0] = step[X];
      wallMapIncOffs[1] = step[Y] * yWallMapWidth;
      wallMapIncOffs[2] = step[Y] * xWallMapWidth;

      curMapPos[X] = mapX;
      curMapPos[Y] = mapY;
      wallMapOffs[X] = mapOffsX;
      wallMapOffs[Y] = mapOffsY;

      const wallSlice = wallSlices[x];
      wallSlice.Hit = 0;

      let steps = MAX_RAY_STEPS;
      let side: number;
      let nextPos: number;

      for (;;) {
        side = sideDist[X] < sideDist[Y] ? X : Y;
        const checkWallIdx = wallMapOffs[side] + checkWallIdxOffs[side];
        const wallMap = wallMaps[side];
        const wallCode = wallMap[checkWallIdx];
        let isRayValid = true;
        if (!(wallCode & WALL_CODE_MASK)) {
          nextPos = curMapPos[side] + step[side];
          isRayValid = nextPos >= 0 && nextPos < mapLimits[side] && steps > 0;
          if (isRayValid) {
            curMapPos[side] = nextPos;
            sideDist[side] += deltaDist[side];
            wallMapOffs[side] += wallMapIncOffs[side];
            wallMapOffs[side ^ 1] += wallMapIncOffs[side << 1];
            steps--;
            continue;
          }
        }
        const perpWallDist = sideDist[side];
        const wallX = (pos[side ^ 1] + perpWallDist * rayDir[side ^ 1]) % 1;

        const ratio = 1 / perpWallDist;
        const wallSliceProjHeight = (wallHeight * ratio) | 0;
        const srcWallBottom = (projYcenter + posZ * ratio) | 0;
        const srcWallTop = srcWallBottom - wallSliceProjHeight + 1;
        // const sliceHeight = srcWallBottom - srcWallTop + 1;
        const clipTop = Math.max(0, -srcWallTop);
        const wallTop = Math.max(0, srcWallTop); // wallTop = srcWallTop + clipTop;
        const wallBottom = Math.min(srcWallBottom, vpHeight - 1);
        // assert(wallTop <= wallBottom, `invalid top ${wallTop} and bottom`); // <= ?

        if (isRayValid) {
          const texIdx = (wallCode & WALL_CODE_MASK) - 1;
          // assert(texIdx >= 0 && texIdx < this.textures.length, 'invalid texIdx');

          const tex = textures[texIdx];
          const mipLvl = 0; // TODO:
          const mipmap = tex.getMipmap(mipLvl);
          const { Image: image } = mipmap;

          const {
            Width: texWidth,
            Height: texHeight,
            // Lg2Pitch: lg2Pitch,
          } = image;

          const srcTexX = (wallX * texWidth) | 0;
          const flipTexX = side === 0 ? rayDir[X] > 0 : rayDir[Y] < 0;
          const texX = flipTexX ? texWidth - srcTexX - 1 : srcTexX;
          // assert(texX >= 0 && texX < texWidth, `invalid texX ${texX}`);

          let slice = wallSlice;

          const isTranspWall =
            wallCode & WALL_FLAGS.TRANSP &&
            this.isSlicePartiallyTransp(texIdx, mipLvl, texX, image);

          if (isTranspWall) {
            slice = this.newWallTranspSlice(x);
            slice.Side = side;
            slice.Distance = perpWallDist;
            slice.ClipTop = clipTop;
            slice.Top = wallTop;
            slice.Bottom = wallBottom;
          }

          const texStepY = texHeight / wallSliceProjHeight;
          const texY = clipTop * texStepY;

          slice.TexX = texX;
          slice.TexY = texY;
          slice.TexStepY = texStepY;
          slice.Mipmap = image; // used in render ts
          slice.MipMapIdx = mipmap.WasmIdx; // used in render wasm

          if (isTranspWall) {
            nextPos = curMapPos[side] + step[side];
            isRayValid = nextPos >= 0 && nextPos < mapLimits[side];
            if (isRayValid) {
              curMapPos[side] = nextPos;
              sideDist[side] += deltaDist[side];
              wallMapOffs[side] += wallMapIncOffs[side];
              wallMapOffs[side ^ 1] += wallMapIncOffs[side << 1];
              continue;
            }
          }
        }

        // solid wall or map edge/max steps reached
        wallZBuffer[x] = perpWallDist;
        wallSlice.Hit = isRayValid ? 1 : 0;

        wallSlice.Side = side;
        wallSlice.Distance = perpWallDist;
        wallSlice.ClipTop = clipTop;
        wallSlice.Top = wallTop;
        wallSlice.Bottom = wallBottom;

        if (this.IsFloorTextured) {
          floorWall[side ^ 1] = curMapPos[side ^ 1] + wallX;
          const floorWallXOffs =
            checkWallIdxOffs[side] / checkWallIdxOffsDivFactor[side];
          floorWall[side] = curMapPos[side] + floorWallXOffs;
          [wallSlice.FloorWallX, wallSlice.FloorWallY] = floorWall;
        }

        maxWallDistance = Math.max(maxWallDistance, perpWallDist);
        minWallTop = Math.min(minWallTop, wallTop);
        maxWallTop = Math.max(maxWallTop, wallTop);
        minWallBottom = Math.min(minWallBottom, wallBottom);
        maxWallBottom = Math.max(maxWallBottom, wallBottom);

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
    this.preRender();
    this.calcWallsVis();
    this.processSprites();
    this.renderer.render(frameCnt);
    this.postRender();
  }

  private processSprites(): void {
    const {
      sprites,
      player,
      WallHeight,
      wallZBuffer,
      viewSprites,
      textures,
      ProjYCenter: projYCenter,
      transpSlices,
      wallSlices,
      spritesTop,
      spritesBottom,
      wallSlicesOccludedBySprites,
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

      const spriteWidth = spriteHeight;

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

      const texIdx = sprite.TexIdx;
      const tex = textures[texIdx];
      const mipLvl = 0; // TODO:
      const mipmap = tex.getMipmap(mipLvl);
      const { Image: image } = mipmap;
      const { Width: texWidth, Height: texHeight } = image;

      const texStepX = texWidth / spriteWidth;
      const texX = clipX * texStepX;

      const texStepY = texHeight / spriteHeight;
      const texY = clipY * texStepY;

      // occlusion test with walls and slice gen with cols with transp walls
      let useTranspSlicesOnly = true;
      let isOccluded = true;

      let sliceTexX = texX;

      for (let x = startX; x <= endX; x++, sliceTexX += texStepX) {
        if (this.isSliceFullyTransp(texIdx, mipLvl, sliceTexX, image)) {
          continue;
        }
        if (transpSlices[x] === WASM_NULL_PTR) {
          useTranspSlicesOnly = false;
          if (tY < wallZBuffer[x]) {
            isOccluded = false;
            if (
              !this.isSlicePartiallyTransp(texIdx, mipLvl, sliceTexX, image)
            ) {
              // sprite slice fully opaque
              wallSlicesOccludedBySprites[x] = 1;
              spritesTop[x] = startY;
              spritesBottom[x] = endY;
              wallZBuffer[x] = tY;
              this.MinWallTop = Math.min(this.MinWallTop, startY);
              this.MaxWallBottom = Math.max(this.MaxWallBottom, endY);
              continue;
            }
          }
        } else {
          const slice = this.newTranspSlice();
          slice.Side = 0;
          slice.Distance = tY;
          slice.ClipTop = clipY;
          slice.TexX = sliceTexX;
          slice.Top = startY;
          slice.Bottom = endY;
          slice.TexY = texY;
          slice.TexStepY = texStepY;
          slice.Mipmap = image;
          slice.MipMapIdx = mipmap.WasmIdx;

          // insert in correct decreasing distance order in circular doubly linked list transpSlices[x]
          const firstPtr = transpSlices[x] as Slice;
          let curPtr = firstPtr;

          if (tY >= curPtr.Distance) {
            // insert at front, the sprite slice is the farthest, check wall occlusion
            if (wallZBuffer[x] >= tY) {
              this.updateTranspSliceArrayIdx(x, slice);
            } else {
              // sprite slice occluded by wall, free it
              freeSliceView(slice);
              continue;
            }
          } else {
            do {
              curPtr = curPtr.Next as Slice;
            } while (tY < curPtr.Distance && curPtr !== firstPtr);
          }
          // insert before curPtr
          slice.Prev = curPtr.Prev;
          curPtr.Prev = slice;
          slice.Next = curPtr;
          (slice.Prev as Slice).Next = slice;
        }
      }

      if (isOccluded || useTranspSlicesOnly) {
        // sprite removed from the sorting list
        // if it has cols shared with transp walls slices it will be rendered later with them
        continue;
      }

      sprite.MipLevel = mipLvl;
      sprite.Mipmap = image;
      sprite.Distance = tY;
      sprite.StartX = startX;
      sprite.EndX = endX;
      sprite.TexX = texX;
      sprite.TexStepX = texStepX;
      sprite.StartY = startY;
      sprite.EndY = endY;
      sprite.TexY = texY;
      sprite.TexStepY = texStepY;

      // precalc y offsets
      const { YOffsets: yOffsets } = sprite;
      let curTexY = texY;
      for (let y = startY; y <= endY; y++) {
        yOffsets[y] = curTexY;
        curTexY += texStepY;
      }

      // insertion sort on viewSprites[1...numViewSprites] on descending distance
      let j = numViewSprites++;
      viewSprites[0] = sprite; // sentinel at 0
      const spriteDist = sprite.Distance; // get float dist value
      for (; viewSprites[j].Distance < spriteDist; j--) {
        viewSprites[j + 1] = viewSprites[j];
      }
      viewSprites[j + 1] = sprite;
      // viewSprites[1...numViewSprites] is sorted on descending distance
    }

    this.numViewSprites = numViewSprites;
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

  private newWallTranspSlice(idx: number): Slice {
    const newSlice = newSliceView(this.wasmEngineModule);
    this.addTranspSliceAtFront(newSlice, idx);
    return newSlice;
  }

  private newTranspSlice(): Slice {
    const newSlice = newSliceView(this.wasmEngineModule);
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
      this.numTranspSlicesLists++;
      newSlice.Prev = newSlice.Next = newSlice;
    }
    this.updateTranspSliceArrayIdx(idx, newSlice);
    return newSlice;
  }

  private resetTranspSlices() {
    this.numTranspSlicesLists = 0;
    this.wasmEngineModule.resetTranspSlicesPtrs(this.raycasterPtr);
    for (let i = 0; i < this.transpSlices.length; i++) {
      this.transpSlices[i] = 0;
    }
  }

  private freeTranspSlices() {
    if (this.numTranspSlicesLists) {
      for (let i = 0; i < this.transpSlices.length; i++) {
        if (this.transpSlices[i]) {
          const slice = this.transpSlices[i] as Slice;
          freeTranspSliceViewsList(slice);
        }
      }
      this.resetTranspSlices();
    }
  }

  private get IsFloorTextured(): boolean {
    return this.renderer.IsFloorTextured && this.renderer.VertFloor;
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
    const MOVE_SPEED = 0.010; // 0.009; // TODO:
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

  get NumTranspSlicesList() {
    return this.numTranspSlicesLists;
  }

  get TranspSlices() {
    return this.transpSlices;
  }

  get WallZBuffer() {
    return this.wallZBuffer;
  }

  get TexSliceFullyTranspMap() {
    return this.texSliceFullyTranspMap;
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
}

export { Raycaster, RaycasterParams };
