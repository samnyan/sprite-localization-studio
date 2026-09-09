import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import { readPngSize } from '@/infrastructure/image/pngSize'
import {
  createLooseSpriteImportPlan,
  isLooseSpriteImage,
  type LooseSpriteImage,
} from './LooseSpriteImport'

export interface UnindexedTextureGroup {
  directoryName: string
  images: string[]
}

export interface UnindexedTextureScanResult {
  manifestPath: string
  imagePaths: string[]
}

export async function findUnindexedTextureGroups(
  storage: ProjectStorage,
  manifestPaths: string[],
): Promise<UnindexedTextureGroup[]> {
  const indexed = new Set<string>()
  const manifests = await Promise.all(
    manifestPaths.map(async (path) => {
      try {
        return await storage.readText(path)
      } catch {
        return undefined
      }
    }),
  )
  for (const text of manifests) {
    if (!text) continue
    try {
      const table = JSON.parse(text) as { textures?: { imagePath?: unknown }[] }
      for (const texture of table.textures ?? []) {
        if (typeof texture.imagePath === 'string') indexed.add(`textures/${texture.imagePath}`)
      }
    } catch {
      continue
    }
  }

  let entries: string[]
  try {
    entries = await walk(storage, 'textures')
  } catch {
    return []
  }
  const groups = new Map<string, string[]>()
  for (const entry of entries) {
    const path = entry.replace(/\\/g, '/')
    if (!isLooseSpriteImage(path) || indexed.has(path)) continue
    const relative = path.slice('textures/'.length)
    const separator = relative.indexOf('/')
    if (separator < 1 || separator === relative.length - 1) continue
    const root = relative.slice(0, separator)
    const list = groups.get(root) ?? []
    list.push(relative.slice(separator + 1))
    groups.set(root, list)
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([directoryName, images]) => ({
      directoryName,
      images: images.sort((left, right) => left.localeCompare(right)),
    }))
}

export async function scanUnindexedTextures(
  storage: ProjectStorage,
  manifestPaths: string[],
  onProgress?: (completed: number, total: number) => void,
): Promise<UnindexedTextureScanResult[]> {
  const groups = await findUnindexedTextureGroups(storage, manifestPaths)
  const total = groups.reduce((sum, group) => sum + group.images.length, 0)
  const results: UnindexedTextureScanResult[] = []
  let completed = 0
  onProgress?.(0, total)

  for (const group of groups) {
    const images: LooseSpriteImage[] = []
    for (const name of group.images) {
      const data = await storage.readBinary(`textures/${group.directoryName}/${name}`)
      images.push({ name, size: readPngSize(data) })
      completed += 1
      onProgress?.(completed, total)
    }

    const plan = createLooseSpriteImportPlan(group.directoryName, images)
    if (await storage.exists(plan.manifestPath)) continue
    await storage.writeText(plan.manifestPath, `${JSON.stringify(plan.spriteTable, null, 2)}\n`)
    results.push({
      manifestPath: plan.manifestPath,
      imagePaths: group.images.map((name) => `${group.directoryName}/${name}`),
    })
  }

  return results
}

async function walk(storage: ProjectStorage, path: string): Promise<string[]> {
  const result: string[] = []
  for (const entry of await storage.list(path)) {
    if (entry.kind === 'directory') result.push(...(await walk(storage, entry.path)))
    else result.push(entry.path)
  }
  return result
}
