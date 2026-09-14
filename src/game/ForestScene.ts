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
  tile: Phaser.GameObjects.Graphics
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

  create() {
    this.cameras.main.setBackgroundColor('#173a31')
    this.drawBackdrop()
    this.createTerrain()
    this.createEnvironment()
    this.createCamp()
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
        const tile = this.add.graphics().setPosition(x, y).setDepth(y - 100)
        const color = terrain === 'water' ? 0x397d83 : terrain === 'dirt' ? 0x9a8051 : terrain === 'highland' ? 0x6f9b5f : ((col + row) % 2 ? 0x78a968 : 0x82b371)
        if (elevation) this.drawCliff(tile)
        tile.fillStyle(color).lineStyle(1, terrain === 'water' ? 0x69a4a0 : 0x91bd78, .28)
        tile.beginPath().moveTo(0, -TILE_HEIGHT / 2).lineTo(TILE_WIDTH / 2, 0).lineTo(0, TILE_HEIGHT / 2).lineTo(-TILE_WIDTH / 2, 0).closePath().fillPath().strokePath()
        if (terrain === 'water') {
          tile.lineStyle(2, 0x8abbb2, .28).beginPath().moveTo(-24, 2).lineTo(-5, 8).lineTo(19, 2).strokePath()
        }
        line.push({ col, row, terrain, elevation, occupied: terrain === 'water', tile })
      }
      this.cells.push(line)
    }
  }

  private drawCliff(g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0x526f48)
    g.beginPath().moveTo(-TILE_WIDTH / 2, 0).lineTo(0, TILE_HEIGHT / 2).lineTo(0, TILE_HEIGHT / 2 + ELEVATION_HEIGHT).lineTo(-TILE_WIDTH / 2, ELEVATION_HEIGHT).closePath().fillPath()
    g.fillStyle(0x49633f)
    g.beginPath().moveTo(TILE_WIDTH / 2, 0).lineTo(0, TILE_HEIGHT / 2).lineTo(0, TILE_HEIGHT / 2 + ELEVATION_HEIGHT).lineTo(TILE_WIDTH / 2, ELEVATION_HEIGHT).closePath().fillPath()
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
    const shadow = this.add.ellipse(0, 7, 62, 22, 0x193c31, .28)
    const trunk = this.add.rectangle(0, -21, 13, 47, 0x72533a)
    const crown = this.add.graphics()
    const shade = seed % 3
    const dark = [0x315f43, 0x376d49, 0x2f6448][shade]
    const light = [0x568457, 0x5d915e, 0x4f865b][shade]
    crown.fillStyle(dark).fillCircle(-13, -64, 30).fillCircle(17, -61, 32).fillCircle(2, -85, 34)
    crown.fillStyle(light).fillCircle(-10, -80, 22).fillCircle(13, -91, 21)
    return c.add([shadow, trunk, crown])
  }

  private makeRock(col: number, row: number) {
    const { x, y } = this.iso(col, row, this.cells[row][col].elevation)
    const c = this.add.container(x, y).setDepth(y + 10)
    const g = this.add.graphics()
    g.fillStyle(0x526b63, .28).fillEllipse(0, 5, 54, 18)
    g.fillStyle(0x68786c).beginPath().moveTo(-23, 1).lineTo(-13, -28).lineTo(13, -35).lineTo(27, -4).lineTo(15, 8).lineTo(-14, 9).closePath().fillPath()
    g.fillStyle(0x879282).beginPath().moveTo(-13,-28).lineTo(13,-35).lineTo(5,-17).lineTo(-16,-12).closePath().fillPath()
    return c.add(g)
  }

  private makeBush(col: number, row: number) {
    const { x, y } = this.iso(col, row, this.cells[row][col].elevation)
    const c = this.add.container(x, y).setDepth(y + 10)
    const g = this.add.graphics()
    g.fillStyle(0x2d6041, .28).fillEllipse(0, 5, 58, 18)
    g.fillStyle(0x417b4d).fillCircle(-16, -11, 18).fillCircle(6, -19, 23).fillCircle(23, -8, 16)
    g.fillStyle(0x689b5c).fillCircle(3, -28, 12).fillCircle(-13, -20, 10)
    return c.add(g)
  }

  private createCamp() {
    this.cells[5][5].occupied = true
    const { x, y } = this.iso(5, 5, 0)
    const c = this.add.container(x, y).setDepth(y + 12)
    const g = this.add.graphics()
    g.fillStyle(0x263f35, .32).fillEllipse(0, 7, 72, 24)
    g.lineStyle(7, 0x6d4730).lineBetween(-25, 2, 25, -13).lineBetween(-22, -14, 22, 3)
    g.fillStyle(0xe06c3d).fillTriangle(-12, -7, 12, -7, 0, -47)
    g.fillStyle(0xf2b14d).fillTriangle(-7, -8, 7, -8, 1, -32)
    c.add(g)
    this.add.text(x, y + 20, '营地', { fontFamily: 'Microsoft YaHei, sans-serif', fontSize: '11px', color: '#f7e5b6', backgroundColor: '#28483d', padding: { x: 7, y: 3 } }).setOrigin(.5, 0).setDepth(y + 50)
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
    const g = this.add.graphics()
    g.fillStyle(0x1d3c33, .3).fillEllipse(0, 14, 84, 28)
    if (def.id === 'trap') {
      g.lineStyle(5, 0x8b603c).strokeEllipse(0, -4, 62, 28)
      for (let i = -2; i <= 2; i += 1) g.lineBetween(i * 11, -18, i * 8, 9)
    } else if (def.id === 'handcart') {
      g.fillStyle(def.color).fillRect(-32, -30, 58, 28)
      g.fillStyle(0x4a3a2d).fillCircle(-20, 3, 13).fillCircle(21, 3, 13)
      g.lineStyle(6, 0x6b4a31).lineBetween(25, -19, 49, -31)
    } else {
      g.fillStyle(0x9a724b).fillRect(-34, -54, 68, 62)
      g.fillStyle(def.color).beginPath().moveTo(-48,-49).lineTo(0,-92).lineTo(49,-49).lineTo(31,-35).lineTo(0,-66).lineTo(-32,-35).closePath().fillPath()
      g.fillStyle(0x4b392c).fillRect(-10, -27, 20, 35)
      g.fillStyle(0xe8c878).fillRect(17, -40, 13, 15)
      if (['smokehouse','steelworks','workshop'].includes(def.id)) {
        g.fillStyle(0x625d52).fillRect(20, -80, 13, 39)
        const smoke = this.add.circle(27, -93, 8, 0xd8d0b5, .55)
        c.add(smoke)
        this.tweens.add({ targets: smoke, y: -125, alpha: 0, scale: 1.7, duration: 1800, repeat: -1 })
      }
    }
    c.add(g)
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
