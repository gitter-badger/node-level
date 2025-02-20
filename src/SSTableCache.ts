/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import Status from './Status'
import { FileHandle, Env } from './Env'
import Table from './SSTable'
import { getTableFilename } from './Filename'
import { Options, ReadOptions } from './Options'
import Slice from './Slice'
import { Entry } from './Format'

// TODO

interface TableAndFile {
  file: FileHandle
  table: Table
}

export class TableCache {
  // TODO entries: LRUCache capacity
  constructor(dbpath: string, options: Options, entries: number) {
    this._env = options.env
    this._dbpath = dbpath
    this._options = options
  }

  _env: Env
  _dbpath: string
  _options: Options

  public async get(
    options: ReadOptions,
    fileNumber: number,
    fileSize: number,
    key: Slice,
    arg: any,
    handleResult: (arg: any, key: Slice, value: Slice) => void
  ): Promise<Status> {
    let status = await this.findTable(fileNumber, fileSize)
    if (await status.ok()) {
      const tf = (await status.promise) as TableAndFile
      const table = tf.table
      // get value from table file
      status = await table.get(key)
    }

    if (await status.ok()) {
      const { key, value } = await status.promise
      handleResult(arg, key, value)
    }
    return status
  }

  async findTable(fileNumber: number, fileSize: number): Promise<Status> {
    let fname = getTableFilename(this._dbpath, fileNumber)
    let status = new Status(this._env.open(fname, 'r+'))
    const tf = {} as TableAndFile
    if (await status.ok()) {
      tf.file = await status.promise
      status = new Status(Table.open(this._options, await status.promise))
    }
    if (await status.ok()) {
      tf.table = await status.promise
      status = new Status(Promise.resolve(tf))
    } else {
      // We do not cache error results so that if the error is transient,
      // or somebody repairs the file, we recover automatically.
    }

    return status
  }

  async *entryIterator(
    options: Options,
    fileNumber: number,
    fileSize: number
  ): AsyncIterableIterator<Entry> {
    const status = await this.findTable(fileNumber, fileSize)
    if (await status.ok()) {
      const tf: TableAndFile = await status.promise
      yield* tf.table.entryIterator()
    }
  }
}
