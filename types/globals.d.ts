// What assets/*.js use without defining it: the libraries the pages load from a CDN, and short names for
// the data's types (generated from its schemas next to this file) to use in JSDoc, e.g. /** @param {Resort} r */.

declare const maplibregl: typeof import("maplibre-gl");
// maplibre-contour, on the pages with contour lines (resort.html, map.html).
declare const mlcontour: any;

interface Window {
  // The page's translations, put in by scripts/translate.mjs; none in English.
  STRINGS?: Record<string, string | Record<string, string>>;
}

// json/index.json and one resort in it.
type Index = import("./index").SnowConditionsForAllResorts;
type IndexResort = import("./index").IndexResort;
// json/<country>/<id>.json.
type Resort = import("./resort").SnowConditionsForOneResort;
type SourceDetails = import("./resort").SourceDetails;
type SourceRef = import("./resort").SourceRef;
type Station = import("./resort").Station;
type Avalanche = import("./resort").Avalanche;
type DangerRating = import("./resort").DangerRating;
// json/<country>/<id>.details.json (experimental): every lift and slope, for resorts with `details`.
type ResortDetails = import("./resort-details").ExperimentalEveryLiftAndSlopeOfOneResort;
type DetailsLift = import("./resort-details").DetailsLift;
type DetailsSlope = import("./resort-details").DetailsSlope;
// history/<country>/<id>.json.
type ResortHistory = import("./history").PastRunsOfOneResortForGraphs;
// json/stats.json.
type Stats = import("./stats").DailyTotalsPerCountryAndRegion;
type StatsRegion = import("./stats").StatsRegion;
// ski/v1/10/<x>/<y>.json and what's in it.
type SkiTile = import("./ski-tile").LiftradarSkiTile;
type SkiArea = SkiTile["areas"][number];
type SkiLift = SkiTile["lifts"][number];
type SkiRun = SkiTile["runs"][number];

// The pages' own elements, looked up by id or selector, are taken to be there and of the right kind: the
// check is for the data, and a missing element shows at once on the page.
interface Document {
  getElementById(elementId: string): any;
}
interface ParentNode {
  querySelector(selectors: string): any;
}
interface ParentNode {
  querySelectorAll(selectors: string): NodeListOf<any>;
}

// MapLibre's style expressions and filters, e.g. /** @type {Expression} */ const mine = ["==", ["get", "lr"], KEY].
type Expression = import("maplibre-gl").ExpressionSpecification;
type Filter = import("maplibre-gl").FilterSpecification;
