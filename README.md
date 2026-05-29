# 長崎市 GIS データ可視化マップ

長崎市の地図上に、市境界・65歳以上人口（町輪郭）・小売店データを重ねて表示する Web アプリです。

- フレームワーク: Next.js 16 (App Router)
- 地図ライブラリ: React Leaflet
- ベースマップ: 国土地理院タイル / OpenStreetMap
- デプロイ: GitHub Pages（静的エクスポート）

## 主な表示機能

| レイヤー | 内容 |
|---|---|
| 長崎市境界 | 市全体の境界ポリゴン |
| 65歳以上人口 | 町ごとの輪郭ポリゴン（青系グラデーション） |
| スーパーマーケット（OSM） | 赤丸マーカー |
| 拡張データ | 業態別アイコンマーカー |

補足:
- 人口輪郭は `towns-voronoi.geojson` を使用しています。
- 店舗マーカーは人口輪郭より前面に表示されるようにしています。
- 町の詳細は輪郭を左クリックすると表示されます。

## セットアップ

### 必要環境

- Node.js 18 以上
- npm

### インストール

```bash
cd nagasaki-map
npm install
```

## 起動とビルド

### 開発サーバー

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開いてください。

### 本番ビルド（静的エクスポート）

```bash
npm run build
```

`next.config.ts` で `output: "export"` を指定しているため、成果物は `out` ディレクトリに出力されます。

## GitHub Pages 運用（master 反映内容）

master ブランチへの push で GitHub Actions が走り、Pages へ自動デプロイされます。

- ワークフロー: `.github/workflows/deploy.yml`
- トリガー: `master` への push
- ビルド後に `out/.nojekyll` を作成（`_next` 配下アセットの配信問題を回避）

basePath 対応:
- `next.config.ts` で本番時に `basePath: "/nagasaki-map"` を設定
- 同値を `NEXT_PUBLIC_BASE_PATH` に渡し、`fetch("${process.env.NEXT_PUBLIC_BASE_PATH}/...")` で参照

## データファイル

主要データは `public/data` 配下です。

- `nagasaki-city.geojson`: 長崎市境界
- `population2.json`: 65歳以上人口の点データ（元データ）
- `towns-voronoi.geojson`: 町輪郭ポリゴン（表示に使用。海側はみ出し抑制クリップ済み）
- `supermarkets.json`: OSM（Overpass）由来のスーパー点データ（OSM表示で使用）
- `supermarkets2.json`: 手動補正版スーパー点データ（予備データ）
- `retail_stores_nagasaki.json`: 拡張小売店データ

## 参考スクリプト

- `scripts/gen-voronoi.mjs`
  - `population2.json` から Voronoi ポリゴンを生成
  - 点群から作る陸地近似マスク + 市境界でクリップし、海側のはみ出しを抑制
  - `towns-voronoi.geojson` を再作成

- `scripts/regeocode-retail.mjs`
  - `retail_stores_nagasaki.json` の住所をもとに座標を一括再ジオコーディング
  - 店舗座標ずれの一括補正に利用

## データ出典

- 地図タイル: 国土地理院
- 店舗位置: OpenStreetMap contributors
- 人口データ: 参考値（必要に応じて e-Stat 等の公的データで更新）
