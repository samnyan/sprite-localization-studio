import type { SpriteTable } from '@/domain/sprite-table/types'

export interface TextureTreeNode {
  name: string
  path: string
  type: 'directory' | 'file'
  children: TextureTreeNode[]
  spriteTableId: string
  spriteId?: string
  textureId?: string
}

export function createTextureTree(spriteTable: SpriteTable): TextureTreeNode[] {
  const roots: TextureTreeNode[] = []

  for (const texture of spriteTable.textures) {
    const parts = texture.imagePath.split('/')
    const sprite = spriteTable.sprites.find((item) => item.textureId === texture.id)
    let siblings = roots

    for (const [index, name] of parts.entries()) {
      const path = parts.slice(0, index + 1).join('/')
      const isFile = index === parts.length - 1
      let node = siblings.find((item) => item.path === path)
      if (!node) {
        node = {
          name,
          path,
          type: isFile ? 'file' : 'directory',
          children: [],
          spriteTableId: spriteTable.id,
          ...(isFile ? { spriteId: sprite?.id, textureId: texture.id } : {}),
        }
        siblings.push(node)
      }
      siblings = node.children
    }
  }

  sortTextureTree(roots)
  return roots
}

function sortTextureTree(nodes: TextureTreeNode[]): void {
  nodes.sort((left, right) => {
    if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
    return left.name.localeCompare(right.name)
  })
  for (const node of nodes) sortTextureTree(node.children)
}
