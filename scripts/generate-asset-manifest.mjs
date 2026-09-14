import { mkdir, writeFile } from 'node:fs/promises'

const slots = []
const add = (group, priority, prefix, count, digits = 2) => {
  for (let i = 1; i <= count; i += 1) slots.push({ id: `${prefix}_${String(i).padStart(digits, '0')}`, group, priority, status: 'planned' })
}

add('Ground/Grass', 'P0', 'tile_ground_grass', 8)
add('Ground/Dirt', 'P1', 'tile_ground_dirt', 4)
add('Ground/Stone', 'P1', 'tile_ground_stone', 4)
add('Autotile/GrassEdge', 'P0', 'tile_autotile_grass_edge', 47, 3)
add('Height/Cliff', 'P0', 'tile_cliff', 24)
add('Height/Ramp', 'P0', 'tile_ramp', 8)
add('Water/River', 'P0', 'tile_river', 20)
add('Water/Lake', 'P0', 'tile_lake', 16)
add('Water/Waterfall', 'P1', 'tile_waterfall', 6)
add('Path/DirtRoad', 'P0', 'tile_road_dirt', 16)
add('Decal/GroundDetail', 'P1', 'decal_ground', 20)
add('Objects/Tree', 'P0', 'obj_tree', 12)
add('Objects/Bush', 'P0', 'obj_bush', 8)
add('Objects/Rock', 'P0', 'obj_rock', 8)
add('Objects/Wood', 'P1', 'obj_wood', 6)
add('Objects/JungleProp', 'P1', 'obj_jungle_prop', 8)
add('Objects/Animal', 'P0', 'animal', 8)
add('Objects/ResourceNode', 'P0', 'obj_resource', 6)

const buildings = ['trap','handcart','hut','hunter_hut','trading_post','tannery','smokehouse','workshop','steelworks','armory']
for (const id of buildings) slots.push({ id: `bld_${id}_lv01`, group: `Buildings/${id}`, priority: 'P0', status: 'planned' })

if (slots.length !== 239) throw new Error(`Expected 239 asset slots, got ${slots.length}`)
await mkdir('public/Art/Map', { recursive: true })
await writeFile('public/Art/Map/asset_manifest.json', `${JSON.stringify({ version: '1.0', tileSize: [256, 148], total: slots.length, slots }, null, 2)}\n`)

const masks = ['id,neighbor_mask,tile_id']
for (let i = 1; i <= 47; i += 1) masks.push(`${String(i).padStart(3, '0')},TODO,${i - 1}`)
await writeFile('public/Art/Map/autotile_grass_edge_mask.csv', `${masks.join('\n')}\n`)
console.log(`Generated ${slots.length} planned asset slots.`)
