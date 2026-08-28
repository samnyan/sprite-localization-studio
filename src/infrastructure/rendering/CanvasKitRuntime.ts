import type { CanvasKit } from 'canvaskit-wasm'

let runtime: Promise<CanvasKit> | undefined

export function loadCanvasKit(): Promise<CanvasKit> {
  runtime ??= initializeCanvasKit().catch((error: unknown) => {
    runtime = undefined
    throw error
  })
  return runtime
}

async function initializeCanvasKit(): Promise<CanvasKit> {
  const [{ default: CanvasKitInit }, { default: wasmUrl }] = await Promise.all([
    import('canvaskit-wasm'),
    import('canvaskit-wasm/bin/canvaskit.wasm?url'),
  ])
  return CanvasKitInit({
    locateFile(file) {
      return file.endsWith('.wasm') ? wasmUrl : file
    },
  })
}
