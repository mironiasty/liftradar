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
  /**
   * Once ready: the resort's name as the tiles have it, how many lifts and pistes are drawn, and whether
   * the villages and roads round it are (from OpenFreeMap: credit OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors).
   */
  onInfo?(info: { name: string; lifts: number; pistes: number; towns: boolean }): void;
  /**
   * The places' names to write over the canvas, whenever they change as the camera moves: each centred
   * at `x, y` (CSS pixels on the canvas), `major` for a village or bigger (the apps write it larger, in a
   * pale pill). Not told without towns.
   */
  onLabels?(labels: PlaceLabel[]): void;
  /** A click (not a drag) on a lift or piste; null on neither. */
  onPick?(picked: Picked | null): void;
  /**
   * While something is picked, where on the canvas the point of it that was clicked now is, each
   * time the camera has moved it (CSS pixels); null while it's off the canvas or behind the camera.
   */
  onPickMove?(at: { x: number; y: number } | null): void;
  /**
   * The camera's turn whenever it changes, in radians from 0 (looking north) to 2π, growing as the
   * camera goes round east: north on screen is that much clockwise from up (a compass's needle).
   */
  onTurn?(yaw: number): void;
}

/**
 * What was clicked, and where on the canvas (CSS pixels). A lift: OpenSkiData's `type` (chair_lift,
 * gondola…), seats and capacity (people an hour), whether in a tunnel, its name and number (`ref`),
 * length with the climb and the climb in metres, and the ride time in seconds, where the map has them.
 * A piste: its colour on the signs (green, blue, red, black, orange), name, number, OpenSkiData's
 * `difficulty` (and colour convention `conv`, when not Europe's), and length in metres when it's a line.
 */
export type Picked = { x: number; y: number } & (
  | {
      kind: 'lift';
      type?: string;
      seats?: number;
      capacity?: number;
      tunnel?: boolean;
      name?: string;
      ref?: string;
      lengthM: number;
      riseM?: number;
      durationS?: number;
    }
  | { kind: 'piste'; colour: string; name?: string; ref?: string; difficulty?: string; conv?: string; lengthM?: number }
);

/** A place's name over the land. */
export type PlaceLabel = { name: string; x: number; y: number; major: boolean };

export interface MountedResort {
  /** Glides `by` times closer (below 1 further back), as a map's + and − do. */
  zoom(by: number): void;
  /** Glides round to look north. */
  faceNorth(): void;
  /** Stops drawing and frees the GPU. The canvas can't be drawn on again: give a new one. */
  destroy(): void;
}

/** Whether this browser can draw it: WebGPU, with an adapter. */
export function supported(): Promise<boolean>;

/**
 * The resort drawn on `canvas`, sized as the canvas is laid out, the camera still until moved
 * (drag to turn, right-drag or Shift-drag to move, wheel or pinch to zoom). The elevation tiles come from the
 * Terrarium tiles on AWS (Mapzen, Terrain Tiles); the ski tiles from `base`.
 */
export function mountResort(canvas: HTMLCanvasElement, options: MountOptions): MountedResort;
