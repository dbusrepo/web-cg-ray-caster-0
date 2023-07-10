import { texturesIndexPtr, numTextures } from './importVars';
import { Texture } from './texture';
import { logi } from './importVars';
import { SArray, newSArray } from './sarray';
import { PTR_T, SIZE_T } from './memUtils';

function initTextures(): SArray<Texture> {
  const textures = newSArray<Texture>(numTextures);
  for (let i: usize = 0; i < numTextures; i++) {
    const tex = textures.at(i);
    tex.init(i);
  }
  return textures;
}

export { initTextures };
