function safePathSegment(value: string): string {
  return `id-${encodeURIComponent(value).replace(/\./g, '%2E')}`
}

function imageExtension(fileName: string): string {
  const extension = fileName.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]
  return extension && ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extension)
    ? extension
    : '.png'
}

export function createBackgroundTemplatePath(id: string, fileName: string): string {
  return `sprite_base/template/${safePathSegment(id)}${imageExtension(fileName)}`
}

export function createSpriteBackgroundPath(
  spriteTableId: string,
  spriteId: string,
  id: string,
  fileName: string,
): string {
  return [
    'sprite_base',
    safePathSegment(spriteTableId),
    safePathSegment(spriteId),
    `${safePathSegment(id)}${imageExtension(fileName)}`,
  ].join('/')
}
