import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import type { ProjectFont, ProjectFontCatalog } from '@/domain/font/types'
import { inferFontStyle, inferFontWeight } from '@/domain/font/fontStyle'
import { extractFontFaces } from '@/application/font/fontData'

const FONT_FILE_PATTERN = /\.(ttf|otf|ttc)$/i

function localizedName(value: Record<string, string> | undefined): string | undefined {
  return value?.en ?? Object.values(value ?? {})[0]
}

function fontName(names: unknown, key: string): string | undefined {
  if (!names || typeof names !== 'object') return undefined
  const collections = names as Record<string, Record<string, Record<string, string>>>
  return Object.values(collections)
    .map((collection) => localizedName(collection[key]))
    .find((value) => value !== undefined)
}

async function fingerprint(path: string, data: ArrayBuffer): Promise<string> {
  const pathData = new TextEncoder().encode(`${path}\u0000`)
  const combined = new Uint8Array(pathData.byteLength + data.byteLength)
  combined.set(pathData)
  combined.set(new Uint8Array(data), pathData.byteLength)
  const digest = await crypto.subtle.digest('SHA-256', combined)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function isMissingDirectory(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

export async function scanProjectFonts(storage: ProjectStorage): Promise<ProjectFontCatalog> {
  let entries
  try {
    entries = await storage.list('fonts')
  } catch (error) {
    return isMissingDirectory(error)
      ? { fonts: [], diagnostics: [] }
      : {
          fonts: [],
          diagnostics: [
            {
              path: 'fonts',
              message: error instanceof Error ? error.message : 'Unable to scan fonts.',
            },
          ],
        }
  }

  const fonts: ProjectFont[] = []
  const diagnostics: ProjectFontCatalog['diagnostics'] = []
  const fontEntries = entries.filter(
    (entry) => entry.kind === 'file' && FONT_FILE_PATTERN.test(entry.name),
  )
  if (!fontEntries.length) return { fonts, diagnostics }
  const module = await import('opentype.js')
  const parse = (module.default ?? module).parse
  const descriptors = new Set<string>()
  for (const entry of fontEntries) {
    try {
      const sourceData = await storage.readBinary(entry.path)
      const faces = extractFontFaces(sourceData)
      for (const [faceIndex, data] of faces.entries()) {
        const font = parse(data)
        const family = fontName(font.names, 'fontFamily')
        if (!family) throw new Error('Font family metadata is missing.')
        const subfamily = fontName(font.names, 'fontSubfamily')
        const tableWeight = Number(
          (font.tables.os2 as { usWeightClass?: unknown } | undefined)?.usWeightClass,
        )
        const weight =
          Number.isFinite(tableWeight) && tableWeight > 0 ? tableWeight : inferFontWeight(subfamily)
        const style = inferFontStyle(subfamily)
        const descriptor = `${family}\u0000${weight ?? 400}\u0000${style}`
        if (descriptors.has(descriptor)) {
          diagnostics.push({
            path: entry.path,
            message: 'Duplicate font family, weight, and style.',
          })
          continue
        }
        descriptors.add(descriptor)
        fonts.push({
          id: await fingerprint(`${entry.path}\u0000${faceIndex}`, data),
          path: entry.path,
          ...(faces.length > 1 ? { faceIndex } : {}),
          family,
          ...(subfamily ? { subfamily } : {}),
          ...(fontName(font.names, 'postScriptName')
            ? { postscriptName: fontName(font.names, 'postScriptName') }
            : {}),
          ...(weight ? { weight } : {}),
          style,
        })
      }
    } catch (error) {
      diagnostics.push({
        path: entry.path,
        message: error instanceof Error ? error.message : 'Unable to parse font metadata.',
      })
    }
  }
  return { fonts, diagnostics }
}
