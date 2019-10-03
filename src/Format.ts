/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import assert from 'assert'
import varint from 'varint'
import Slice from './Slice'
import { Comparator } from './Comparator'
import { InternalKey } from './VersionFormat'
import SequenceNumber from './SequenceNumber'
import { decodeFixed64 } from './Coding'

export enum FileType {
  kLogFile,
  kDBLockFile,
  kTableFile,
  kDescriptorFile,
  kCurrentFile,
  kTempFile,
  kInfoLogFile, // Either the current one, or an old one
}

export enum ValueType {
  kTypeDeletion = 0x00,
  kTypeValue = 0x01,
}

export const kValueTypeForSeek = ValueType.kTypeValue

export enum RecordType {
  // Zero is reserved for preallocated files
  kZeroType = 0,

  kFullType = 1,

  // For fragments
  kFirstType = 2,
  kMiddleType = 3,
  kLastType = 4,
}

export enum VersionEditTag {
  kComparator = 1,
  kLogNumber = 2,
  kNextFileNumber = 3,
  kLastSequence = 4,
  kCompactPointer = 5,
  kDeletedFile = 6,
  kNewFile = 7,
  // 8 was used for large value refs
  kPrevLogNumber = 9,
}

export enum CompressionTypes {
  none = 0x00,
}

export const kBlockSize = 32768 // 32KB
export const kMemTableDumpSize = 4194304 // 4MB

export class Config {
  static kNumLevels = 7 // 0...6

  // Level-0 compaction is started when we hit this many files.
  static kL0CompactionTrigger = 4

  // Soft limit on number of level-0 files.  We slow down writes at this point.
  static kL0SlowdownWritesTrigger = 8

  // Maximum number of level-0 files.  We stop writes at this point.
  static kL0StopWritesTrigger = 12

  // Maximum level to which a new compacted memtable is pushed if it
  // does not create overlap.  We try to push to level 2 to avoid the
  // relatively expensive level 0=>1 compactions and to avoid some
  // expensive manifest file operations.  We do not push all the way to
  // the largest level since that can generate a lot of wasted disk
  // space if the same key space is being repeatedly overwritten.
  static kMaxMemCompactLevel = 2

  // Approximate gap in bytes between samples of data read during iteration.
  static kReadBytesPeriod = 1048576
}

export class InternalKeyComparator implements Comparator {
  static extractUserKey(slice: Slice) {
    assert(slice.size > 8)
    return new Slice(slice.buffer.slice(0, slice.size - 8))
  }

  constructor(userComparator: Comparator) {
    this._userComparator = userComparator
  }

  private _userComparator: Comparator

  get userComparator() {
    return this._userComparator
  }

  getName(): string {
    return 'leveldb.InternalKeyComparator'
  }

  findShortestSeparator(start: Slice, limit: Slice) {
    // Find length of common prefix
    let minLength = Math.min(start.length, limit.length)
    let diffIndex = 0
    while (
      diffIndex < minLength &&
      start.buffer[diffIndex] == limit.buffer[diffIndex]
    ) {
      diffIndex++
    }

    if (diffIndex >= minLength) {
      // Do not shorten if one string is a prefix of the other
    } else {
      let diffByte = start.buffer[diffIndex]
      if (diffByte < 0xff && diffByte + 1 < limit.buffer[diffIndex]) {
        start.buffer[diffIndex]++
        start.buffer = start.buffer.slice(0, diffIndex + 1)
        assert(this.compare(start, limit) < 0)
      }
    }
  }

  findShortSuccessor(key: Slice) {
    // Find first character that can be incremented
    let n = key.length
    for (let i = 0; i < n; i++) {
      const byte = key.buffer[i]
      if (byte !== 0xff) {
        key.buffer[i] = byte + 1
        key.buffer = key.buffer.slice(0, i + 1)
        return
      }
    }
  }

  compare(key1: Slice, key2: Slice) {
    // first compare user key
    const userKey1 = InternalKeyComparator.extractUserKey(key1)
    const userKey2 = InternalKeyComparator.extractUserKey(key2)
    const r = this.userComparator.compare(userKey1, userKey2)
    if (r !== 0) return r
    // then compare sequence number
    const sn1 = varint.decode(key1.buffer, key1.size - 8)
    const sn2 = varint.decode(key2.buffer, key2.size - 8)
    if (sn1 === sn2) return 0
    return sn1 > sn2 ? -1 : 1
  }
}

export class ParsedInternalKey {
  userKey!: Slice
  sn!: SequenceNumber
  valueType!: ValueType
  constructor(userKey?: Slice, sn?: SequenceNumber, valueType?: ValueType) {
    if (
      typeof userKey !== 'undefined' &&
      typeof sn !== 'undefined' &&
      typeof valueType !== 'undefined'
    ) {
      this.userKey = userKey
      this.sn = sn
      this.valueType = valueType
    }
  }
}

// Attempt to parse an internal key from "internal_key".  On success,
// stores the parsed data in "*result", and returns true.
//
// On error, returns false, leaves "*result" in an undefined state.
export function parseInternalKey(key: Slice, ikey: ParsedInternalKey): boolean {
  ikey.userKey = InternalKey.extractUserKey(key)
  ikey.sn = new SequenceNumber(decodeFixed64(key.buffer.slice(key.length - 8)))
  ikey.valueType = varint.decode(key.buffer.slice(key.length - 1))
  return true
}
