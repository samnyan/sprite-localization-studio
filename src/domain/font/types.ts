export interface ProjectFont {
  id: string
  path: string
  faceIndex?: number
  family: string
  subfamily?: string
  postscriptName?: string
  weight?: number
  style?: 'normal' | 'italic' | 'oblique'
}

export interface SystemFont {
  family: string
  fullName?: string
  postscriptName?: string
  subfamily?: string
  weight: number
  style: 'normal' | 'italic' | 'oblique'
}

export interface FontDiagnostic {
  path: string
  message: string
}

export interface ProjectFontCatalog {
  fonts: ProjectFont[]
  diagnostics: FontDiagnostic[]
}
