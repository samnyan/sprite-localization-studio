export function isProjectRelativePath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !/^[a-zA-Z]:/.test(path) &&
    path.split('/').every((part) => part !== '' && part !== '.' && part !== '..')
  )
}
