# 等轴森林经营地图 Web 原型

依据《等轴森林经营地图资源需求文档 V1.0》建立的 Phaser 3 + TypeScript + Vite 工程。

## 已实现

- 30° 等轴正交地图，采用 256×148 基准格同比例显示。
- 草地、泥地道路、水面、高地与悬崖分层。
- 树木、灌木、岩石独立物件与脚底 Y Sort。
- 10 类建筑菜单，1×1 逻辑占地、建造消耗、碰撞校验。
- 点击建造、桌面拖放、清理资源、查看格子、视图缩放。
- 手机与桌面自适应 UI。
- 239 项资源槽清单与 47 张自动连接瓦片配置表模板。
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

运行下列命令可依据文档重新生成 239 项资源槽清单和 47 槽位 CSV：

```bash
npm run assets:manifest
```

清单输出到 `public/Art/Map/`。当前原型使用 Phaser 矢量图形验证地图结构与交互；正式 SVG/PNG 可按 `asset_manifest.json` 逐项替换。
