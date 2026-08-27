export type ProjectEntryKind = 'file' | 'directory'

export interface ProjectEntry {
  name: string
  path: string
  kind: ProjectEntryKind
}

export interface ProjectStorage {
  readText(path: string): Promise<string>
  writeText(path: string, text: string): Promise<void>
  readBinary(path: string): Promise<ArrayBuffer>
  writeBinary(path: string, data: Uint8Array): Promise<void>
  delete(path: string): Promise<void>
  exists(path: string): Promise<boolean>
  list(path: string): Promise<ProjectEntry[]>
}
