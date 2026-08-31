import { describe, expect, it, vi } from 'vitest'

import { loadBackgroundImages } from '@/app/stores/workspace'
import type { ProjectStorage } from '@/application/storage/ProjectStorage'

describe('loadBackgroundImages', () => {
  it('keeps readable backgrounds when another resource is unavailable', async () => {
    const readBinary = vi.fn<(path: string) => Promise<ArrayBuffer>>(async (path) => {
      if (path === 'sprite_base/template/missing.png') throw new Error('Not found')
      return new ArrayBuffer(4)
    })
    const createObjectURL = vi.spyOn(URL, 'createObjectURL')
      .mockReturnValueOnce('blob:first')
      .mockReturnValueOnce('blob:last')

    const result = await loadBackgroundImages(
      { readBinary } as unknown as ProjectStorage,
      [
        { id: 'first', name: 'First', path: 'sprite_base/template/first.png' },
        { id: 'missing', name: 'Missing', path: 'sprite_base/template/missing.png' },
        { id: 'last', name: 'Last', path: 'sprite_base/template/last.png' },
      ],
    )

    expect(readBinary).toHaveBeenCalledTimes(3)
    expect(result).toEqual({
      urls: { first: 'blob:first', last: 'blob:last' },
      diagnostics: [{
        resourceId: 'missing',
        path: 'sprite_base/template/missing.png',
        message: 'Not found',
      }],
    })
    expect(createObjectURL).toHaveBeenCalledTimes(2)
  })
})
