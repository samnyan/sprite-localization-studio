const simpleScript = /^[\u0020-\u02ff\u0370-\u052f\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af\uf900-\ufaff]*$/u
const mark = /\p{M}/u
const emoji = /\p{Extended_Pictographic}/u
const joinerOrVariation = /\u200c|\u200d|\ufe00-\ufe0f|\u{e0100}-\u{e01ef}/u

export function requiresComplexTextShaping(text: string): boolean {
  const printableText = text.replace(/\s/g, '')
  return !simpleScript.test(printableText) || mark.test(text) || emoji.test(text) || joinerOrVariation.test(text)
}
