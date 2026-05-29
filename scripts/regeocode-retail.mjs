import { readFileSync, writeFileSync } from "fs";
import { execFileSync } from "child_process";
import { resolve } from "path";

const filePath = resolve("./public/data/retail_stores_nagasaki.json");
const stores = JSON.parse(readFileSync(filePath, "utf8"));

function geocode(address) {
  const q = address.startsWith("長崎県") ? address : `長崎県${address}`;
  const url = `https://geocode.csis.u-tokyo.ac.jp/cgi-bin/simple_geocode.cgi?addr=${encodeURIComponent(q)}&charset=UTF8`;
  try {
    const xml = execFileSync("curl", ["-sS", url], { encoding: "utf8" });
    const lonMatch = xml.match(/<longitude>([^<]+)<\/longitude>/);
    const latMatch = xml.match(/<latitude>([^<]+)<\/latitude>/);
    const lvlMatch = xml.match(/<iLvl>([^<]+)<\/iLvl>/);
    if (!lonMatch || !latMatch) return null;
    return {
      lon: Number(lonMatch[1]),
      lat: Number(latMatch[1]),
      level: lvlMatch ? Number(lvlMatch[1]) : null,
    };
  } catch {
    return null;
  }
}

let updated = 0;
let failed = 0;

const out = stores.map((s) => {
  const result = geocode(s.address);
  if (!result) {
    failed += 1;
    return s;
  }

  // 番地レベル(8)優先。取れない場合も候補があれば更新。
  const next = {
    ...s,
    lat: Number(result.lat.toFixed(6)),
    lng: Number(result.lon.toFixed(6)),
  };

  if (Math.abs(next.lat - s.lat) > 0.00001 || Math.abs(next.lng - s.lng) > 0.00001) {
    updated += 1;
  }

  return next;
});

writeFileSync(filePath, JSON.stringify(out, null, 2), "utf8");

console.log(`total: ${stores.length}`);
console.log(`updated: ${updated}`);
console.log(`failed: ${failed}`);
