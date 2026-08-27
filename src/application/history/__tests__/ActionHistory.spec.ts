import { describe, expect, it } from 'vitest'

import { ActionHistory, createSnapshotAction } from '@/application/history/ActionHistory'

describe('ActionHistory', () => {
  it('undoes and redoes document actions', () => {
    const history = new ActionHistory<{ value: number }>()
    const initial = { value: 1 }
    const updated = { value: 2 }

    const executed = history.execute(initial, createSnapshotAction('update', initial, updated))

    expect(history.undo(executed)).toBe(initial)
    expect(history.redo(initial)).toBe(updated)
  })

  it('discards redo actions after a new action', () => {
    const history = new ActionHistory<{ value: number }>()
    const initial = { value: 1 }
    const second = { value: 2 }
    const third = { value: 3 }

    const executed = history.execute(initial, createSnapshotAction('second', initial, second))
    const undone = history.undo(executed)
    history.execute(undone, createSnapshotAction('third', undone, third))

    expect(history.canRedo).toBe(false)
  })
})
