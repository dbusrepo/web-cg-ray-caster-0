// import assert from 'assert';
import type { WasmNullPtr } from '../wasmEngine/wasmRun';
import { WasmRun, WASM_NULL_PTR } from '../wasmEngine/wasmRun';
import type { WasmModules, WasmEngineModule } from '../wasmEngine/wasmLoader';
import { BitImageRGBA, BPP_RGBA } from '../assets/images/bitImageRGBA';
import { Texture } from '../wasmEngine/texture';
import { FrameColorRGBAWasm } from '../wasmEngine/frameColorRGBAWasm';
import { FrameColorRGBA } from '../frameColorRGBA';
import { Raycaster } from './raycaster';

class Renderer {
  private raycaster: Raycaster;
  private wasmRun: WasmRun;
  private wasmEngineModule: WasmEngineModule;
  private frameBuf32: Uint32Array;
  private frameStride: number;
  private startFramePtr: number;
  private frameRowPtrs: Uint32Array;
  private textures: Texture[];
  private frameCnt: number;

  constructor(raycaster: Raycaster) {
    this.raycaster = raycaster;
    const viewport = raycaster.Viewport;
    const {
      StartX: vpStartX,
      StartY: vpStartY,
      Width: vpWidth,
      Height: vpHeight,
    } = viewport;

    this.wasmRun = raycaster.WasmRun;
    this.wasmEngineModule = this.wasmRun.WasmModules.engine;

    this.frameStride = this.wasmRun.FrameStride;

    const { rgbaSurface0: frameBuf8 } = this.wasmRun.WasmViews;

    this.frameBuf32 = new Uint32Array(
      frameBuf8.buffer,
      0,
      frameBuf8.byteLength / Uint32Array.BYTES_PER_ELEMENT,
    );

    this.startFramePtr = vpStartY * this.frameStride + vpStartX;

    this.frameRowPtrs = new Uint32Array(vpHeight + 1);
    for (let i = 0; i <= vpHeight; i++) {
      this.frameRowPtrs[i] = this.startFramePtr + i * this.frameStride;
    }

    // const frameRows = this.frameBuf32.length / this.frameStride;

    this.textures = raycaster.Textures;
  }

  // public set UseWasmRenderer(useWasmRenderer: boolean) { // not used
  //   this.useWasmRenderer = useWasmRenderer;
  // }

  public renderBackground(color: number) {
    const { frameBuf32, frameStride, raycaster } = this;

    const {
      StartX: vpStartX,
      StartY: vpStartY,
      Width: vpWidth,
      Height: vpHeight,
    } = raycaster.Viewport;

    for (
      let i = vpStartY, offset = vpStartY * frameStride;
      i < vpStartY + vpHeight;
      i++, offset += frameStride
    ) {
      frameBuf32.fill(color, offset + vpStartX, offset + vpStartX + vpWidth);
    }
  }

  public renderBorders(borderColor: number) {
    const { frameBuf32, frameStride, raycaster } = this;

    const {
      StartX: vpStartX,
      StartY: vpStartY,
      Width: vpWidth,
      Height: vpHeight,
    } = raycaster.Viewport;

    const upperLimit = vpStartY * frameStride;
    const lowerLimit = (vpStartY + vpHeight) * frameStride;

    frameBuf32.fill(borderColor, 0, upperLimit);
    frameBuf32.fill(borderColor, lowerLimit, frameBuf32.length);

    for (
      let i = vpStartY, offset = vpStartY * frameStride;
      i < vpStartY + vpHeight;
      i++, offset += frameStride
    ) {
      frameBuf32.fill(borderColor, offset, offset + vpStartX);
      frameBuf32.fill(
        borderColor,
        offset + vpStartX + vpWidth,
        offset + frameStride,
      );
    }
  }

  public render(frameCnt: number) {
    this.frameCnt = frameCnt;
  }
}

export default Renderer;
