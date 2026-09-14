import Phaser from 'phaser'
import {
  BUILDINGS,
  ELEVATION_HEIGHT,
  MAP_ORIGIN,
  MAP_SIZE,
  TILE_HEIGHT,
  TILE_WIDTH,
  type BuildingDefinition,
  type Terrain,
  type ToolMode,
} from './config'
import { events, resources } from './events'

interface Cell {
  col: number
  row: number
  terrain: Terrain
  elevation: number
  occupied: boolean
  tile: Phaser.GameObjects.Image
}

interface ForestObject {
  col: number
  row: number
  kind: 'tree' | 'rock' | 'bush'
  display: Phaser.GameObjects.Container
  depleted: boolean
}

export class ForestScene extends Phaser.Scene {
  private cells: Cell[][] = []
  private objects: ForestObject[] = []
  private selectedBuilding: BuildingDefinition | null = BUILDINGS[2]
  private mode: ToolMode = 'build'
  private hoverMarker!: Phaser.GameObjects.Graphics
  private builtCount = 0

  constructor() { super('forest') }

  preload() {
    const root = `${import.meta.env.BASE_URL}Art/Map/PNG`
    for (let i = 1; i <= 8; i += 1) this.load.image(`ground_grass_${i}`, `${root}/Tiles/Ground/Grass/tile_ground_grass_${String(i).padStart(2, '0')}.png`)
    for (let i = 1; i <= 4; i += 1) this.load.image(`ground_dirt_${i}`, `${root}/Tiles/Ground/Dirt/tile_ground_dirt_${String(i).padStart(2, '0')}.png`)
    for (const dir of ['ne', 'se', 'sw', 'nw']) this.load.image(`lake_edge_${dir}`, `${root}/Tiles/Water/Lake/tile_lake_edge_${dir}.png`)
    this.load.image('cliff_outer_ne', `${root}/Tiles/Height/Cliff/tile_cliff_outer_ne.png`)
    for (let i = 1; i <= 4; i += 1) this.load.image(`tree_${i}`, `${root}/Objects/Tree/obj_tree_broadleaf_${String(i).padStart(2, '0')}.png`)
    for (let i = 1; i <= 3; i += 1) this.load.image(`pine_${i}`, `${root}/Objects/Tree/obj_tree_pine_${String(i).padStart(2, '0')}.png`)
    for (let i = 1; i <= 3; i += 1) this.load.image(`rock_${i}`, `${root}/Objects/Rock/obj_rock_single_${String(i).padStart(2, '0')}.png`)
    for (let i = 1; i <= 3; i += 1) this.load.image(`bush_${i}`, `${root}/Objects/Bush/obj_bush_shrub_${String(i).padStart(2, '0')}.png`)
    const folders: Record<string, string> = { trap: 'Trap', handcart: 'Handcart', hut: 'Hut', hunter_hut: 'HunterHut', trading_post: 'TradingPost', tannery: 'Tannery', smokehouse: 'Smokehouse', workshop: 'Workshop', steelworks: 'Steelworks', armory: 'Armory' }
    for (const building of BUILDINGS) this.load.image(`building_${building.id}`, `${root}/Buildings/${folders[building.id]}/Source/bld_${building.id}_lv01.png`)
  }

  create() {
    this.cameras.main.setBackgroundColor('#173a31')
    this.drawBackdrop()
    this.createTerrain()
    this.createEnvironment()
    this.createHoverMarker()
    this.bindInput()
    events.on('select-building', this.selectBuilding, this)
    events.on('set-mode', this.setMode, this)
    events.on('zoom', this.zoom, this)
    events.on('place-screen', this.placeAtScreen, this)
    events.emit('resources', { ...resources })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => events.removeAllListeners())
  }

  private drawBackdrop() {
    const g = this.add.graphics().setDepth(-20)
    g.fillStyle(0x102e27).fillRect(0, 0, 1440, 900)
    g.fillStyle(0x1b473a, .55).fillCircle(720, 340, 650)
  }

  private terrainAt(col: number, row: number): Terrain {
    const water = (col >= 8 && row >= 7) || (col === 9 && row >= 5) || (col === 10 && row >= 4)
    if (water) return 'water'
    if (col >= 7 && col <= 9 && row <= 2) return 'highland'
    const road = Math.abs(col - row - 1) <= .2 && col < 6
    if (road) return 'dirt'
    return 'grass'
  }

  private createTerrain() {
    for (let row = 0; row < MAP_SIZE; row += 1) {
      const line: Cell[] = []
      for (let col = 0; col < MAP_SIZE; col += 1) {
        const terrain = this.terrainAt(col, row)
        const elevation = terrain === 'highland' ? 1 : 0
        const { x, y } = this.iso(col, row, elevation)
        const direction = ['ne', 'se', 'sw', 'nw'][(col + row) % 4]
        const texture = terrain === 'water' ? `lake_edge_${direction}` : terrain === 'dirt' ? `ground_dirt_${(col + row) % 4 + 1}` : terrain === 'highland' ? 'cliff_outer_ne' : `ground_grass_${(col * 3 + row * 5) % 8 + 1}`
        const tile = this.add.image(x, y, texture).setDepth(y - 100)
        if (terrain === 'highland') tile.setOrigin(.5, 74 / 220).setDisplaySize(TILE_WIDTH, 96)
        else tile.setDisplaySize(TILE_WIDTH, TILE_HEIGHT)
        line.push({ col, row, terrain, elevation, occupied: terrain === 'water', tile })
      }
      this.cells.push(line)
    }
  }

  private createEnvironment() {
    const candidates: Array<[number, number, ForestObject['kind']]> = [
      [0,0,'tree'],[1,0,'tree'],[2,0,'tree'],[3,0,'bush'],[4,0,'tree'],[5,0,'rock'],[6,0,'tree'],[10,0,'tree'],
      [0,1,'tree'],[10,1,'bush'],[0,2,'rock'],[10,2,'tree'],[0,3,'tree'],[10,3,'tree'],[0,4,'bush'],
      [0,5,'tree'],[10,5,'tree'],[0,6,'tree'],[10,6,'bush'],[0,7,'rock'],[1,8,'tree'],[1,9,'tree'],
      [2,10,'tree'],[3,10,'bush'],[4,10,'tree'],[5,10,'rock'],[6,10,'tree'],[7,10,'tree'],[8,10,'bush'],
      [2,2,'tree'],[8,4,'tree'],[2,7,'tree'],[7,8,'rock'],[3,8,'bush'],
    ]
    candidates.forEach(([col, row, kind], index) => {
      if (this.cells[row][col].terrain === 'water') return
      this.cells[row][col].occupied = true
      const display = kind === 'tree' ? this.makeTree(col, row, index) : kind === 'rock' ? this.makeRock(col, row) : this.makeBush(col, row)
      const object: ForestObject = { col, row, kind, display, depleted: false }
      display.setInteractive(new Phaser.Geom.Circle(0, -24, kind === 'tree' ? 32 : 22), Phaser.Geom.Circle.Contains)
      display.on('pointerdown', (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation()
        this.interactObject(object)
      })
      this.objects.push(object)
    })
  }

  private makeTree(col: number, row: number, seed: number) {
    const { x, y } = this.iso(col, row, this.cells[row][col].elevation)
    const c = this.add.container(x, y).setDepth(y + 20)
    const key = seed % 5 === 0 ? `pine_${seed % 3 + 1}` : `tree_${seed % 4 + 1}`
    const image = this.add.image(0, 0, key).setOrigin(.5, 270 / 296).setDisplaySize(104, 120)
    return c.add(image)
  }

  private makeRock(col: number, row: number) {
    const { x, y } = this.iso(col, row, this.cells[row][col].elevation)
    const c = this.add.container(x, y).setDepth(y + 10)
    const image = this.add.image(0, 0, `rock_${(col + row) % 3 + 1}`).setOrigin(.5, 270 / 296).setDisplaySize(82, 95)
    return c.add(image)
  }

  private makeBush(col: number, row: number) {
    const { x, y } = this.iso(col, row, this.cells[row][col].elevation)
    const c = this.add.container(x, y).setDepth(y + 10)
    const image = this.add.image(0, 0, `bush_${(col + row) % 3 + 1}`).setOrigin(.5, 270 / 296).setDisplaySize(78, 90)
    return c.add(image)
  }

  private createHoverMarker() {
    this.hoverMarker = this.add.graphics().setDepth(10000).setVisible(false)
    this.hoverMarker.lineStyle(3, 0xf4d37c, .9)
    this.hoverMarker.beginPath().moveTo(0, -TILE_HEIGHT / 2).lineTo(TILE_WIDTH / 2, 0).lineTo(0, TILE_HEIGHT / 2).lineTo(-TILE_WIDTH / 2, 0).closePath().strokePath()
  }

  private bindInput() {
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
      const cell = this.worldToCell(world.x, world.y)
      if (!cell) return this.hoverMarker.setVisible(false)
      const pos = this.iso(cell.col, cell.row, cell.elevation)
      this.hoverMarker.setPosition(pos.x, pos.y).setVisible(true)
    })
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y)
      this.handleWorldAction(world.x, world.y)
    })
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _dx: number, dy: number) => this.zoom(dy > 0 ? -1 : 1))
  }

  private selectBuilding(id: string) {
    this.selectedBuilding = BUILDINGS.find((item) => item.id === id) ?? null
    this.mode = 'build'
  }

  private setMode(mode: ToolMode) {
    this.mode = mode
    if (mode !== 'build') this.selectedBuilding = null
  }

  private interactObject(object: ForestObject) {
    if (this.mode !== 'clear' || object.depleted) {
      events.emit('toast', object.kind === 'tree' ? '切换到清理工具后可砍伐树木' : '这是独立场景物件')
      return
    }
    object.depleted = true
    this.tweens.add({ targets: object.display, alpha: 0, scale: .72, y: object.display.y - 12, duration: 280, ease: 'Quad.easeIn', onComplete: () => object.display.destroy() })
    this.cells[object.row][object.col].occupied = false
    const gain = object.kind === 'tree' ? 35 : object.kind === 'rock' ? 20 : 8
    if (object.kind === 'rock') resources.stone += gain
    else resources.wood += gain
    events.emit('resources', { ...resources })
    events.emit('toast', `${object.kind === 'rock' ? '石料' : '木材'} +${gain}`)
  }

  public placeAtScreen(clientX: number, clientY: number) {
    const canvas = this.game.canvas.getBoundingClientRect()
    const px = (clientX - canvas.left) * (this.scale.gameSize.width / canvas.width)
    const py = (clientY - canvas.top) * (this.scale.gameSize.height / canvas.height)
    const world = this.cameras.main.getWorldPoint(px, py)
    this.handleWorldAction(world.x, world.y)
  }

  private handleWorldAction(x: number, y: number) {
    const cell = this.worldToCell(x, y)
    if (!cell) return
    if (this.mode === 'inspect') {
      events.emit('toast', `格 ${cell.col + 1}-${cell.row + 1} · ${cell.terrain} · ${cell.occupied ? '已占用' : '可用'}`)
      return
    }
    if (this.mode !== 'build' || !this.selectedBuilding) return
    this.placeBuilding(cell, this.selectedBuilding)
  }

  private placeBuilding(cell: Cell, def: BuildingDefinition) {
    if (cell.terrain === 'water' || cell.terrain === 'highland' || cell.occupied) {
      events.emit('toast', '这里不能建造，请选择中央空地')
      return
    }
    if (resources.wood < def.cost.wood || resources.stone < def.cost.stone || resources.food < (def.cost.food ?? 0)) {
      events.emit('toast', '资源不足，先清理树木或岩石')
      return
    }
    resources.wood -= def.cost.wood
    resources.stone -= def.cost.stone
    if (def.id === 'hut') resources.population += 2
    cell.occupied = true
    this.makeBuilding(cell, def)
    this.builtCount += 1
    events.emit('resources', { ...resources })
    events.emit('built', { count: this.builtCount, id: def.id })
    events.emit('toast', `${def.name}建造完成`)
  }

  private makeBuilding(cell: Cell, def: BuildingDefinition) {
    const { x, y } = this.iso(cell.col, cell.row, cell.elevation)
    const c = this.add.container(x, y - 8).setDepth(y + 18).setScale(.2).setAlpha(.2)
    const image = this.add.image(0, 0, `building_${def.id}`).setOrigin(.5, 370 / 430).setDisplaySize(158, 133)
    c.add(image)
    c.add(this.add.text(0, 21, def.name, { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '11px', color: '#fff3cf', backgroundColor: '#26483c', padding: { x: 7, y: 3 } }).setOrigin(.5, 0))
    this.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 380, ease: 'Back.easeOut' })
  }

  private zoom(direction: number) {
    const camera = this.cameras.main
    camera.zoom = Phaser.Math.Clamp(camera.zoom + direction * .08, .68, 1.28)
  }

  private iso(col: number, row: number, elevation = 0) {
    return {
      x: MAP_ORIGIN.x + (col - row) * TILE_WIDTH / 2,
      y: MAP_ORIGIN.y + (col + row) * TILE_HEIGHT / 2 - elevation * ELEVATION_HEIGHT,
    }
  }

  private worldToCell(x: number, y: number): Cell | null {
    const dx = (x - MAP_ORIGIN.x) / (TILE_WIDTH / 2)
    const dy = (y - MAP_ORIGIN.y) / (TILE_HEIGHT / 2)
    const col = Math.round((dx + dy) / 2)
    const row = Math.round((dy - dx) / 2)
    if (col < 0 || row < 0 || col >= MAP_SIZE || row >= MAP_SIZE) return null
    return this.cells[row][col]
  }
}
