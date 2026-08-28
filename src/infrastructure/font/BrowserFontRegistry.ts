import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import type { FontDiagnostic, ProjectFont } from '@/domain/font/types'

export class BrowserFontRegistry {
  private readonly faces = new Map<string, FontFace>()
  private generation = 0

  async register(
    storage: ProjectStorage,
    fonts: ProjectFont[],
  ): Promise<{ registeredIds: string[]; diagnostics: FontDiagnostic[] }> {
    await this.dispose(false)
    const generation = ++this.generation
    const results = await Promise.all(
      fonts.map(async (font) => {
        try {
          const face = new FontFace(font.family, await storage.readBinary(font.path), {
            ...(font.weight ? { weight: String(font.weight) } : {}),
            ...(font.style ? { style: font.style } : {}),
          })
          const loaded = await face.load()
          if (generation !== this.generation) return undefined
          document.fonts.add(loaded)
          this.faces.set(font.id, face)
          return { id: font.id }
        } catch (error) {
          return {
            path: font.path,
            message: error instanceof Error ? error.message : 'Unable to load project font.',
          }
        }
      }),
    )
    return {
      registeredIds: results.flatMap((result) =>
        result && 'id' in result && result.id ? [result.id] : [],
      ),
      diagnostics: results.filter(
        (result): result is FontDiagnostic => result !== undefined && !('id' in result),
      ),
    }
  }

  async dispose(invalidate = true): Promise<void> {
    if (invalidate) this.generation += 1
    for (const face of this.faces.values()) document.fonts.delete(face)
    this.faces.clear()
  }
}
