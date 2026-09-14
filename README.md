# 等轴森林经营地图 Web 原型

依据《等轴森林经营地图资源需求文档 V1.0》建立的 Phaser 3 + TypeScript + Vite 工程。

## 已实现

- 30° 等轴正交地图，采用 256×148 基准格同比例显示。
- 草地、泥地道路、水面、高地与悬崖分层。
- 树木、灌木、岩石独立物件与脚底 Y Sort。
- 10 类建筑菜单，1×1 逻辑占地、建造消耗、碰撞校验。
- 点击建造、桌面拖放、清理资源、查看格子、视图缩放。
- 手机与桌面自适应 UI。
- 239 个静态 SVG 成品：173 张地形、56 个场景物件、10 个建筑。
- 47 张自动连接瓦片与完整有效邻接掩码配置表。
- GitHub Actions 自动构建并上传 `dist` Web 包。

## 本地运行

```bash
npm install
npm run dev
```

## 打包

```bash
npm run build
```

产物位于 `dist/`。`vite.config.ts` 使用相对资源路径，可直接部署到任意静态托管目录。

## 美术资源

运行下列命令可依据文档重新生成并校验全部静态 SVG：

```bash
npm run assets:generate
npm run assets:validate
```

资源输出到 `public/Art/Map/`，目录、命名、尺寸与数量由 `asset_manifest.json` 统一记录。Phaser 运行时直接加载 SVG，主体地图美术不再由 `Graphics` 动态绘制。
