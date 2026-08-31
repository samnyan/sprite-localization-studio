import type { ProjectStorage } from '@/application/storage/ProjectStorage'
import type { FontDiagnostic, ProjectFont } from '@/domain/font/types'

export class BrowserFontRegistry {
  private readonly faces = new Map<string, FontFace>()
  private readonly data = new Map<string, ArrayBuffer>()
  private generation = 0
  private request = 0

  get version(): number {
    return this.generation
  }

  async register(
    storage: ProjectStorage,
    fonts: ProjectFont[],
  ): Promise<{ registeredIds: string[]; diagnostics: FontDiagnostic[] }> {
    const request = ++this.request
    const results = await Promise.all(
      fonts.map(async (font) => {
        try {
          const data = await storage.readBinary(font.path)
          const face = new FontFace(font.family, data, {
            ...(font.weight ? { weight: String(font.weight) } : {}),
            ...(font.style ? { style: font.style } : {}),
          })
          const loaded = await face.load()
          return { id: font.id, face: loaded, data }
        } catch (error) {
          return {
            path: font.path,
            message: error instanceof Error ? error.message : 'Unable to load project font.',
          }
        }
      }),
    )
    if (request !== this.request) return { registeredIds: [], diagnostics: [] }
    await this.dispose(false)
    const registeredIds: string[] = []
    const registered = results.filter(
      (result): result is { id: string; face: FontFace; data: ArrayBuffer } =>
        result !== undefined && 'face' in result,
    )
    for (const result of registered) {
      document.fonts.add(result.face)
      this.faces.set(result.id, result.face)
      this.data.set(result.id, result.data)
      registeredIds.push(result.id)
    }
    this.generation += 1
    return {
      registeredIds,
      diagnostics: results.filter(
        (result): result is FontDiagnostic => result !== undefined && !('id' in result),
      ),
    }
  }

  async dispose(invalidate = true): Promise<void> {
    if (invalidate) {
      this.request += 1
      this.generation += 1
    }
    for (const face of this.faces.values()) document.fonts.delete(face)
    this.faces.clear()
    this.data.clear()
  }

  findData(family: string, weight: number, style: string): ArrayBuffer | undefined {
    for (const [id, face] of this.faces) {
      if (face.family === family && face.weight === String(weight) && face.style === style) {
        return this.data.get(id)
      }
    }
    return undefined
  }

  findDataById(id: string): ArrayBuffer | undefined {
    return this.data.get(id)
  }
}

export const projectFontRegistry = new BrowserFontRegistry()
