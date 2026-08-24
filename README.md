# Sprite Localization Studio

面向游戏 UI Sprite Atlas 的本地化生产工具。项目读取本地目录中的 Texture、manifest、翻译与字体资源，在 Sprite-local 坐标中维护 TextRegion，并按原始布局确定性地构建本地化 Atlas。

详细产品边界、架构原则与里程碑见 [项目计划](docs/PROJECT_PLAN.md)。

## 当前进度

当前处于 M0 工程骨架阶段，已经包含：

- Vue 3、TypeScript、Vite、Vue Router 与 Pinia 应用壳。
- Tailwind CSS v4 与 shadcn-vue 兼容的组件配置。
- 中英文界面与亮色/暗色主题切换。
- 文件菜单、工程树、工作区、属性面板和状态栏组成的桌面级操作界面。
- Project、Atlas、Sprite、TextRegion、TextStyle、Translation 等纯 TypeScript 领域模型。
- 与运行环境无关的 `ProjectStorage` 接口。
- 基于 File System Access API 的 `LocalFolderStorage`。
- 打开本地工程、读取 `project.json`、修改名称并保存的基础链路。
- 在空文件夹中新建工程，且不覆盖已有 `project.json`。

CanvasKit 会在下一开发切片接入。目前没有加入 OCR、AI、服务端或特定游戏引擎适配器。

## 本地工程格式

当前可打开的最小 `project.json`：

```json
{
  "schemaVersion": 1,
  "name": "My Game Localization"
}
```

浏览器必须支持 File System Access API，建议使用最新版 Chrome、Edge 或 Brave。工程数据直接保存在用户选择的目录中。

## 开发

要求 Node.js `^22.18.0 || >=24.12.0` 与 pnpm 11。

```sh
pnpm install
pnpm dev
```

## 检查

```sh
pnpm type-check
pnpm test:unit --run
pnpm lint
pnpm build
```

实现新界面时优先使用现有依赖：Tailwind 负责样式，shadcn-vue/CVA 模式负责通用组件，Lucide 负责图标，Pinia 与 Router 分别负责会话状态和页面导航。只有出现真实需求时才增加依赖。
