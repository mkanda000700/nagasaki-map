"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Marker,
  Popup,
  LayersControl,
  Tooltip,
} from "react-leaflet";
import type { Feature, GeoJsonObject } from "geojson";
import type { PathOptions, Layer, Path } from "leaflet";
import L from "leaflet";
import MapLegend from "./MapLegend";

// エリア別カラー
const AREA_COLORS: Record<string, string> = {
  "中心部": "#ef4444",
  "東部":   "#f59e0b",
  "南部":   "#10b981",
  "北部":   "#3b82f6",
};

// 種別アイコン（絵文字）
const TYPE_ICONS: Record<string, string> = {
  "スーパー":   "🛒",
  "コンビニ":   "🏪",
  "個人商店":   "🏬",
};

function makeRetailIcon(area: string, type: string) {
  const color = AREA_COLORS[area] ?? "#6b7280";
  const emoji = TYPE_ICONS[type] ?? "📍";
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      border:2px solid white;
      border-radius:50%;
      width:30px;
      height:30px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:15px;
      box-shadow:0 2px 5px rgba(0,0,0,0.35);
    ">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

const { BaseLayer, Overlay } = LayersControl;

interface SupermarketElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface RetailStore {
  id: number;
  name: string;
  type: string;
  chain: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
}

interface PopulationRecord {
  id: number;
  name: string;
  lat: number;
  lng: number;
  population: number;
  area_km2: number;
}

// 人口に応じた色を返す
function getPopulationColor(population: number): string {
  if (population > 22000) return "#084594";
  if (population > 18000) return "#2171b5";
  if (population > 14000) return "#4292c6";
  if (population > 10000) return "#6baed6";
  if (population > 7000) return "#9ecae1";
  return "#c6dbef";
}

// 人口に応じた円の半径を返す
function getPopulationRadius(population: number): number {
  return Math.sqrt(population) / 4;
}

export default function NagasakiMap() {
  const [cityBoundary, setCityBoundary] = useState<GeoJsonObject | null>(null);
  const [supermarkets, setSupermarkets] = useState<SupermarketElement[]>([]);
  const [retailStores, setRetailStores] = useState<RetailStore[]>([]);
  const [supermarketMode, setSupermarketMode] = useState<"osm" | "retail">("osm");
  const [population, setPopulation] = useState<PopulationRecord[]>([]);

  useEffect(() => {
    // 市境界GeoJSONの読み込み
    fetch("/data/nagasaki-city.geojson")
      .then((r) => r.json())
      .then(setCityBoundary)
      .catch(console.error);

    // スーパーマーケットデータの読み込み（OSM）
    fetch("/data/supermarkets2.json")
      .then((r) => r.json())
      .then((d) => setSupermarkets(d.elements ?? []))
      .catch(console.error);

    // 小売店データの読み込み（拡張）
    fetch("/data/retail_stores_nagasaki.json")
      .then((r) => r.json())
      .then(setRetailStores)
      .catch(console.error);

    // 人口統計データの読み込み
    fetch("/data/population.json")
      .then((r) => r.json())
      .then(setPopulation)
      .catch(console.error);
  }, []);

  const cityStyle: PathOptions = {
    color: "#d97706",
    weight: 2.5,
    opacity: 0.9,
    fillColor: "#fef3c7",
    fillOpacity: 0.15,
  };

  const onEachCityFeature = (feature: Feature, layer: Layer) => {
    const name = (feature.properties as Record<string, string>)?.name ?? "長崎市";
    (layer as Path).bindPopup(`<strong>${name}</strong>`);
  };

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      {/* スーパーマーケットデータ切り替えボタン */}
      <div
        style={{
          position: "absolute",
          top: "10px",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 1000,
          display: "flex",
          gap: "4px",
          background: "white",
          padding: "6px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <button
          onClick={() => setSupermarketMode("osm")}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "2px solid #ef4444",
            background: supermarketMode === "osm" ? "#ef4444" : "white",
            color: supermarketMode === "osm" ? "white" : "#ef4444",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          OSMデータ
        </button>
        <button
          onClick={() => setSupermarketMode("retail")}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "2px solid #8b5cf6",
            background: supermarketMode === "retail" ? "#8b5cf6" : "white",
            color: supermarketMode === "retail" ? "white" : "#8b5cf6",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          拡張データ
        </button>
      </div>

      <MapContainer
        center={[32.7503, 129.8777]}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
      <LayersControl position="topright">
        {/* ベースマップ */}
        <BaseLayer checked name="地理院標準地図">
          <TileLayer
            url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
            attribution='<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>'
            maxZoom={18}
          />
        </BaseLayer>
        <BaseLayer name="地理院淡色地図">
          <TileLayer
            url="https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"
            attribution='<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>'
            maxZoom={18}
          />
        </BaseLayer>
        <BaseLayer name="OpenStreetMap">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
        </BaseLayer>

        {/* 長崎市境界 */}
        <Overlay checked name="長崎市境界">
          {cityBoundary && (
            <GeoJSON
              data={cityBoundary}
              style={cityStyle}
              onEachFeature={onEachCityFeature}
            />
          )}
        </Overlay>

        {/* 人口統計 */}
        <Overlay checked name="人口統計（地区別）">
          <>
            {population.map((d) => (
              <CircleMarker
                key={d.id}
                center={[d.lat, d.lng]}
                radius={getPopulationRadius(d.population)}
                pathOptions={{
                  fillColor: getPopulationColor(d.population),
                  fillOpacity: 0.75,
                  color: "#fff",
                  weight: 1,
                }}
              >
                <Tooltip direction="top" offset={[0, -5]}>
                  <strong>{d.name}</strong>
                  <br />
                  人口: {d.population.toLocaleString()} 人
                  <br />
                  面積: {d.area_km2} km²
                  <br />
                  人口密度: {Math.round(d.population / d.area_km2).toLocaleString()} 人/km²
                </Tooltip>
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold text-base mb-1">{d.name}</p>
                    <table className="text-xs">
                      <tbody>
                        <tr>
                          <td className="pr-2 text-gray-500">人口</td>
                          <td className="font-semibold">{d.population.toLocaleString()} 人</td>
                        </tr>
                        <tr>
                          <td className="pr-2 text-gray-500">面積</td>
                          <td className="font-semibold">{d.area_km2} km²</td>
                        </tr>
                        <tr>
                          <td className="pr-2 text-gray-500">人口密度</td>
                          <td className="font-semibold">
                            {Math.round(d.population / d.area_km2).toLocaleString()} 人/km²
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </>
        </Overlay>

        {/* スーパーマーケット */}
        <Overlay checked name="スーパーマーケット">
          <>
            {supermarketMode === "osm"
              ? supermarkets.map((s) => (
                  <CircleMarker
                    key={s.id}
                    center={[s.lat, s.lon]}
                    radius={7}
                    pathOptions={{
                      fillColor: "#ef4444",
                      fillOpacity: 0.9,
                      color: "#fff",
                      weight: 1.5,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -5]}>
                      {s.tags?.name ?? "スーパーマーケット"}
                    </Tooltip>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold text-base mb-1">
                          🛒 {s.tags?.name ?? "スーパーマーケット"}
                        </p>
                        {s.tags?.["addr:full"] && (
                          <p className="text-gray-600">{s.tags["addr:full"]}</p>
                        )}
                        {s.tags?.["addr:city"] && s.tags?.["addr:street"] && (
                          <p className="text-gray-600">
                            {s.tags["addr:city"]} {s.tags["addr:street"]}
                          </p>
                        )}
                        {s.tags?.["opening_hours"] && (
                          <p className="text-xs text-gray-500 mt-1">
                            🕐 {s.tags["opening_hours"]}
                          </p>
                        )}
                        {s.tags?.["brand"] && (
                          <p className="text-xs text-gray-500">
                            🏪 {s.tags["brand"]}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
              : retailStores.map((s) => (
                  <Marker
                    key={s.id}
                    position={[s.lat, s.lng]}
                    icon={makeRetailIcon(s.area, s.type)}
                  >
                    <Tooltip direction="top" offset={[0, -18]}>
                      {s.name}
                    </Tooltip>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold text-base mb-1">
                          {TYPE_ICONS[s.type] ?? "📍"} {s.name}
                        </p>
                        <p className="text-gray-600">{s.address}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          🏪 {s.chain} / {s.type}
                        </p>
                        <p className="text-xs text-gray-500">
                          📍 {s.area}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
          </>
        </Overlay>
      </LayersControl>

      <MapLegend />
    </MapContainer>
    </div>
  );
}
