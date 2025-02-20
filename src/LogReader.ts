/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import { Buffer } from 'buffer'
import Slice from './Slice'
import { Record, kBlockSize, RecordType, kHeaderSize } from './LogFormat'
import { FileHandle } from './Env'
import { Options } from './Options'

export default class LogReader {
  constructor(options: Options, filename: string) {
    this._options = options
    this._filename = filename
  }

  _file!: FileHandle
  _filename: string
  _options: Options

  async close() {
    if (!!this._file) {
      await this._file.close()
      delete this._file
    }
  }

  async *iterator(): AsyncIterableIterator<Slice> {
    if (!this._file) {
      this._file = await this._options.env.open(this._filename, 'r')
    }
    let buf: Buffer = Buffer.from(new ArrayBuffer(kBlockSize))
    let blockIndex = -1
    let latestOpBuf = Buffer.alloc(0)
    let latestType = null
    let bufHandledPosition = 0
    while (true) {
      if (blockIndex === -1 || bufHandledPosition >= kBlockSize - 7) {
        const position = ++blockIndex * kBlockSize
        const { bytesRead } = await this._file.read(
          buf,
          0,
          kBlockSize,
          position
        )
        if (bytesRead === 0) {
          await this._file.close()
          return
        }
        bufHandledPosition = 0
        continue
      }

      // buf may be re-fill, to avoid this, copy it
      const record = this.decode(Buffer.from(buf.slice(bufHandledPosition)))
      bufHandledPosition += record.data.length
      if (record.type === RecordType.kFullType) {
        const op = new Slice(record.data.buffer)
        yield op
      } else if (record.type === RecordType.kLastType) {
        assert(latestType !== RecordType.kLastType)
        latestOpBuf = Buffer.concat([latestOpBuf, record.data.buffer])
        assert(record.length === latestOpBuf.length)
        const op = new Slice(latestOpBuf)
        latestOpBuf = Buffer.alloc(0)
        yield op
      } else if (record.type === RecordType.kFirstType) {
        assert(latestType !== RecordType.kFirstType)
        latestOpBuf = record.data.buffer
      } else if (record.type === RecordType.kMiddleType) {
        latestOpBuf = Buffer.concat([latestOpBuf, record.data.buffer])
      } else if (record.type === RecordType.kZeroType) {
        latestType = record.type
        bufHandledPosition = kBlockSize
      }
      latestType = record.type
    }
  }

  decode(buf: Buffer): Record {
    const head = buf.slice(0, kHeaderSize)
    const recordType = head[6]
    const head4 = head[4] & 0xff
    const head5 = head[5] & 0xff
    const length = head4 | (head5 << 8)

    const data = new Slice(buf.slice(kHeaderSize, kHeaderSize + length))
    return {
      length,
      data,
      type: recordType,
    }
  }
}
