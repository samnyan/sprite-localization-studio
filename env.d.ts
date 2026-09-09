/// <reference types="vite/client" />

interface Window {
  showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
  queryLocalFonts(): Promise<LocalFontData[]>
}

interface LocalFontData {
  family: string
  fullName: string
  postscriptName: string
  style: string
  blob(): Promise<Blob>
}
