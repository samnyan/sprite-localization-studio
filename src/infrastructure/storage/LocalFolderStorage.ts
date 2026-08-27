import type { ProjectEntry, ProjectStorage } from '@/application/storage/ProjectStorage'

function splitProjectPath(path: string): string[] {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)

  if (parts.some((part) => part === '.' || part === '..')) {
    throw new Error(`Invalid project path: ${path}`)
  }

  return parts
}

export class LocalFolderStorage implements ProjectStorage {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  async readText(path: string): Promise<string> {
    return (await this.getFile(path)).text()
  }

  async writeText(path: string, text: string): Promise<void> {
    await this.writeFile(path, text)
  }

  async readBinary(path: string): Promise<ArrayBuffer> {
    return (await this.getFile(path)).arrayBuffer()
  }

  async writeBinary(path: string, data: Uint8Array): Promise<void> {
    await this.writeFile(path, new Uint8Array(data).buffer)
  }

  async delete(path: string): Promise<void> {
    const parts = splitProjectPath(path)
    const fileName = parts.pop()

    if (!fileName) {
      throw new Error(`A file path is required: ${path}`)
    }

    await (await this.getDirectory(parts, false)).removeEntry(fileName)
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.getHandle(path)
      return true
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return false
      }

      throw error
    }
  }

  async list(path: string): Promise<ProjectEntry[]> {
    const directory = await this.getDirectory(splitProjectPath(path), false)
    const entries: ProjectEntry[] = []

    for await (const handle of directory.values()) {
      entries.push({
        name: handle.name,
        path: [path.replace(/\\/g, '/').replace(/\/$/, ''), handle.name].filter(Boolean).join('/'),
        kind: handle.kind,
      })
    }

    return entries.sort((left, right) => left.name.localeCompare(right.name))
  }

  private async getFile(path: string): Promise<File> {
    const parts = splitProjectPath(path)
    const fileName = parts.pop()

    if (!fileName) {
      throw new Error(`A file path is required: ${path}`)
    }

    const directory = await this.getDirectory(parts, false)
    const handle = await directory.getFileHandle(fileName)
    return handle.getFile()
  }

  private async getHandle(path: string): Promise<FileSystemHandle> {
    const parts = splitProjectPath(path)
    const name = parts.pop()

    if (!name) {
      return this.root
    }

    const directory = await this.getDirectory(parts, false)

    try {
      return await directory.getFileHandle(name)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TypeMismatchError') {
        return directory.getDirectoryHandle(name)
      }

      if (error instanceof DOMException && error.name === 'NotFoundError') {
        return directory.getDirectoryHandle(name)
      }

      throw error
    }
  }

  private async writeFile(path: string, data: FileSystemWriteChunkType): Promise<void> {
    const parts = splitProjectPath(path)
    const fileName = parts.pop()

    if (!fileName) {
      throw new Error(`A file path is required: ${path}`)
    }

    const directory = await this.getDirectory(parts, true)
    const file = await directory.getFileHandle(fileName, { create: true })
    const writable = await file.createWritable()

    try {
      await writable.write(data)
    } finally {
      await writable.close()
    }
  }

  private async getDirectory(parts: string[], create: boolean): Promise<FileSystemDirectoryHandle> {
    let directory = this.root

    for (const part of parts) {
      directory = await directory.getDirectoryHandle(part, { create })
    }

    return directory
  }
}
