import type { ProjectManifest } from '@/domain/project/types'

export interface TextDiagnostic {
  code: 'missingTranslation'
  spriteTableId: string
  spriteId: string
  regionId: string
}

export function collectTextDiagnostics(project: ProjectManifest): TextDiagnostic[] {
  return (project.translations ?? []).flatMap((translation) =>
    translation.textRegions.flatMap((region) =>
      region.translatedText?.trim()
        ? []
        : [{
            code: 'missingTranslation' as const,
            spriteTableId: translation.spriteTableId,
            spriteId: translation.spriteId,
            regionId: region.id,
          }],
    ),
  )
}
