/**
 * population2.json の中心点から Voronoi ポリゴンを生成し、
 * 海側にはみ出しを抑えるために陸地近似マスクでクリップして保存するスクリプト
 *
 * 使い方: node scripts/gen-voronoi.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as turf from "@turf/turf";

const __dirname = dirname(fileURLToPath(import.meta.url));

const population = JSON.parse(
  readFileSync(resolve(__dirname, "../public/data/population2.json"), "utf8")
);
const cityGeoJSON = JSON.parse(
  readFileSync(resolve(__dirname, "../public/data/nagasaki-city.geojson"), "utf8")
);

// ── 1. 中心点の FeatureCollection を作成 ─────────────────────────────────
const points = turf.featureCollection(
  population.map((d) =>
    turf.point([d.longitude, d.latitude], {
      id: d.id,
      town_name: d.town_name,
      population_age_65_and_over: d.population_age_65_and_over,
    })
  )
);

// ── 2. バウンディングボックスを少し広げて Voronoi を計算 ─────────────────
const [minLng, minLat, maxLng, maxLat] = turf.bbox(points);
const pad = 0.05;
const bbox = [minLng - pad, minLat - pad, maxLng + pad, maxLat + pad];

const voronoi = turf.voronoi(points, { bbox });

if (!voronoi || !voronoi.features.length) {
  console.error("Voronoi 生成失敗");
  process.exit(1);
}

// ── 3. 陸地近似マスクを作成（concave hull -> buffer）──────────────────────
const cityPolygon = cityGeoJSON.features?.[0];

// 点群から陸地形状を近似。失敗時は凸包を使用。
const concaveHull = turf.concave(points, {
  maxEdge: 5,
  units: "kilometers",
});
const landBase = concaveHull ?? turf.convex(points);
if (!landBase) {
  console.error("陸地近似マスク生成失敗");
  process.exit(1);
}

// 少し膨らませて沿岸部の欠けを防ぐ
const landBuffer = turf.buffer(landBase, 0.8, { units: "kilometers" });

// 行政境界が使える場合は重ねて最終マスクを作る
let landMask = landBuffer;
if (cityPolygon) {
  const clippedMask = turf.intersect(turf.featureCollection([landBuffer, cityPolygon]));
  if (clippedMask) {
    landMask = clippedMask;
  }
}

// ── 4. Voronoi をマスクでクリップし、properties を転写 ─────────────────
let clippedCount = 0;
let fallbackCount = 0;

const features = voronoi.features.map((poly, i) => {
  const props = points.features[i].properties;
  const clipped = turf.intersect(turf.featureCollection([poly, landMask]));
  if (clipped) {
    clippedCount++;
    return {
      ...clipped,
      properties: props,
    };
  }
  fallbackCount++;
  return {
    ...poly,
    properties: props,
  };
});

const result = turf.featureCollection(features);

// ── 5. 保存 ───────────────────────────────────────────────────────────────
const outPath = resolve(__dirname, "../public/data/towns-voronoi.geojson");
writeFileSync(outPath, JSON.stringify(result, null, 2), "utf8");

console.log(`✓ ${features.length} 町の Voronoi ポリゴンを生成しました`);
console.log(`  マスク内クリップ: ${clippedCount} 件 / フォールバック: ${fallbackCount} 件`);
console.log("出力:", outPath);
console.log("サンプル properties:", JSON.stringify(features[0]?.properties));
