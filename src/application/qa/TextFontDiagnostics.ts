import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import type { TextRenderConfig } from '@/domain/text-region/types'
import type { ProjectManifest } from '@/domain/project/types'
import type { TextDiagnostic } from '@/application/qa/TextDiagnostics'

function referencedProjectFontIds(render: TextRenderConfig): string[] {
  return [
    ...(render.fontId ? [render.fontId] : []),
    ...(render.layers ?? []).flatMap((layer) =>
      layer.enabled ? referencedProjectFontIds(layer.render) : [],
    ),
  ]
}

export function collectTextFontDiagnostics(
  project: ProjectManifest,
  registeredFontIds: ReadonlySet<string>,
): TextDiagnostic[] {
  return (project.translations ?? []).flatMap((translation) =>
    translation.textRegions.flatMap((region) => {
      if (!region.translatedText?.trim()) return []
      const render = { ...DEFAULT_TEXT_RENDER, ...region.render }
      return [...new Set(referencedProjectFontIds(render))]
        .filter((fontId) => !registeredFontIds.has(fontId))
        .map((fontId) => ({
          code: 'missingProjectFont' as const,
          spriteTableId: translation.spriteTableId,
          spriteId: translation.spriteId,
          regionId: region.id,
          fontId,
        }))
    }),
  )
}
