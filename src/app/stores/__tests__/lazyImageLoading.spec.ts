import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

import { setWorkspaceProjectSessionForTesting, useWorkspaceStore } from '@/app/stores/workspace'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'

afterEach(() => {
  setWorkspaceProjectSessionForTesting()
  vi.restoreAllMocks()
})

describe('lazy image loading', () => {
  it('deduplicates generic path reads and infers the blob MIME type', async () => {
    setActivePinia(createPinia())
    const readBinary = vi.fn<() => Promise<ArrayBuffer>>(async () => new ArrayBuffer(4))
    setWorkspaceProjectSessionForTesting(undefined, { readBinary } as unknown as ProjectStorage)
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:image')
    const workspace = useWorkspaceStore()

    const [first, second] = await Promise.all([
      workspace.loadImageUrl('textures/ui/start.webp'),
      workspace.loadImageUrl('textures/ui/start.webp'),
    ])

    expect(first).toBe('blob:image')
    expect(second).toBe(first)
    expect(readBinary).toHaveBeenCalledExactlyOnceWith('textures/ui/start.webp')
    expect(createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: 'image/webp' }))
  })

  it('maps a texture id to the shared path cache', async () => {
    setActivePinia(createPinia())
    const readBinary = vi.fn<() => Promise<ArrayBuffer>>(async () => new ArrayBuffer(4))
    setWorkspaceProjectSessionForTesting(undefined, { readBinary } as unknown as ProjectStorage)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:texture')
    const workspace = useWorkspaceStore()
    workspace.spriteTables = [
      {
        schemaVersion: 1,
        id: 'ui',
        name: 'UI',
        textures: [{ id: 'start', imagePath: 'common/start.png', size: { width: 8, height: 8 } }],
        sprites: [],
      },
    ]

    await expect(workspace.ensureTextureImageUrl('ui', 'start')).resolves.toBe('blob:texture')
    await expect(workspace.ensureTextureImageUrl('ui', 'start')).resolves.toBe('blob:texture')

    expect(readBinary).toHaveBeenCalledOnce()
    expect(workspace.textureImageUrls.ui?.start).toBe('blob:texture')
  })
})
