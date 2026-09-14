import { describe, expect, it } from 'vitest'

import {
  inventoryFromFiles,
  sha256Hex,
  InventoryError,
  DEFAULT_MAX_BLOB_BYTES,
} from '../inventory'

function fileOf(relativePath: string, content: string, size?: number): File {
  const bytes = new TextEncoder().encode(content)
  return new File(
    [size === undefined ? bytes : new Uint8Array(size)],
    relativePath,
    {
      type: 'text/html',
    },
  ) as File & { webkitRelativePath: string }
}

describe('inventoryFromFiles', () => {
  it('hashes files and returns sorted absolute paths', async () => {
    const files = [
      fileOf('site/z.html', 'z'),
      fileOf('site/a/index.html', 'hello'),
    ]
    const items = await inventoryFromFiles(files)
    expect(items.map((item) => item.path)).toEqual(['/a/index.html', '/z.html'])
    expect(items[1].sha256).toBe(await sha256Hex(new TextEncoder().encode('z')))
  })

  it('rejects a path with a .. substring', async () => {
    await expect(
      inventoryFromFiles([fileOf('site/../secret', 'x')]),
    ).rejects.toThrow(InventoryError)
  })

  it('rejects a backslash path', async () => {
    await expect(
      inventoryFromFiles([fileOf('site/..\\secret', 'x')]),
    ).rejects.toThrow(InventoryError)
  })

  it('rejects an oversize file', async () => {
    await expect(
      inventoryFromFiles([
        fileOf('site/big.html', 'x', DEFAULT_MAX_BLOB_BYTES + 1),
      ]),
    ).rejects.toThrow(/byte limit/)
  })

  it('rejects an empty selection', async () => {
    await expect(inventoryFromFiles([])).rejects.toThrow(InventoryError)
  })
})

describe('sha256Hex', () => {
  it('computes a known digest', async () => {
    expect(await sha256Hex(new TextEncoder().encode('abc'))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
