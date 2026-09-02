# Sprite Localization Studio

Sprite Localization Studio 是一款面向游戏 UI Sprite Atlas 的本地化工具。它读取游戏资源工具生成的 Texture 与 manifest，在本地工作区中管理 Sprite、文字区域和翻译，并生成保持原始 Atlas 布局的本地化贴图。

项目采用纯前端架构，工程文件直接保存在用户选择的本地目录中。

## 网页版本

点击这里: https://samnyan.github.io/sprite-localization-studio/

## Input Format

游戏资源的 unpack 与 repack 由游戏专用工具负责。生成 Studio 输入时，请遵循 [Sprite Localization Input Format v1](documents/sprite-table-manifest-v1.md)。

## Development

需要 Node.js `^22.18.0 || >=24.12.0` 和 pnpm 11。

```sh
pnpm install
pnpm dev
```

本地目录访问需要支持 File System Access API 的 Chromium 浏览器。
