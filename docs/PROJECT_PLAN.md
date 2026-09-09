# Sprite Localization Studio 项目计划

> 更新日期：2026-09-02
> 当前阶段：M0–M8 已完成；M10 的主要 QA/交互交付已落地。M9 仍在收口：CanvasKit 与 Canvas 2D 回退必须在预览、缩略图和导出之间保持可解释、可复现的结果与性能。

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
| 框架与工作区 | Vue、Pinia、Router、本地目录、中英文、主题、快捷键、工程根节点重命名 | 已完成 |
| Sprite 数据 | sprite-table manifest、树形导航、裁剪/旋转预览、虚拟化 Grid、散件 Sprite 目录导入 | 已完成 |
| TextRegion | 拖拽或一键整图创建、稳定坐标、旋转边界变换、键盘微调、复制/粘贴、撤销/重做、持久化 | 已完成 |
| 翻译工作区 | 跨表连续编辑、筛选/诊断定位、原图/输出效果对比预览、底图和样式入口 | 已完成 |
| 样式 | 字体模板/单独样式、保存覆盖删除、多点渐变、描边圆角、阴影、字重与布局参数 | 已完成；可编辑的 Photoshop 式效果图层列表仍属后续 |
| 底图 | 共享图片模板 Grid CRUD；单行翻译可使用独立图片，但不作为模板管理 | 已完成 |
| CanvasKit | 按需 runtime、预览与构建接线、字体缓存、Canvas 2D 保真回退、受限 SkParagraph complex shaping | 进行中；运行时仍可能回退 Canvas 2D，统一渲染与性能验收未完成 |
| 字体 | `fonts/` 扫描、元数据、浏览器注册与编辑器选择 | 已完成 |
| 构建 | localized Texture 回填、散件目录保持、进度、完成通知、部分失败报告与失败 Texture 定位 | 已完成 |
| 编辑体验 | 工作区背景同步、缩放过滤、通用图片预览、右键菜单、可访问状态播报 | M10 已完成主要交付 |

当前已形成覆盖 M0–M8 的完整生产主链，并提前完成了多项 M10 体验工作。后续优先级应是渲染一致性与性能验收，而非再扩展基础编辑能力。

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
| M1 | Atlas 导入与 Sprite Browser | 已完成 |
| M2 | TextRegion Editor | 已完成 |
| M3 | 基础样式与 Canvas 2D 预览 | 已完成；视觉垂直居中与圆角描边已收口 |
| M4 | Translation Workspace | 已完成 |
| M5 | Localized Atlas Build | 已完成 |
| M6 | 工程资源与底图模板 | 已完成 |
| M7 | 字体样式模板与多点渐变 | 已完成 |
| M8 | 工程字体管理 | 已完成 |
| M9 | CanvasKit 统一渲染 | 进行中：核心、预览、导出接线与受限 SkParagraph 已完成；仍需收口运行时 renderer 一致性、复杂效果与性能 |
| M10 | QA、性能、代码质量与体验 | 进行中：QA、筛选、虚拟 Sprite Grid、构建反馈、图片对比预览与多项编辑体验已完成；性能 profiling、翻译表虚拟化与可访问性完整验收待完成 |
| M11+ | 批量、Rich Text、OCR/AI、协作 | 后续 |

## 6. M0–M4 收口事项

- **M0**：CanvasKit bootstrap 延后到 M9；不能把依赖已安装视为接入完成。
- **M1**：已具备旋转/裁剪 Sprite 展示、虚拟化 Grid 与散件目录导入。后续仅补充真实工程的 `0/90/180/270`、trim offset、透明边缘和多 Texture 回归样本。
- **M2**：键盘微调、就地诊断、复制/粘贴、稳定 SVG CTM 坐标换算、一键整图 Region，以及旋转后的边界计算均已完成。
- **M3**：多点渐变、模板 CRUD、字距、换行、视觉垂直居中、AutoFit、缺字检查和圆角描边已收口；可编辑的多效果图层编排不在本里程碑范围。
- **M4**：多条件筛选（SpriteTable/全部表、关键词、完成状态、QA 问题）、状态统计、一键清除、跨表写回及原图/输出效果对比预览已完成；批量选择与翻译表虚拟滚动留待后续。

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
- 单行翻译可上传独立底图并进入对应 manifest/sprite 目录；它不是图片模板，不出现在共享模板列表。
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

- 已接入按需加载的 CanvasKit runtime，并让样式预览、Sprite 预览和 localized texture 导出共享文本场景、排版与视觉垂直居中计算。
- 已建立软件 Surface 释放、异步旧结果丢弃、项目字体二进制传递与 Canvas 2D 保真回退边界。
- CanvasKit 是否实际采用由字体、效果和运行时能力决定；开发日志以 debug 级别记录预览/导出所选 renderer 与回退原因。当前已观测到 Canvas 2D 回退，因此不能将“已接线”记为“已统一”。
- 不支持的系统/CSS 字体、`inside` 描边和非 Hex 颜色必须走 Canvas 2D，不能静默替换为默认 Typeface。
- 已使用 SkParagraph 为项目字体的复杂脚本提供换行、字距、行高、物理对齐、垂直对齐、maxLines/ellipsis 与基准方向 shaping；unresolved glyph 会原子回退 Canvas 2D。
- CanvasKit 直接文本路径同样会在 Glyph ID 为 `0` 时原子回退 Canvas 2D，避免导出缺字占位符（已完成）。
- SkParagraph 目前只承接纯实色填充、无有效描边/阴影/图层、`wrap=true` 且无 AutoFit 的 Region；渐变、效果、未知方向脚本和不满足等价条件的文字保持完整 Canvas 2D 回退。
- CanvasKit 0.42 的 `ShapeText` 绑定尚未通过真实非 ASCII 字体运行时验证；复杂文本使用已验证的 Paragraph 路径，不能以 mock 结果替代视觉验收。
- Typeface、Paragraph 与 Surface 的释放路径已有回归覆盖；每次贴图构建任务会记录并展示总耗时，作为真实工程 profiling 的基线。仍需采样复用与内存曲线，并基于 profile 决定是否引入 Worker/OffscreenCanvas。

#### 架构与功能

- 定义框架无关的 `RenderScene`、`TextLayoutResult`、`SpriteRenderer` 和资源缓存。
- Vue 只提交序列化场景；adapter 管理 Surface、Image、Typeface、Paragraph 和 Paint。
- Canvas 2D 保留为字体、效果或 CanvasKit runtime 不满足等价条件时的兼容 fallback；新效果优先实现于共享渲染层，并以预览/导出一致性为验收。
- 预览、缩略图和 M5 构建调用同一文本渲染入口；其中由 CanvasKit 负责的能力与 Canvas 2D 回退必须使用同一排版结果。
- 用 SkParagraph 实现换行、水平/垂直对齐、字距、行高、max lines 和 overflow。
- 二分搜索实现 AutoFit，领域参数包含 `minFontSize/maxFontSize/maxLines`。
- 用 SkPaint/Shader 实现多点渐变填充/描边、多描边/阴影图层和 Region rotation。
- 固定 alpha、抗锯齿、DPR、颜色空间与像素取整规则；异步请求防止旧结果覆盖新编辑。
- 所有带 `.delete()` 的对象有所有权测试和开发期泄漏计数。

#### 性能与验收

- 常规 Sprite 输入到预览目标小于 50 ms；大图可降频但不阻塞输入。
- 字体、Texture 和共享底图按工程缓存，只重算变化的依赖。
- Worker/OffscreenCanvas 由 profiling 决定，不复制两套渲染逻辑。
- 同一 RenderScene 在预览、缩略图和导出中一致，并能记录最终采用 CanvasKit 或 Canvas 2D 的原因。
- 中文、日文、拉丁文、多行、旋转、AutoFit、渐变、描边、阴影有回归样本。
- 连续切换 200 个 Sprite 后内存趋稳。

### M10：QA、代码质量与用户体验

- Region 诊断：缺译文、overflow、AutoFit 触底、缺字体/glyph、缺底图、悬空模板、渲染失败；构建结果与耗时通过可访问状态区域播报。
- 构建前运行项目 QA；缺译文错误已阻止导出且可跳到对应 Sprite/Region。工作区使用实际 Canvas 测量显示 overflow、AutoFit 最小字号与显式工程字体缺失警告；底图文件缺失不再阻断工程打开，并报告资源路径与加载错误；单个 Texture 构建失败后继续处理其余任务，并报告 SpriteTable、Texture、源路径、可用时的 Sprite ID 和错误消息；继续补齐更细粒度的缺资源和渲染失败诊断。
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

#### 已纳入的增量交付（2026-09-02）

- **Sprite 管理 Grid**：选择 SpriteTable 后以固定缩略图尺寸的虚拟 Grid 浏览；支持调节预览大小、单击选中并显示属性、双击进入编辑，树形侧栏子项保持并与 Grid 选中态同步。
- **背景与图片预览**：工具栏背景颜色同步应用于 Sprite Grid 和单 Sprite 预览；图像尺寸移至画布外。通用 Image Preview Dialog 支持宽留白、固定右上关闭、点击遮罩关闭、键盘左右切换、多图列表和底部对比 Tab；翻译表的原 Sprite/输出效果会直接以翻译前后对比方式打开。
- **构建反馈与导入**：构造贴图按钮有 loading 状态，状态栏显示 `completed/total` 进度，完成后通过 Sonner 提示 `output_textures`。支持“导入贴图”扫描目录、二次确认、保持原目录结构复制至 `textures/<directory>`，并为每张散件图生成单 Sprite manifest/table；导出维持相对目录。
- **编辑和样式体验**：新增一键整图文字区域、默认底图类型（原 Sprite/空白）、旋转后尺寸/边界计算、旋转 Sprite 在翻译表中的可读方向、固定样式预览、模板缩略文字、字体字重与默认圆角描边。每条翻译可明确选择“字体模板”或“单独样式”；模板可另存、覆盖、重命名、删除并检查同名冲突。
- **导航与工程操作**：应用品牌本地化为“Sprite Localization Studio / 贴图翻译助手”；工程根节点支持右键重命名，保存时更新 `project.json.name`。

#### M9/M10 剩余验收重点

- 用真实项目字体、中文/日文/拉丁文、旋转/裁剪 Sprite 和复杂样式，记录预览、翻译表缩略图、导出三端的 renderer、排版位置与像素差异；修复任何不一致后再宣告 CanvasKit 统一。
- 建立常规 Sprite 小于 50ms、连续切换 200 Sprite 内存趋稳的 profile 基线；据数据决定是否引入 Worker/OffscreenCanvas。
- 为翻译表的大工程增加虚拟化/按需渲染，并补齐窄窗口、键盘焦点、屏幕阅读器和深浅主题的人工验收。
- 将现有 `layers` 数据模型发展为可编辑、可增删、可排序的 Photoshop 式效果列表；每个效果块独立编辑，支持多个描边、多个阴影、填充与明确渲染顺序。

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

- [x] 共享底图模板可选择、CRUD 并按约定目录落盘；单行独立底图不混入模板管理。
- [x] 样式可另存、覆盖、更新、删除项目模板，引用安全。
- [x] 渐变支持多个位置点、百分比、颜色和透明度。
- [x] `fonts/` 字体可发现、选择；CanvasKit 可用时传递项目字体，其他情形明确回退 Canvas 2D。
- [x] 手动字体名称可用，且不可移植风险可见。
- [ ] CanvasKit 是预览、缩略图和导出的统一渲染器。
- [x] localized Texture 通过无修改/单 Sprite 修改像素不变量测试。
- [ ] 重开 `D:\Temp\sts_test` 后资源、模板、字体和效果完整恢复（需要在最终 M9 验收时重新记录）。
- [x] 构建前 QA 可定位缺译文、overflow、AutoFit、缺字体、缺底图和部分构建失败；更细的渲染失败诊断继续补齐。
- [x] type-check、unit tests、lint、build 全部通过（最近一次：160 个单元测试）。

## 10. 后续路线

- **M11 渲染效果编排与批量生产**：将现有 `layers` 模型升级为 Photoshop 式效果块列表（多描边、多阴影、填充、排序）；补齐批量 Style/Background/Region、复制粘贴、查找替换、相似 Sprite 分组和问题筛选。
- **M12 Rich Text**：有限 markup → AST → SkParagraph spans；首期仅 bold、italic、color、size。
- **M13 OCR/AI Provider**：OCR 只初始化 sourceText，AI 去字只生成候选底图，失败不破坏手工作业。
- **M14 交换与协作**：CSV/XLIFF、Git 友好拆分、TMS 对接；审核、评论和多人协作后置。

## 11. 仍明确不做

- Unity/Unreal/Cocos 资源提取与包体回写；继续消费引擎无关 Texture + manifest。
- 重新 bin-pack Atlas 或修改原游戏 UV/layout。
- Stage 0.2 前引入服务端、用户系统和实时协作。
- 把 CanvasKit 专属对象或枚举写入 `project.json`。
- 未经 profiling 同时维护主线程与 Worker 两套渲染实现。
