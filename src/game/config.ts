export const TILE_WIDTH = 112
export const TILE_HEIGHT = 65
export const MAP_SIZE = 11
export const MAP_ORIGIN = { x: 720, y: 82 }
export const ELEVATION_HEIGHT = 37

export type Terrain = 'grass' | 'dirt' | 'water' | 'highland'
export type ToolMode = 'build' | 'clear' | 'inspect'

export interface BuildingDefinition {
  id: string
  name: string
  symbol: string
  color: number
  colorCss: string
  cost: { wood: number; stone: number; food?: number }
}

export const BUILDINGS: BuildingDefinition[] = [
  { id: 'trap', name: '陷阱', symbol: '×', color: 0xc99458, colorCss: '#c99458', cost: { wood: 15, stone: 5 } },
  { id: 'handcart', name: '手推车', symbol: '●', color: 0xd5a85d, colorCss: '#d5a85d', cost: { wood: 25, stone: 0 } },
  { id: 'hut', name: '小屋', symbol: '⌂', color: 0xe1b36b, colorCss: '#e1b36b', cost: { wood: 60, stone: 15 } },
  { id: 'hunter_hut', name: '猎人小屋', symbol: '⌁', color: 0x9daf68, colorCss: '#9daf68', cost: { wood: 90, stone: 25 } },
  { id: 'trading_post', name: '交易站', symbol: '◆', color: 0xe0c06c, colorCss: '#e0c06c', cost: { wood: 120, stone: 35 } },
  { id: 'tannery', name: '制革屋', symbol: '◒', color: 0xb9825e, colorCss: '#b9825e', cost: { wood: 130, stone: 25 } },
  { id: 'smokehouse', name: '熏肉房', symbol: '≋', color: 0xc47b58, colorCss: '#c47b58', cost: { wood: 140, stone: 40 } },
  { id: 'workshop', name: '工坊', symbol: '⚒', color: 0x7aa58a, colorCss: '#7aa58a', cost: { wood: 160, stone: 70 } },
  { id: 'steelworks', name: '炼钢坊', symbol: '▲', color: 0x839196, colorCss: '#839196', cost: { wood: 190, stone: 110 } },
  { id: 'armory', name: '军械库', symbol: '◇', color: 0x8c8f78, colorCss: '#8c8f78', cost: { wood: 220, stone: 150 } },
]
