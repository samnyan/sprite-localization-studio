# Sprite Localization Input Format v1

## Scope

Game-specific tools must unpack game assets and generate this input. Sprite Localization Studio only reads the generated PNG files and JSON manifests.

One manifest represents one game sprite table. A sprite table may reference multiple texture PNG files.

## Project Layout

```text
project/
├── project.json
├── manifests/
│   └── ui-common.sprite-table.json
└── textures/
    └── ui/
        ├── common/
        │   └── page-00.png
        └── dialog/
            └── page-01.png
```

All paths use `/` separators. Paths in `spriteTableManifestPaths` are relative to the project root. Texture `imagePath` values are relative to the `textures/` directory and may contain subdirectories. Absolute paths, `.` segments, and `..` segments are not allowed.

## Project Manifest

`project.json` lists the sprite table manifests:

```json
{
  "schemaVersion": 1,
  "name": "Example Game",
  "spriteTableManifestPaths": ["manifests/ui-common.sprite-table.json"]
}
```

## Sprite Table Manifest

```json
{
  "schemaVersion": 1,
  "id": "ui-common",
  "name": "UI Common",
  "textures": [
    {
      "id": "page-00",
      "imagePath": "ui/common/page-00.png",
      "size": { "width": 2048, "height": 2048 }
    },
    {
      "id": "page-01",
      "imagePath": "ui/dialog/page-01.png",
      "size": { "width": 1024, "height": 1024 }
    }
  ],
  "sprites": [
    {
      "id": "button-start",
      "name": "button_start",
      "textureId": "page-00",
      "frame": { "x": 32, "y": 64, "width": 256, "height": 64 },
      "rotation": 0,
      "trimmed": false
    },
    {
      "id": "dialog-title",
      "name": "dialog_title",
      "textureId": "page-01",
      "frame": { "x": 320, "y": 64, "width": 80, "height": 240 },
      "rotation": 90,
      "trimmed": true,
      "originalSize": { "width": 280, "height": 100 },
      "trimOffset": { "x": 20, "y": 10 }
    }
  ]
}
```

## Field Rules

- All fields shown above are required, except `originalSize` and `trimOffset`, which are conditional.
- `schemaVersion` must be `1`.
- The manifest `id` must be unique within the project.
- Texture IDs and sprite IDs must be stable and unique within the manifest.
- `name` is the human-readable sprite table or sprite name and may equal `id`.
- `textures` must contain at least one texture. Each `imagePath` must be unique and reference a lossless PNG under the project's `textures/` directory whose pixel dimensions match `size`. Do not include the `textures/` prefix.
- Each sprite `textureId` must reference a texture ID from the same manifest.
- `frame` is the stored rectangle in the referenced texture. The origin is the top-left corner; `x` increases right and `y` increases down. All values are integer pixels and dimensions must be positive.
- `rotation` is one of `0`, `90`, `180`, or `270`. It is the clockwise rotation applied before storing the logical sprite in the texture. Extraction applies the inverse rotation.
- `trimmed` indicates whether transparent outer pixels were removed before packing.
- When `trimmed` is `true`, `originalSize` and `trimOffset` are required. `trimOffset` is the top-left position of the trimmed content in the unrotated original sprite. Omit both fields when `trimmed` is `false`.
- For rotations `0` and `180`, the logical trimmed size is `frame.width × frame.height`. For `90` and `270`, it is `frame.height × frame.width`.
- Every frame must fit inside its referenced texture. Trimmed content must fit inside `originalSize`.

JSON files must use UTF-8. Keep engine-specific archive IDs and repacking data outside this format. Consumers should ignore unknown fields.
