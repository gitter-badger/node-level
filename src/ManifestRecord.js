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
import { Buffer } from 'buffer'
import Slice from './Slice'
import { RecordType, VersionEditTag } from './Format'
import { createHexStringFromDecimal } from './LevelUtils'
import VersionEdit from './VersionEdit'

export default class ManifestRecord {
  static from (buf:Buffer):ManifestRecord {
    const length = buf.readUInt16BE(4)
    const type = RecordType.get(buf.readUInt8(6))
    const data = new Slice(buf.slice(7, 7 + length))
    assert(length === data.length)
    const record = new ManifestRecord(type, data)
    return record
  }

  static add (version:VersionEdit):Slice {
    let bufList:Buffer[] = []
    if (version.hasComparator) {
      bufList.push(Buffer.from([VersionEditTag.kComparator.value]))
      bufList.push(Buffer.from(varint.encode(version.comparator && version.comparator.length)))
      bufList.push(Buffer.from(version.comparator))
    }
    if (version.hasLogNumber) {
      bufList.push(Buffer.from([VersionEditTag.kLogNumber.value]))
      bufList.push(Buffer.from(varint.encode(version.logNumber)))
    }
    if (version.hasPrevLogNumber) {
      bufList.push(Buffer.from([VersionEditTag.kPrevLogNumber.value]))
      bufList.push(Buffer.from(varint.encode(version.logNumber)))
    }
    if (version.hasNextFileNumber) {
      bufList.push(Buffer.from([VersionEditTag.kNextFileNumber.value]))
      bufList.push(Buffer.from(varint.encode(version.logNumber)))
    }
    if (version.hasLastSequence) {
      bufList.push(Buffer.from([VersionEditTag.kLastSequence.value]))
      bufList.push(Buffer.from(varint.encode(version.lastSequence)))
    }
    version.compactPointers.forEach((pointer: { level:Number, internalKey:Slice}) => {
      bufList.push(Buffer.from([VersionEditTag.kCompactPointer.value]))
      bufList.push(Buffer.from(varint.encode(pointer.level)))
      bufList.push(Buffer.from(varint.encode(pointer.internalKey.length)))
      bufList.push(pointer.internalKey.buffer)
    })

    version.deletedFiles.forEach((file: {level: number, fileNum: number}) => {
      bufList.push(Buffer.from([VersionEditTag.kDeletedFile.value]))
      bufList.push(Buffer.from(varint.encode(file.level)))
      bufList.push(Buffer.from(varint.encode(file.fileNum)))
    })

    version.newFiles.forEach((file: {level:number, fileNum:number, fileSize:number, smallestKey:Slice, largestKey:Slice}) => {
      bufList.push(Buffer.from([VersionEditTag.kNewFile.value]))
      bufList.push(Buffer.from(varint.encode(file.level)))
      bufList.push(Buffer.from(varint.encode(file.fileNum)))
      bufList.push(Buffer.from(varint.encode(file.fileSize)))
      bufList.push(Buffer.from(varint.encode(file.smallestKey.length)))
      bufList.push(file.smallestKey.buffer)
      bufList.push(Buffer.from(varint.encode(file.largestKey.length)))
      bufList.push(file.largestKey.buffer)
    })

    return new Slice(Buffer.concat(bufList))
  }

  static parseOp (op: Slice): VersionEdit {
    let index = 0
    const version = new VersionEdit()
    while (index < op.length) {
      const type = VersionEditTag.get(op.buffer.readUInt8(index))
      index += 1

      if (type === VersionEditTag.kComparator) {
        const comparatorNameLength = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        const comparatorName = op.buffer.slice(index, index + comparatorNameLength)
        index += comparatorNameLength
        version.comparator = comparatorName.toString()
        continue
      } else if (type === VersionEditTag.kLogNumber) {
        const logNumber = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        version.logNumber = logNumber
        continue
      } else if (type === VersionEditTag.kPrevLogNumber) {
        const prevLogNumber = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        version.prevLogNumber = prevLogNumber
        continue
      } else if (type === VersionEditTag.kNextLogNumber) {
        const nextFileNumber = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        version.nextFileNumber = nextFileNumber
        continue
      } else if (type === VersionEditTag.kLastSequence) {
        const lastSequence = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        version.lastSequence = lastSequence
        continue
      } else if (type === VersionEditTag.kCompactPointer) {
        const level = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        const internalKeyLength = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        const internalKey = op.buffer.slice(index, index + internalKeyLength)
        index += internalKeyLength
        version.compactPointers.push({
          level,
          internalKey: new Slice(internalKey.buffer)
        })
        continue
      } else if (type === VersionEditTag.kDeletedFile) {
        const level = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        const fileNum = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        version.deletedFiles.push({
          level,
          fileNum
        })
        continue
      } else if (type === VersionEditTag.kNewFile) {
        const level = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        const fileNum = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        const fileSize = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        const smallestKeyLength = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        const smallestKey = op.buffer.slice(index, index + smallestKeyLength)
        index += smallestKeyLength
        const largestKeyLength = varint.decode(op.buffer.slice(index))
        index += varint.decode.bytes
        const largestKey = op.buffer.slice(index, index + largestKeyLength)
        index += largestKeyLength
        version.newFiles.push({
          level,
          fileNum,
          fileSize,
          smallestKey: new Slice(smallestKey),
          largestKey: new Slice(largestKey)
        })
        continue
      }
    }
    return version
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
