import type { TextRenderConfig, TextStyleTemplate } from '@/domain/text-region/types'

export const DEFAULT_TEXT_RENDER: TextRenderConfig = {
  fontFamily: 'sans-serif',
  fontSize: 24,
  fontWeight: 700,
  fontStyle: 'normal',
  color: '#ffffff',
  align: 'center',
  verticalAlign: 'middle',
  lineHeight: 1.2,
  letterSpacing: 0,
  wrap: false,
  overflow: 'clip',
  fill: { mode: 'solid', color: '#ffffff', alpha: 1, gradientAngle: 0 },
  stroke: { width: 0, position: 'outside', paint: { mode: 'solid', color: '#000000', alpha: 1, gradientAngle: 0 } },
  shadow: { color: '#000000', alpha: 0, blur: 0, offsetX: 0, offsetY: 0 },
}

export const textStyleTemplates: TextStyleTemplate[] = [
  { id: 'clean', name: 'Clean', render: DEFAULT_TEXT_RENDER },
  {
    id: 'outline',
    name: 'Outline',
    render: {
      ...DEFAULT_TEXT_RENDER,
      stroke: { width: 2, position: 'outside', paint: { mode: 'solid', color: '#1f2937' } },
    },
  },
  {
    id: 'shadow',
    name: 'Shadow',
    render: {
      ...DEFAULT_TEXT_RENDER,
      shadow: { color: '#000000', alpha: 0.6, blur: 3, offsetX: 2, offsetY: 2 },
    },
  },
]
