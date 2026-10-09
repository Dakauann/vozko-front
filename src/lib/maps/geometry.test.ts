import { describe, expect, it } from "vitest";

import { BRAZIL_BOUNDS, CIRCLE_VERTICES, circleRing64, distanceMeters, isValidPosition, offsetMeters, openingBounds } from "./geometry";

const BACKEND_RING64_PARITY: Array<[number, number, number, number, number]> = [
  [-3.7, 150, 0, -3.6986510194544135, -50],
  [-3.7, 150, 8, -3.6990461267085268, -49.999044135348512],
  [-3.7, 150, 16, -3.7000000000000002, -49.998648201790928],
  [-3.7, 150, 24, -3.7009538732914735, -49.999044133290354],
  [-3.7, 150, 32, -3.7013489805455868, -50],
  [-3.7, 150, 40, -3.7009538732914735, -50.000955866709646],
  [-3.7, 150, 48, -3.7000000000000002, -50.001351798209072],
  [-3.7, 150, 63, -3.6986575151644541, -50.000132499194031],
  [-3.7, 5000, 0, -3.6550339818137734, -50],
  [-3.7, 5000, 8, -3.6682042236175616, -49.968138949125432],
  [-3.7, 5000, 16, -3.7000000000000002, -49.954940059697549],
  [-3.7, 5000, 24, -3.7317957763824388, -49.968136662284785],
  [-3.7, 5000, 32, -3.744966018186227, -50],
  [-3.7, 5000, 40, -3.7317957763824388, -50.031863337715215],
  [-3.7, 5000, 48, -3.7000000000000002, -50.045059940302451],
  [-3.7, 5000, 63, -3.6552505054818027, -50.004416424779919],
  [-3.7, 50000, 0, -3.2503398181377312, -50],
  [-3.7, 50000, 8, -3.3820422361756135, -49.68148750424529],
  [-3.7, 50000, 16, -3.7000000000000002, -49.549400596975502],
  [-3.7, 50000, 24, -4.0179577638243869, -49.681258814341021],
  [-3.7, 50000, 32, -4.1496601818622691, -50],
  [-3.7, 50000, 40, -4.0179577638243869, -50.318741185658979],
  [-3.7, 50000, 48, -3.7000000000000002, -50.450599403024498],
  [-3.7, 50000, 63, -3.2525050548180277, -50.0441455151432],
  [-23.55, 150, 0, -23.548651019454415, -50],
  [-23.55, 150, 8, -23.549046126708529, -49.998959469681559],
  [-23.55, 150, 16, -23.550000000000001, -49.998528457234166],
  [-23.55, 150, 24, -23.550953873291473, -49.998959454580984],
  [-23.55, 150, 32, -23.551348980545587, -50],
  [-23.55, 150, 40, -23.550953873291473, -50.001040545419016],
  [-23.55, 150, 48, -23.550000000000001, -50.001471542765834],
  [-23.55, 150, 63, -23.548657515164454, -50.000144234940848],
  [-23.55, 5000, 0, -23.505033981813774, -50],
  [-23.55, 5000, 8, -23.518204223617563, -49.965323786222136],
  [-23.55, 5000, 16, -23.550000000000001, -49.950948574472157],
  [-23.55, 5000, 24, -23.581795776382439, -49.965307007802984],
  [-23.55, 5000, 32, -23.594966018186227, -50],
  [-23.55, 5000, 40, -23.581795776382439, -50.034692992197016],
  [-23.55, 5000, 48, -23.550000000000001, -50.049051425527843],
  [-23.55, 5000, 63, -23.505250505481804, -50.004806245828767],
  [-23.55, 50000, 0, -23.10033981813773, -50],
  [-23.55, 50000, 8, -23.232042236175616, -49.653985620968591],
  [-23.55, 50000, 16, -23.550000000000001, -49.509485744721559],
  [-23.55, 50000, 24, -23.867957763824386, -49.652307726705885],
  [-23.55, 50000, 32, -23.999660181862271, -50],
  [-23.55, 50000, 40, -23.867957763824389, -50.347692273294115],
  [-23.55, 50000, 48, -23.550000000000001, -50.490514255278441],
  [-23.55, 50000, 63, -23.102505054818028, -50.047917152693124],
  [-33.6, 150, 0, -33.598651019454415, -50],
  [-33.6, 150, 8, -33.599046126708529, -49.998854798395989],
  [-33.6, 150, 16, -33.600000000000001, -49.998380422446139],
  [-33.6, 150, 24, -33.600953873291473, -49.998854773061431],
  [-33.6, 150, 32, -33.601348980545588, -50],
  [-33.6, 150, 40, -33.600953873291473, -50.001145226938569],
  [-33.6, 150, 48, -33.600000000000001, -50.001619577553861],
  [-33.6, 150, 63, -33.598657515164454, -50.000158743889187],
  [-33.6, 5000, 0, -33.555033981813772, -50],
  [-33.6, 5000, 8, -33.568204223617563, -49.961840254661375],
  [-33.6, 5000, 16, -33.600000000000001, -49.946014081538017],
  [-33.6, 5000, 24, -33.63179577638244, -49.961812105137746],
  [-33.6, 5000, 32, -33.644966018186231, -50],
  [-33.6, 5000, 40, -33.63179577638244, -50.038187894862254],
  [-33.6, 5000, 48, -33.600000000000001, -50.053985918461983],
  [-33.6, 5000, 63, -33.555250505481801, -50.00528880253362],
  [-33.6, 50000, 0, -33.150339818137731, -50],
  [-33.6, 50000, 8, -33.282042236175613, -49.619658372838579],
  [-33.6, 50000, 16, -33.600000000000001, -49.4601408153802],
  [-33.6, 50000, 24, -33.91795776382439, -49.616843311069445],
  [-33.6, 50000, 32, -34.049660181862272, -50],
  [-33.6, 50000, 40, -33.91795776382439, -50.383156688930555],
  [-33.6, 50000, 48, -33.600000000000001, -50.5398591846198],
  [-33.6, 50000, 63, -33.152505054818029, -50.052643886191717],
];

describe("circleRing64", () => {
  it.each(BACKEND_RING64_PARITY)(
    "matches domain/geo Ring64 for a center at lat %s with radius %s m, vertex %s",
    (centerLat, radiusM, vertex, lat, lng) => {
      const ring = circleRing64({ lat: centerLat, lng: -50 }, radiusM);
      expect(ring[vertex].lat).toBeCloseTo(lat, 12);
      expect(ring[vertex].lng).toBeCloseTo(lng, 12);
    },
  );

  it("returns 64 open vertices, the first one due north", () => {
    const ring = circleRing64({ lat: -23.55, lng: -46.65 }, 1000);
    expect(ring).toHaveLength(CIRCLE_VERTICES);
    expect(ring[0].lng).toBe(-46.65);
    expect(ring[0].lat).toBeGreaterThan(-23.55);
    expect(ring[CIRCLE_VERTICES - 1]).not.toEqual(ring[0]);
  });

  it.each([-3.7, -23.55, -33.6])("stays on the radius at latitude %s", (lat) => {
    for (const radius of [150, 5000, 50000]) {
      const center = { lat, lng: -50 };
      for (const vertex of circleRing64(center, radius)) {
        expect(Math.abs(distanceMeters(center, vertex) - radius) / radius).toBeLessThan(0.005);
      }
    }
  });
});

describe("distanceMeters", () => {
  it("measures São Paulo to Rio de Janeiro as the backend does", () => {
    const meters = distanceMeters({ lat: -23.5505, lng: -46.6333 }, { lat: -22.9068, lng: -43.1729 });
    expect(Math.abs(meters - 360750)).toBeLessThan(1500);
  });

  it("measures one degree of latitude as about 111 km", () => {
    expect(Math.abs(distanceMeters({ lat: -10, lng: -50 }, { lat: -11, lng: -50 }) - 111195)).toBeLessThan(5);
  });

  it("is zero for the same point", () => {
    expect(distanceMeters({ lat: -23.5, lng: -46.6 }, { lat: -23.5, lng: -46.6 })).toBe(0);
  });
});

describe("isValidPosition", () => {
  it.each([
    [{ lat: -23.56, lng: -46.65 }, true],
    [{ lat: 90, lng: 180 }, true],
    [{ lat: 0, lng: 0 }, false],
    [{ lat: 90.1, lng: -46 }, false],
    [{ lat: -23, lng: -180.1 }, false],
    [{ lat: Number.NaN, lng: -46 }, false],
    [{ lat: -23, lng: Number.NEGATIVE_INFINITY }, false],
  ])("judges %o as %s", (position, valid) => {
    expect(isValidPosition(position)).toBe(valid);
  });
});

describe("offsetMeters", () => {
  it("moves north and east by the given distances", () => {
    const start = { lat: -23.55, lng: -46.63 };
    const north = offsetMeters(start, 10, 0);
    const east = offsetMeters(start, 0, 10);
    expect(north.lng).toBe(start.lng);
    expect(east.lat).toBe(start.lat);
    expect(north.lat).toBeGreaterThan(start.lat);
    expect(east.lng).toBeGreaterThan(start.lng);
    expect(distanceMeters(start, north)).toBeCloseTo(10, 3);
    expect(distanceMeters(start, east)).toBeCloseTo(10, 3);
  });

  it("moves south and west with negative distances", () => {
    const start = { lat: -3.7, lng: -50 };
    const moved = offsetMeters(start, -25, -25);
    expect(moved.lat).toBeLessThan(start.lat);
    expect(moved.lng).toBeLessThan(start.lng);
  });
});

describe("openingBounds", () => {
  it("frames the located leads when they fit inside Brazil", () => {
    const saoPaulo = { south: -23.9, west: -46.9, north: -23.3, east: -46.3 };
    expect(openingBounds(saoPaulo)).toEqual(saoPaulo);
  });

  it("frames Brazil when the leads spread across the country or reach past it, never the world", () => {
    expect(openingBounds({ south: -33, west: -73, north: 4, east: -35 })).toEqual(BRAZIL_BOUNDS);
    expect(openingBounds({ south: -23.9, west: -46.9, north: 38.7, east: -9.1 })).toEqual(BRAZIL_BOUNDS);
    expect(openingBounds({ south: -60, west: -180, north: 70, east: 180 })).toEqual(BRAZIL_BOUNDS);
  });

  it("frames leads that all live abroad in a small region", () => {
    const lisbon = { south: 38.6, west: -9.3, north: 38.8, east: -9.0 };
    expect(openingBounds(lisbon)).toEqual(lisbon);
  });

  it("frames Brazil without leads or with a broken extent", () => {
    expect(openingBounds(null)).toEqual(BRAZIL_BOUNDS);
    expect(openingBounds({ south: 10, west: 0, north: -10, east: 1 })).toEqual(BRAZIL_BOUNDS);
  });
});
