export interface ReversibleAction<Document> {
  readonly type: string
  apply(document: Document): Document
  revert(document: Document): Document
}

export function createSnapshotAction<Document>(
  type: string,
  before: Document,
  after: Document,
): ReversibleAction<Document> {
  return {
    type,
    apply: () => after,
    revert: () => before,
  }
}

export class ActionHistory<Document> {
  private readonly past: ReversibleAction<Document>[] = []
  private readonly future: ReversibleAction<Document>[] = []

  constructor(private readonly limit = 200) {}

  get canUndo(): boolean {
    return this.past.length > 0
  }

  get canRedo(): boolean {
    return this.future.length > 0
  }

  execute(document: Document, action: ReversibleAction<Document>): Document {
    const updated = action.apply(document)
    this.past.push(action)
    if (this.past.length > this.limit) this.past.shift()
    this.future.length = 0
    return updated
  }

  undo(document: Document): Document {
    const action = this.past.pop()
    if (!action) return document
    this.future.push(action)
    return action.revert(document)
  }

  redo(document: Document): Document {
    const action = this.future.pop()
    if (!action) return document
    this.past.push(action)
    return action.apply(document)
  }

  clear(): void {
    this.past.length = 0
    this.future.length = 0
  }
}
