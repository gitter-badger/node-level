/**
 * Copyright (c) 2018-present, heineiuo.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { BytewiseComparator } from './Comparator'
import BloomFilter from './BloomFilter'
import { Comparator } from './Comparator'
import Slice from './Slice'
import { Env, NodeEnv } from './Env'
import { Snapshot } from './Snapshot'
import { SequenceNumber } from './Format'

export type Encodings = 'string' | 'buffer' | 'json'

export interface EncodingOptions {
  keyEncoding?: Encodings
  valueEncoding?: Encodings
  prefix?: string
}

export interface FilterPolicy {
  name(): string
  keyMayMatch(key: Slice, filter: Slice): boolean
}

export class ReadOptions {
  // If true, all data read from underlying storage will be
  // verified against corresponding checksums.
  verifyChecksums: boolean = false

  // Should the data read for this iteration be cached in memory?
  // Callers may wish to set this field to false for bulk scans.
  fillCache: boolean = true

  // If "snapshot" is non-null, read as of the supplied snapshot
  // (which must belong to the DB that is being read and which must
  // not have been released).  If "snapshot" is null, use an implicit
  // snapshot of the state at the beginning of this read operation.
  snapshot!: SequenceNumber
}

export class Options {
  // Comparator used to define the order of keys in the table.
  // Default: a comparator that uses lexicographic byte-wise ordering
  //
  // REQUIRES: The client must ensure that the comparator supplied
  // here has the same name and orders keys *exactly* the same as the
  // comparator provided to previous open calls on the same DB.
  comparator: Comparator = new BytewiseComparator()

  // Leveldb will write up to this amount of bytes to a file before
  // switching to a new one.
  // Most clients should leave this parameter alone.  However if your
  // filesystem is more efficient with larger files, you could
  // consider increasing the value.  The downside will be longer
  // compactions and hence longer latency/performance hiccups.
  // Another reason to increase this parameter might be when you are
  // initially populating a large database.
  maxFileSize: number = 2 * 1024 * 1024

  // Number of open files that can be used by the DB.  You may need to
  // increase this if your database has a large working set (budget
  // one open file per 2MB of working set).
  maxOpenFiles = 1000

  blockSize: number = 2 << 11
  blockRestartInterval: number = 16
  env: Env = new NodeEnv()
  filterPolicy: FilterPolicy = new BloomFilter()
}
