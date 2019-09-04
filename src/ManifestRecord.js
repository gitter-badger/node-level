/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// @flow

import crc32 from 'buffer-crc32'
import assert from 'assert'
import varint from 'varint'
import Slice from './Slice'
import { RecordType, VersionEditTag } from './Format'
import { createHexStringFromDecimal } from './LevelUtils'

export default class ManifestRecord {
  static from (buf:Buffer) {
    const length = buf.readUInt16BE(4)
    const type = RecordType.get(buf.readUInt8(6))
    const data = new Slice(buf.slice(7, 7 + length))
    assert(length === data.length)
    const record = new ManifestRecord(type, data)
    return record
  }

  static add (key: Slice, value: Slice) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kTypeValue.value]),
      Buffer.from(varint.encode(key.length)),
      key.buffer,
      Buffer.from(varint.encode(value.length)),
      value.buffer
    ]))
  }

  static del (key: Slice) {
    return new Slice(Buffer.concat([
      Buffer.from([VersionEditTag.kTypeDeletion.value]),
      Buffer.from(varint.encode(key.length)),
      key.buffer
    ]))
  }

  static parseOp (op: Slice): { type: VersionEditTag, key: Slice, value: Slice } {
    const valueType = VersionEditTag.get(op.buffer.readUInt8(0))
    let index = 1
    const keyLength = varint.decode(op.buffer.slice(1))
    index += varint.decode.bytes
    const keyBuffer = op.buffer.slice(index, index + keyLength)
    index += keyLength

    if (valueType === VersionEditTag.kTypeDeletion) {
      return {
        type: valueType,
        key: new Slice(keyBuffer)
      }
    }

    const valueLength = varint.decode(op.buffer.slice(index))
    index += varint.decode.bytes
    const valueBuffer = op.buffer.slice(index, index + valueLength)
    return {
      type: valueType,
      key: new Slice(keyBuffer),
      value: new Slice(valueBuffer)
    }
  }

  constructor (type:RecordType, data:Slice | Buffer) {
    this.type = type
    this.data = new Slice(data)
  }

  get length () {
    return this.data.length + 7
  }

  get size () {
    return this.length
  }

  data:Slice
  type:VersionEditTag

  get buffer ():Buffer {
    const lengthBuf = Buffer.from(createHexStringFromDecimal(this.data.length), 'hex')
    const typeBuf = Buffer.from([this.type.value])
    const sum = crc32(Buffer.concat([typeBuf, this.data.buffer]))
    return Buffer.concat([
      sum,
      lengthBuf,
      typeBuf,
      this.data.buffer
    ])
  }
}
