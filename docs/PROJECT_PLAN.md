# Sprite Localization Studio 项目计划

> 更新日期：2026-08-31
> 当前阶段：M5–M8 已完成；M9/M10 正在收口统一高保真渲染、质量与编辑体验。

## 1. 产品定义

Sprite Localization Studio 是面向游戏 UI 贴图的本地化生产工具。应用读取本地工程中的 Texture PNG 与引擎无关 manifest，将 Texture 拆为 Sprite，在 Sprite 内维护多个 TextRegion，并将译文按确定性规则渲染后原位回填 Atlas。

```text
Project → SpriteTable/Atlas → Sprite → TextRegion
                                      ↘ Translation
                                      ↘ TextStyleTemplate + Region Overrides
                                      ↘ BackgroundTemplate/SpriteBackground
Project → Fonts
```

核心输出不是重新 bin-pack Atlas，而是保持原始尺寸、坐标、旋转和裁剪信息不变的 exact-layout reconstruction。目标主链路为：

```text
打开工程 → 选择 Sprite → 选择/上传无字底图 → 编辑译文与样式
        → CanvasKit 高保真预览 → QA → 构造本地化 Texture
```

## 2. 开发原则

1. **工程目录是数据源**：项目 JSON、图片、字体和翻译可被 Git 管理；浏览器数据库只保存目录句柄、偏好和缓存。
2. **Domain 不依赖 Vue**：领域对象是纯 TypeScript 数据，不包含响应式、浏览器或 CanvasKit 对象。
3. **Renderer 可替换**：工程 Schema 不出现 CanvasKit 专属字段；CanvasKit 仅实现 application 渲染端口。
4. **预览与导出同源**：编辑预览和构建消费同一个场景描述、排版结果和渲染器。
5. **变换职责分离**：Atlas Sprite 的 rotation/trim 与 TextRegion rotation 是独立数据。
6. **原始布局不可变**：构建只修改目标 Sprite frame；未编辑区域保持原像素。
7. **Schema 可迁移**：每次持久化格式变化都提供显式 migration 和回归样本。
8. **路径安全稳定**：ID 与名称分离；磁盘路径由应用生成，不能直接拼接未清理的 manifest/sprite ID。
9. **资源生命周期明确**：Blob URL 和 CanvasKit Image/Typeface/Paint/Paragraph/Surface 集中创建、缓存和释放。
10. **先完成确定性主链**：OCR、AI 去字、机器翻译和云协作不阻塞本地生产流程。

## 3. 当前进度

| 能力 | 当前实现 | 状态 |
| --- | --- | --- |
| 框架与工作区 | Vue、Pinia、Router、本地目录、中英文、主题、快捷键 | 已完成 |
| Sprite 数据 | sprite-table manifest、列表、裁剪与方向预览 | 基本完成 |
| TextRegion | 创建、拖拽/键盘微调变换、撤销/重做、持久化 | 基本完成 |
| 翻译工作区 | 连续编辑、预览、底图和样式入口 | 基本完成 |
| 样式 | 多点渐变、描边、多阴影、图层、模板 CRUD 与布局参数 | 已完成 |
| 底图 | 共享模板与 Sprite 专属图片的持久化、选择与 CRUD | 已完成 |
| CanvasKit | 按需 runtime、预览与构建接线、字体缓存、Canvas 2D 保真回退、受限 SkParagraph complex shaping | 进行中，复杂效果与性能验收待收口 |
| 字体 | `fonts/` 扫描、元数据、浏览器注册与编辑器选择 | 已完成 |
| 构建 | localized Texture 回填、输出目录、部分失败报告与失败 Texture 定位 | 已完成 |

当前已形成覆盖 M0–M8 的可操作纵向切片；早期里程碑仍待收口的重点是 Sprite/Region 编辑体验，以及 M9 的复杂脚本 shaping 与性能验收。

## 4. 目标分层

```text
src/
├── app/                    # 启动、路由、i18n、工作区状态
├── application/
│   ├── project/            # 工程加载、保存、migration
│   ├── assets/             # 字体和底图资源用例
│   ├── editor/             # 编辑、模板应用、历史记录
│   ├── renderer/           # Renderer 端口与场景描述
│   └── build/              # Sprite 渲染、逆变换、Atlas 回填
├── domain/                 # project/sprite/text/style/resource/font/build
├── infrastructure/
│   ├── storage/
│   ├── renderer/canvaskit/
│   ├── renderer/canvas2d/  # 迁移期 fallback
│   └── image/
├── components/
├── views/
└── workers/                # 后续大图构建与批量 QA
```

依赖方向为 `views/components → application → domain`；`infrastructure` 实现端口。Vue 组件不能直接持有 CanvasKit 对象或写工程文件。

## 5. Roadmap 总览

| 里程碑 | 结果 | 状态 |
| --- | --- | --- |
| M0 | 工程骨架、本地目录、Schema、桌面应用壳 | 已完成 |
| M1 | Atlas 导入与 Sprite Browser | 基本完成 |
| M2 | TextRegion Editor | 基本完成 |
| M3 | 基础样式与 Canvas 2D 预览 | 基本完成，排版待收口 |
| M4 | Translation Workspace | 基本完成 |
| M5 | Localized Atlas Build | 已完成 |
| M6 | 工程资源与底图模板 | 已完成 |
| M7 | 字体样式模板与多点渐变 | 已完成 |
| M8 | 工程字体管理 | 已完成 |
| M9 | CanvasKit 统一渲染 | 进行中：核心、预览、导出接线与受限 SkParagraph 已完成；复杂效果与性能收口待完成 |
| M10 | QA、性能、代码质量与体验 | 进行中：缺译文构建阻断、布局风险诊断、部分构建失败定位、保存状态与快捷录入已完成 |
| M11+ | 批量、Rich Text、OCR/AI、协作 | 后续 |

## 6. M0–M4 收口事项

- **M0**：CanvasKit bootstrap 延后到 M9；不能把依赖已安装视为接入完成。
- **M1**：补齐包含 `0/90/180/270` 旋转、trim offset、透明边缘和多 Texture 的回归样本。
- **M2**：键盘微调与选中 Region 的就地诊断提示已完成（方向键 1px、Shift+方向键 10px，边界内约束且有无障碍提示）；剩余复制粘贴和稳定缩放坐标换算。
- **M3**：多点渐变、模板 CRUD、字距、换行、垂直对齐、AutoFit、缺字检查在 M7/M9 收口。
- **M4**：筛选、完成状态、批量选择、脏状态、快捷录入和虚拟滚动在 M10 收口。

## 7. 下一阶段：Product Stage 0.2

M5–M10 完成后，应能加载项目字体和模板，使用 CanvasKit 高保真预览，构建 localized Texture，并在重开工程后完整恢复资源引用和视觉结果。

### M5：Localized Atlas Build（首要阻塞项）

#### 范围

- 定义纯 application/domain 的 `BuildLocalizedTextures` 用例及 Renderer/ImageCodec 端口。
- 复制源 Texture；仅为有本地化修改的 Sprite 创建离屏 Surface。
- 合成底图、TextRegion 和效果层，应用 trim/rotation 逆变换并回填原 frame。
- 输出到 `output_textures/<locale>/`，保持源相对路径且绝不覆盖 `textures/`。
- 生成成功、跳过、警告、错误和耗时报告；提供进度、取消和重试。
- 构建读取不可变快照，构建中继续编辑不能污染本次输出。

#### 不变量与验收

- 无修改构建的解码 RGBA 必须与原图 pixel-identical。
- 修改一个 Sprite 时，只有其原 frame 可变化。
- 输出宽高、alpha 语义不变；rotated/trimmed Sprite 回填后再提取与预览一致。
- 对 `D:\Temp\sts_test` 完成真实构建，错误可定位到 Texture、manifest 和 sprite ID。
- 自动化覆盖普通、旋转、裁剪、透明底图、共享底图和专属底图。

### M6：工程资源与底图模板 CRUD

#### Schema 与目录

将临时 `translationBackgrounds` 迁移为显式资源目录：

```text
project.json
├── backgroundTemplates[]
└── spriteBackgrounds[]

sprite_base/
├── template/<resource-id>.<ext>
└── <safe-manifest-id>/<safe-sprite-id>/<resource-id>.<ext>
```

资源至少有 `id/name/path/scope/mimeType` 及可选 `manifestId/spriteId`。原 ID 存 JSON，目录名使用稳定安全编码，防止路径穿越、Windows 保留名和清理后冲突。

```ts
type BackgroundSource =
  | { type: 'original' }
  | { type: 'transparent' }
  | { type: 'template'; resourceId: string }
  | { type: 'sprite'; resourceId: string }
```

#### 功能与验收

- 共享模板支持上传、命名、查询、改名、替换、删除和搜索。
- Sprite 专属图片进入对应 manifest/sprite 目录，不出现在共享列表。
- 编辑器提供含缩略图、名称、类型、尺寸、选中态、空态和失败态的完整 Grid。
- 删除被引用资源时显示引用数，并要求替换或解除引用；禁止悬空 ID。
- 替换按“写新文件 → 更新 JSON → 删除旧文件”执行，失败时原引用仍可用。
- 统一回收 Blob URL；重开工程后选择、缩略图和渲染完整恢复。
- 旧 `translation-backgrounds/` 工程可迁移或兼容读取，不能丢资源。

### M7：字体样式模板 CRUD 与多点渐变

#### 样式模板

`project.json` 增加 `textStyleTemplates[]`。模板含 `id/name/render`；Region 用 `styleId` 引用，并只保存必要 `renderOverrides`：

```text
defaults → referenced template → region overrides
```

- 样式编辑器提供“另存为模板”“覆盖当前模板”“重命名”“删除”。
- 覆盖前显示受影响 Region 数；删除时可替换模板或将有效样式固化为 overrides。
- 内置预设与项目模板明确区分；CRUD 进入撤销/重做和脏状态。
- 旧 Region 的完整 `render` 快照经 migration 后保持原效果。

#### 多点渐变

```ts
interface GradientStop {
  id: string
  offset: number // 0..1，UI 为 0%..100%
  color: string
  alpha: number
}

interface LinearGradientPaint {
  type: 'linear'
  angle: number
  stops: GradientStop[]
}
```

- Stop 使用列表编辑，可新增、删除、复制、拖拽排序或输入百分比；至少保留两个。
- 每点独立控制颜色和透明度，并提供渐变条与实际文字预览。
- 持久化时 offset clamp 到 `0..1`；渲染按 offset 后按列表顺序稳定排序。
- 填充和描边复用同一 Paint 模型；旧二色渐变迁为 `0%/100%` 两点。
- 3–8 个 Stop 保存、重开、模板覆盖和导出结果一致。

### M8：工程字体管理

```text
fonts/
├── Example-Regular.ttf
└── Example-Bold.otf
```

首期保证 TTF/OTF；WOFF/WOFF2 在 CanvasKit 和 metadata 链路验证后再支持。

```ts
interface ProjectFont {
  id: string
  path: string
  family: string
  subfamily?: string
  postscriptName?: string
  weight?: number
  style?: 'normal' | 'italic'
}
```

- 打开工程时扫描 `fonts/` 并读 metadata，以 path/内容指纹建立稳定 ID。
- 统一 FontRegistry 同时注册浏览器 fallback 与 CanvasKit FontMgr。
- 样式编辑器用可搜索下拉框展示 family、字重、样式和来源文件。
- 保留手动输入 CSS/系统字体；明确标识不可移植风险。
- 字体缺失、解析失败、缺 glyph 产生可定位诊断，不静默回退。
- 显式选择的工程字体以扫描 ID 绑定到样式；手动 CSS/系统字体不绑定。工程字体缺失时按 Region 显示非阻断诊断，CanvasKit 原子回退 Canvas 2D。
- 工程关闭或字体变化时释放 Typeface/FontMgr 缓存。
- 两种以上项目字体在预览和导出中一致；删除在用字体会显示诊断。

### M9：CanvasKit 统一渲染

#### 当前进度与剩余收口

- 已接入按需加载的 CanvasKit runtime，并让样式预览、Sprite 预览和 localized texture 导出共享文本渲染核心。
- 已建立软件 Surface 释放、异步旧结果丢弃、项目字体二进制传递与 Canvas 2D 保真回退边界。
- 不支持的系统/CSS 字体、`inside` 描边和非 Hex 颜色必须走 Canvas 2D，不能静默替换为默认 Typeface。
- 已使用 SkParagraph 为项目字体的复杂脚本提供换行、字距、行高、物理对齐、垂直对齐、maxLines/ellipsis 与基准方向 shaping；unresolved glyph 会原子回退 Canvas 2D。
- CanvasKit 直接文本路径同样会在 Glyph ID 为 `0` 时原子回退 Canvas 2D，避免导出缺字占位符（已完成）。
- SkParagraph 目前只承接纯实色填充、无有效描边/阴影/图层、`wrap=true` 且无 AutoFit 的 Region；渐变、效果、未知方向脚本和不满足等价条件的文字保持完整 Canvas 2D 回退。
- CanvasKit 0.42 的 `ShapeText` 绑定尚未通过真实非 ASCII 字体运行时验证；复杂文本使用已验证的 Paragraph 路径，不能以 mock 结果替代视觉验收。
- Typeface、Paragraph 与 Surface 的释放路径已有回归覆盖；仍需在真实运行时采样复用与内存曲线，并基于 profile 决定是否引入 Worker/OffscreenCanvas。

#### 架构与功能

- 定义框架无关的 `RenderScene`、`TextLayoutResult`、`SpriteRenderer` 和资源缓存。
- Vue 只提交序列化场景；adapter 管理 Surface、Image、Typeface、Paragraph 和 Paint。
- Canvas 2D 仅保留为初始化失败时的 fallback，不再新增效果。
- 预览、缩略图和 M5 构建调用同一 CanvasKit 核心。
- 用 SkParagraph 实现换行、水平/垂直对齐、字距、行高、max lines 和 overflow。
- 二分搜索实现 AutoFit，领域参数包含 `minFontSize/maxFontSize/maxLines`。
- 用 SkPaint/Shader 实现多点渐变填充/描边、多描边/阴影图层和 Region rotation。
- 固定 alpha、抗锯齿、DPR、颜色空间与像素取整规则；异步请求防止旧结果覆盖新编辑。
- 所有带 `.delete()` 的对象有所有权测试和开发期泄漏计数。

#### 性能与验收

- 常规 Sprite 输入到预览目标小于 50 ms；大图可降频但不阻塞输入。
- 字体、Texture 和共享底图按工程缓存，只重算变化的依赖。
- Worker/OffscreenCanvas 由 profiling 决定，不复制两套渲染逻辑。
- 同一 RenderScene 在预览、缩略图和导出中一致。
- 中文、日文、拉丁文、多行、旋转、AutoFit、渐变、描边、阴影有回归样本。
- 连续切换 200 个 Sprite 后内存趋稳。

### M10：QA、代码质量与用户体验

- Region 诊断：缺译文、overflow、AutoFit 触底、缺字体/glyph、缺底图、悬空模板、渲染失败。
- 构建前运行项目 QA；缺译文错误已阻止导出且可跳到对应 Sprite/Region。工作区使用实际 Canvas 测量显示 overflow、AutoFit 最小字号与显式工程字体缺失警告；单个 Texture 构建失败后继续处理其余任务，并报告 SpriteTable、Texture、源路径、可用时的 Sprite ID 和错误消息；继续补齐 glyph、缺资源和渲染失败诊断。
- 显示脏状态、保存中/失败和最近成功保存时间（已完成）。
- 选中的 TextRegion 支持键盘精确移动：方向键移动 1px，Shift+方向键移动 10px，并在 Sprite 边界内约束（已完成）。
- Sprite 检查器直接展示选中 TextRegion 的缺译文、overflow、AutoFit 和工程字体诊断，并按当前 Region 限定计算以避免编辑时扫描全项目（已完成）。
- 支持按 manifest、完成状态、错误和关键词筛选；Grid/List 虚拟化或按需生成缩略图。
- 补齐上一项/下一项、保存、撤销/重做、删除、Region 微调和快速聚焦译文快捷键。
- 删除、覆盖模板、替换资源时显示准确影响范围。
- 新文案进入 locale；检查焦点、标签、对比度、缩放、窄窗口和双主题。
- 大组件拆为容器、无状态表单和 application use case；组件不直接修改持久化对象。
- 工程边界使用 Zod 或等价 schema 返回明确错误路径；写入统一经 Repository 串行化。
- migration、路径安全、资源引用、样式合并、渐变、rotation/trim、字体 fallback 和构建不变量均有测试。

每个里程碑完成时运行：

```text
pnpm type-check
pnpm test:unit --run
pnpm lint
pnpm build
```

## 8. 推荐 Agent 工作包

同一时间避免多个 agent 同时修改 `ProjectManifest` 和 `ProjectRepository`。

| 工作包 | 内容 | 主要边界 | 依赖 |
| --- | --- | --- | --- |
| A：Schema/Migration | v1→v2、样式/底图/字体模型、验证 | `domain/project`、`application/project` | 最先合并 |
| B：Atlas Build | 构建、逆变换、回填、PNG、不变量测试 | `application/build`、`infrastructure/image` | A |
| C：底图资源 | 两类资源 Repository、目录、CRUD、Grid | `application/assets`、底图 UI | A |
| D：样式/渐变 | 模板 CRUD、override、多 Stop 编辑器 | `domain/style`、样式 UI | A |
| E：Font Registry | 扫描、metadata、注册、字体选择器 | `domain/font`、assets | A |
| F：CanvasKit Core | WASM 生命周期、Renderer、资源所有权 | `infrastructure/renderer/canvaskit` | A，可并行 |
| G：排版与效果 | SkParagraph、AutoFit、字体、效果、overflow | CanvasKit text renderer | D+E+F |
| H：集成/UX/QA | 接线、诊断、性能、可访问性、回归 | views/components、QA | B+C+G |

```text
A → B/C/D/E/F（可并行）
D + E + F → G
B + C + G → H → Product Stage 0.2 验收
```

每个包必须带领域/应用测试；UI 包补可见行为测试。Agent 不应顺手重构边界外模块。

## 9. Product Stage 0.2 验收清单

- [ ] 共享底图模板和 Sprite 专属底图均可选择、CRUD 并按约定目录落盘。
- [ ] 样式可另存、覆盖、更新、删除项目模板，引用安全。
- [ ] 渐变支持多个位置点、百分比、颜色和透明度。
- [ ] `fonts/` 字体可发现、选择，并用于 CanvasKit 预览与导出。
- [ ] 手动字体名称可用，且不可移植风险可见。
- [ ] CanvasKit 是预览、缩略图和导出的统一渲染器。
- [ ] localized Texture 通过无修改/单 Sprite 修改像素不变量测试。
- [ ] 重开 `D:\Temp\sts_test` 后资源、模板、字体和效果完整恢复。
- [ ] 构建前 QA 可定位 overflow、缺字、缺资源和悬空引用。
- [ ] type-check、unit tests、lint、build 全部通过。

## 10. 后续路线

- **M11 批量生产**：批量 Style/Background/Region、复制粘贴、查找替换、相似 Sprite 分组和问题筛选。
- **M12 Rich Text**：有限 markup → AST → SkParagraph spans；首期仅 bold、italic、color、size。
- **M13 OCR/AI Provider**：OCR 只初始化 sourceText，AI 去字只生成候选底图，失败不破坏手工作业。
- **M14 交换与协作**：CSV/XLIFF、Git 友好拆分、TMS 对接；审核、评论和多人协作后置。

## 11. 仍明确不做

- Unity/Unreal/Cocos 资源提取与包体回写；继续消费引擎无关 Texture + manifest。
- 重新 bin-pack Atlas 或修改原游戏 UV/layout。
- Stage 0.2 前引入服务端、用户系统和实时协作。
- 把 CanvasKit 专属对象或枚举写入 `project.json`。
- 未经 profiling 同时维护主线程与 Worker 两套渲染实现。
