export type TranslationStatus = 'untranslated' | 'translated' | 'reviewed'

export interface TranslationEntry {
  key: string
  sourceText: string
  value: string
  status: TranslationStatus
}

export interface TranslationCatalog {
  locale: string
  entries: Record<string, TranslationEntry>
}
