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
   * Once ready: the resort's name as the tiles have it, how many lifts and pistes are drawn, whether
   * the villages and roads round it are (from OpenFreeMap: credit OpenFreeMap, © OpenMapTiles, © OpenStreetMap contributors),
   * and `daylight`: the local hours (in quarters) between which the sun is over the horizon there today, for setHour.
   */
  onInfo?(info: { name: string; lifts: number; pistes: number; towns: boolean; daylight: [number, number] }): void;
  /** The sun as at this local hour today (11.5: half past eleven); the look's, 11.5, when unset. setHour changes it. */
  hour?: number;
  /**
   * Which names are written over the land at first (setLabels changes it): the places' only when unset.
   * A layer that's on shows by the zoom, as a map's names do: the places' always, every lift's from
   * closer, every piste's from closer still.
   */
  labels?: LabelLayers;
  /**
   * The names to write over the canvas, whenever they change as the camera moves or the layers change:
   * each centred at `x, y` (CSS pixels on the canvas). Places' (`major` for a village or bigger: the apps
   * write it larger, in a pale pill; none without towns), and lifts' and pistes' where those are on.
   */
  onLabels?(labels: MapLabel[]): void;
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

/** Which names are written: the places', the lifts', the pistes'. */
export type LabelLayers = { places: boolean; lifts: boolean; pistes: boolean };

/**
 * A name over the land: a place's, a lift's (with OpenSkiData's `liftType`, for its picture) or a
 * piste's (with its `colour` on the signs: green, blue, red, black, orange). A lift's and a piste's
 * name is its number where the map has no name.
 */
export type MapLabel = {
  kind: 'place' | 'lift' | 'piste';
  name: string;
  x: number;
  y: number;
  major: boolean;
  liftType?: string;
  colour?: string;
};

/** A place's name over the land (a MapLabel of kind `place`; the name before lifts and pistes had theirs). */
export type PlaceLabel = MapLabel;

export interface MountedResort {
  /** Glides `by` times closer (below 1 further back), as a map's + and − do. */
  zoom(by: number): void;
  /** Glides round to look north. */
  faceNorth(): void;
  /**
   * What was picked is no longer marked (as a click on nothing does): call it when its card is closed. A
   * picked lift's cables are drawn wider and amber, a picked piste (all its pieces) in its colour in full.
   */
  unpick(): void;
  /** Which names are written over the land: onLabels is told the new ones at the next frame. */
  setLabels(layers: LabelLayers): void;
  /** The sun as at this local hour today (11.5: half past eleven), from the next frame: shadows and light move with it. */
  setHour(hour: number): void;
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
