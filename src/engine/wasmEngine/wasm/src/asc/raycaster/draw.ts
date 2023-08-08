import { PTR_T, SIZE_T, NULL_PTR } from '../memUtils';
import { Raycaster } from './raycaster';

function drawViewVert(raycaster: Raycaster): void {
  const viewport = raycaster.Viewport;
  const player = raycaster.Player;
  const wallSlices = raycaster.WallSlices;
  const posX = player.PosX;
  const posY = player.PosY;
  const dirX = player.DirX;
  const dirY = player.DirY;
  const planeX = player.PlaneX;
  const planeY = player.PlaneY;
  const projYCenter = raycaster.ProjYCenter;
  // const zBuffer = raycaster.ZBuffer;
  const map = raycaster.Map;
  const mapWidth = map.Width;
  const mapHeight = map.Height;
  const minWallTop = raycaster.MinWallTop;
  const maxWallTop = raycaster.MaxWallTop;
  const minWallBottom = raycaster.MinWallBottom;
  const maxWallBottom = raycaster.MaxWallBottom;

  // for (let x: u32 = 0; x < viewport.Width; x++) {
  // }
}

export { drawViewVert };
