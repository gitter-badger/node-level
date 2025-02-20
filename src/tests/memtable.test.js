import varint from 'varint'
import Slice from '../Slice'
import MemTable from '../MemTable'
import {
  LookupKey,
  ValueType,
  SequenceNumber,
  InternalKeyComparator,
} from '../Format'
import { BytewiseComparator } from '../Comparator'

test('memtable add and get', () => {
  const memtable = new MemTable(
    new InternalKeyComparator(new BytewiseComparator())
  )
  memtable.add(
    new SequenceNumber(10),
    ValueType.kTypeValue,
    new Slice('key'),
    new Slice('key1valuevalue1')
  )
  memtable.add(
    new SequenceNumber(20),
    ValueType.kTypeValue,
    new Slice('key2'),
    new Slice('key2valuevadfa')
  )
  memtable.add(
    new SequenceNumber(30),
    ValueType.kTypeValue,
    new Slice('key3'),
    new Slice('key3value12389fdajj123')
  )

  expect(
    !!memtable.get(new LookupKey(new Slice('key'), new SequenceNumber(1000)))
  ).toBe(true)

  expect(
    !!memtable.get(new LookupKey(new Slice('key3'), new SequenceNumber(5)))
  ).toBe(false)
})
