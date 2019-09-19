import fs_ from 'fs'
import path from 'path'
import Slice from '../Slice'
import SSTable from '../SSTable'
import SSTableBuilder from '../SSTableBuilder'
import dbpath from '../../fixtures/dbpath'

const fs = fs_.promises

function padLeft(str, total = 10) {
  if (str.length < total) {
    return padLeft(`0${str}`, total)
  }
  return str
}

function sortedKey(index) {
  return new Slice(`key${padLeft(String(index))}`)
}

function randomValue(index) {
  return new Slice(`value${padLeft(String(index))}`)
}

test('sstable', async () => {
  await fs.mkdir(dbpath, { recursive: true })
  const tablePath = path.resolve(dbpath, './0001.ldb')
  // await fs.writeFile(tablePath, Buffer.alloc(0))
  const file = await fs.open(tablePath, 'w')
  const tableWritter = new SSTableBuilder(file)

  let i = 0
  while (i < 5000) {
    await tableWritter.add(sortedKey(i), randomValue(i))
    i++
  }

  await tableWritter.close()

  const ldbPath = path.resolve(dbpath, './0001.ldb')
  const buf = await fs.readFile(ldbPath)
  const table = new SSTable(buf)
  // console.log(table._footer.get())

  let count = 0
  for (let result of table.dataBlockIterator()) {
    count++
  }
  // check this later
  // expect(count).toBe(3010)
  expect(table.get(sortedKey(1))).toBe('value0000000001')
})
