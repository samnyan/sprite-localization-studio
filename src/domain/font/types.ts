export interface ProjectFont {
  id: string
  path: string
  family: string
  subfamily?: string
  postscriptName?: string
  weight?: number
  style?: 'normal' | 'italic' | 'oblique'
}

export interface FontDiagnostic {
  path: string
  message: string
}

export interface ProjectFontCatalog {
  fonts: ProjectFont[]
  diagnostics: FontDiagnostic[]
}
