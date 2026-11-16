// TrailRider's viewer bundle: a liftradar resort in 3D (liftradar.eu's 3d.html). Shipped with
// viewer.js in viewer.tar.gz; built from TrailRider's web/src/viewer.ts.

export type ResortStatus = 'tiles' | 'terrain' | 'ready' | { error: string };

export interface MountOptions {
  /** `<country>/<id>`, as liftradar has it. */
  resort: string;
  /** The site the ski tiles come from (its `/ski/v1/`): https://liftradar.eu when unset. */
  base?: string;
  /** Fetching the ski tiles, then the elevation tiles, then drawn; or why it couldn't be. */
  onStatus?(status: ResortStatus): void;
  /** Once ready: the resort's name as the tiles have it, and how many lifts and pistes are drawn. */
  onInfo?(info: { name: string; lifts: number; pistes: number }): void;
}

export interface MountedResort {
  /** Stops drawing and frees the GPU. The canvas can't be drawn on again: give a new one. */
  destroy(): void;
}

/** Whether this browser can draw it: WebGPU, with an adapter. */
export function supported(): Promise<boolean>;

/**
 * The resort drawn on `canvas`, sized as the canvas is laid out, the camera turning slowly round
 * it until touched (drag to turn, wheel or pinch to zoom). The elevation tiles come from the
 * Terrarium tiles on AWS (Mapzen, Terrain Tiles); the ski tiles from `base`.
 */
export function mountResort(canvas: HTMLCanvasElement, options: MountOptions): MountedResort;
