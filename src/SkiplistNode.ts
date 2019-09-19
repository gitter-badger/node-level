import Slice from './Slice'

export default class SkiplistNode {
  constructor(maxlevel: number, key: Slice, next?: SkiplistNode) {
    this.key = key
    this.maxlevel = maxlevel
    this.levels = new Array(maxlevel + 1)
    if (!!next) this.fill(next)
  }

  key: Slice
  maxlevel: number
  levels: SkiplistNode[]

  /**
   * 将这个节点的每一级都链接到next
   */
  fill(next: SkiplistNode) {
    for (let i = 0; i <= this.maxlevel; i++) {
      this.levels[i] = next
    }
  }

  forEach(cb: (node: SkiplistNode, index: number) => void) {
    for (let i = 0; i <= this.maxlevel; i++) {
      cb(this.levels[i], i)
    }
  }

  *iterator() {
    for (let i = 0; i <= this.maxlevel; i++) {
      yield this.levels[i]
    }
  }

  next(): SkiplistNode {
    return this.levels[0]
  }
}
