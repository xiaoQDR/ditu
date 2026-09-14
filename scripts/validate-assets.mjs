import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'

const root = 'public/Art/Map'
const files = []
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await walk(path)
    else if (entry.name.endsWith('.svg')) files.push(path)
  }
}
await walk(root)
if (files.length !== 239) throw new Error(`SVG count mismatch: ${files.length}/239`)

const forbidden = /<(?:filter|image|mask)\b|blur\s*\(|feGaussianBlur|noise|base64/i
for (const file of files) {
  const name = relative(root, file)
  if (/[^a-zA-Z0-9_./-]/.test(name) || /\s/.test(name)) throw new Error(`Invalid path: ${name}`)
  const content = await readFile(file, 'utf8')
  if (!content.startsWith('<svg') || !content.includes('viewBox=')) throw new Error(`Invalid SVG: ${name}`)
  if (forbidden.test(content)) throw new Error(`Forbidden SVG feature: ${name}`)
}

const manifest = JSON.parse(await readFile(join(root, 'asset_manifest.json'), 'utf8'))
if (manifest.total !== 239 || manifest.assets.length !== 239) throw new Error('Manifest count mismatch')
const rows = (await readFile(join(root, 'autotile_grass_edge_mask.csv'), 'utf8')).trim().split('\n')
if (rows.length !== 48 || new Set(rows.slice(1).map((row) => row.split(',')[1])).size !== 47) throw new Error('Autotile mask table invalid')
console.log('Validated 239 SVGs: paths, markup, manifest and 47 autotile masks passed.')
