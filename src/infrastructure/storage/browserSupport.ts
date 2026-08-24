export function supportsLocalFolderProjects(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}
