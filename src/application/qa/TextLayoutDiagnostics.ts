import { DEFAULT_TEXT_RENDER } from '@/domain/text-region/styleTemplates'
import { layoutText } from '@/domain/text-region/textLayout'
import type { TextRenderConfig } from '@/domain/text-region/types'
import type { ProjectManifest } from '@/domain/project/types'
import type { TextDiagnostic } from '@/application/qa/TextDiagnostics'

export type TextLayoutDiagnostic = TextDiagnostic & { code: 'textOverflow' | 'autoFitAtMinimum' }

export type TextMeasureForRender = (text: string, fontSize: number, render: TextRenderConfig) => number

export function collectTextLayoutDiagnostics(
  project: ProjectManifest,
  measure: TextMeasureForRender,
): TextLayoutDiagnostic[] {
  return (project.translations ?? []).flatMap((translation) =>
    translation.textRegions.flatMap((region) => {
      const text = region.translatedText?.trim()
      if (!text) return []
      const render = { ...DEFAULT_TEXT_RENDER, ...region.render }
      const layout = layoutText(text, region.rect.width, region.rect.height, render, (line, fontSize) =>
        measure(line, fontSize, render),
      )
      const location = {
        spriteTableId: translation.spriteTableId,
        spriteId: translation.spriteId,
        regionId: region.id,
      }
      return [
        ...(layout.overflowed && render.overflow !== 'visible'
          ? [{ code: 'textOverflow' as const, ...location }]
          : []),
        ...(render.autoFit && layout.fontSize <= render.autoFit.minFontSize
          ? [{ code: 'autoFitAtMinimum' as const, ...location }]
          : []),
      ]
    }),
  )
}
