"use client";

import { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Marker,
  Popup,
  LayersControl,
  Tooltip,
  useMap,
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

// 人口に応じた色を返す
function getPopulationColor(population: number): string {
  if (population > 1000) return "#084594";
  if (population > 700) return "#2171b5";
  if (population > 500) return "#4292c6";
  if (population > 300) return "#6baed6";
  if (population > 100) return "#9ecae1";
  return "#c6dbef";
}

function MapPanes() {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane("townPane")) {
      const townPane = map.createPane("townPane");
      townPane.style.zIndex = "430";
      townPane.style.pointerEvents = "auto";
    }
    if (!map.getPane("storePane")) {
      const storePane = map.createPane("storePane");
      storePane.style.zIndex = "650";
      storePane.style.pointerEvents = "auto";
    }

    const tooltipPane = map.getPane("tooltipPane");
    if (tooltipPane) {
      tooltipPane.style.zIndex = "800";
    }

    const popupPane = map.getPane("popupPane");
    if (popupPane) {
      popupPane.style.zIndex = "810";
    }
  }, [map]);

  return null;
}


// ---- 町輪郭レイヤー（Voronoi GeoJSON を Leaflet で直接描画）----
function TownLayer({
  data,
  visible,
}: {
  data: GeoJsonObject | null;
  visible: boolean;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!data) return;

    const popup = L.popup();

    const geoLayer = L.geoJSON(data, {
      pane: "townPane",
      style: (feature) => {
        const pop =
          (feature?.properties as Record<string, number>)
            ?.population_age_65_and_over ?? 0;
        return {
          fillColor: getPopulationColor(pop),
          fillOpacity: 0.55,
          color: "#ffffff",
          weight: 0.8,
        };
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties as {
          town_name: string;
          population_age_65_and_over: number;
        };
        const baseColor = getPopulationColor(props.population_age_65_and_over);
        const detailHtml =
          `<strong>${props.town_name}</strong><br/>` +
          `65歳以上人口: ${props.population_age_65_and_over.toLocaleString()} 人`;

        layer.on("mouseover", (e: L.LeafletMouseEvent) => {
          (layer as L.Path).setStyle({
            fillOpacity: 0.9,
            color: "#fff",
            weight: 2,
          });
        });
        layer.on("mouseout", () => {
          (layer as L.Path).setStyle({
            fillColor: baseColor,
            fillOpacity: 0.55,
            color: "#ffffff",
            weight: 0.8,
          });
        });
        layer.on("click", (e: L.LeafletMouseEvent) => {
          popup
            .setLatLng(e.latlng)
            .setContent(
              `<strong style="font-size:13px">${props.town_name}</strong><br/>` +
                `<span style="font-size:12px">65歳以上人口: <strong>${props.population_age_65_and_over.toLocaleString()}</strong> 人</span>`
            )
            .openOn(map);
        });
      },
    });

    layerRef.current = geoLayer;
    geoLayer.addTo(map);

    return () => {
      geoLayer.remove();
      popup.remove();
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, data]);

  // 表示/非表示の切り替え
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (visible) {
      layer.addTo(map);
    } else {
      layer.remove();
    }
  }, [map, visible]);

  return null;
}
// -----------------------------------------------------------------------

export default function NagasakiMap() {
  const [cityBoundary, setCityBoundary] = useState<GeoJsonObject | null>(null);
  const [supermarkets, setSupermarkets] = useState<SupermarketElement[]>([]);
  const [retailStores, setRetailStores] = useState<RetailStore[]>([]);
  const [supermarketMode, setSupermarketMode] = useState<"osm" | "retail">("osm");
  const [townsGeoJSON, setTownsGeoJSON] = useState<GeoJsonObject | null>(null);
  const [populationVisible, setPopulationVisible] = useState(true);

  useEffect(() => {
    // 市境界GeoJSONの読み込み
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/nagasaki-city.geojson`)
      .then((r) => r.json())
      .then(setCityBoundary)
      .catch(console.error);

    // スーパーマーケットデータの読み込み（OSM / Overpass取得版）
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/supermarkets.json`)
      .then((r) => r.json())
      .then((d) => setSupermarkets(d.elements ?? []))
      .catch(console.error);

    // 小売店データの読み込み（拡張）
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/retail_stores_nagasaki.json`)
      .then((r) => r.json())
      .then(setRetailStores)
      .catch(console.error);

    // 町輪郭 Voronoi GeoJSON の読み込み（65歳以上人口付き）
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/towns-voronoi.geojson`)
      .then((r) => r.json())
      .then(setTownsGeoJSON)
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
        <div style={{ width: "1px", background: "#e5e7eb", margin: "2px 4px" }} />
        <button
          onClick={() => setPopulationVisible((v) => !v)}
          style={{
            padding: "6px 14px",
            borderRadius: "6px",
            border: "2px solid #10b981",
            background: populationVisible ? "#10b981" : "white",
            color: populationVisible ? "white" : "#10b981",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
          }}
        >
          65歳以上人口
        </button>
      </div>

      <MapContainer
        center={[32.7503, 129.8777]}
        zoom={13}
        preferCanvas={false}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
      <MapPanes />
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

        {/* 65歳以上人口（Canvasレイヤー / ボタンで表示切替） */}

        {/* スーパーマーケット */}
        <Overlay checked name="スーパーマーケット">
          <>
            {supermarketMode === "osm"
              ? supermarkets.map((s) => (
                  <CircleMarker
                    key={s.id}
                    center={[s.lat, s.lon]}
                    pane="storePane"
                    radius={7}
                    pathOptions={{
                      fillColor: "#ef4444",
                      fillOpacity: 0.9,
                      stroke: false,
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
                    pane="storePane"
                    icon={makeRetailIcon(s.area, s.type)}
                  >
                    <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
                      <div>
                        <div><strong>{s.name}</strong></div>
                        <div>{s.chain} / {s.type}</div>
                        <div>{s.address}</div>
                      </div>
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
      {/* 町輪郭レイヤー（MapContainer 内で useMap を使うためここに配置） */}
      {townsGeoJSON && (
        <TownLayer data={townsGeoJSON} visible={populationVisible} />
      )}
    </MapContainer>
    </div>
  );
}
