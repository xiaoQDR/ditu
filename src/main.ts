import Phaser from 'phaser'
import './styles.css'
import { BUILDINGS, type ToolMode } from './game/config'
import { events, type ResourceState } from './game/events'
import { ForestScene } from './game/ForestScene'

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 1440,
  height: 900,
  backgroundColor: '#173a31',
  antialias: true,
  render: { pixelArt: false, roundPixels: true },
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [ForestScene],
})

const resourcesElement = document.querySelector<HTMLDivElement>('#resources')!
const buildingList = document.querySelector<HTMLDivElement>('#building-list')!
const modeLabel = document.querySelector<HTMLElement>('#mode-label')!
const toast = document.querySelector<HTMLDivElement>('#toast')!
const taskTitle = document.querySelector<HTMLElement>('#task-title')!
const taskCopy = document.querySelector<HTMLElement>('#task-copy')!
const taskProgress = document.querySelector<HTMLElement>('#task-progress')!
let toastTimer = 0
let selectedId = 'hut'

function renderResources(value: ResourceState) {
  const items = [
    ['人口', value.population, '👤'],
    ['木材', value.wood, '▥'],
    ['石料', value.stone, '◆'],
    ['食物', value.food, '●'],
  ]
  resourcesElement.innerHTML = items.map(([label, count, icon]) => `<div class="resource"><span>${icon} ${label}</span><b>${count}</b></div>`).join('')
}

function renderBuildings() {
  buildingList.innerHTML = BUILDINGS.map((item) => `
    <button class="building-card ${item.id === selectedId ? 'is-selected' : ''}" data-building="${item.id}" draggable="true" style="--accent:${item.colorCss}">
      <span class="building-card__icon">${item.symbol}</span><strong>${item.name}</strong>
      <small>木 ${item.cost.wood} · 石 ${item.cost.stone}</small>
    </button>`).join('')
  buildingList.querySelectorAll<HTMLButtonElement>('[data-building]').forEach((button) => {
    const select = () => {
      selectedId = button.dataset.building!
      events.emit('select-building', selectedId)
      document.querySelectorAll('.building-card').forEach((card) => card.classList.toggle('is-selected', card === button))
      document.querySelectorAll('.tool-rail button').forEach((tool) => tool.classList.toggle('is-active', (tool as HTMLElement).dataset.mode === 'build'))
      modeLabel.textContent = `已选择：${BUILDINGS.find((item) => item.id === selectedId)?.name}`
    }
    button.addEventListener('click', select)
    button.addEventListener('dragstart', (event) => {
      select()
      event.dataTransfer?.setData('text/plain', selectedId)
    })
  })
}

renderBuildings()
renderResources({ wood: 520, stone: 260, food: 140, population: 0 })

events.on('resources', renderResources)
events.on('toast', (message: string) => {
  window.clearTimeout(toastTimer)
  toast.textContent = message
  toast.classList.add('is-visible')
  toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1900)
})
events.on('built', ({ count, id }: { count: number; id: string }) => {
  taskProgress.style.width = `${Math.min(100, 12 + count * 18)}%`
  if (id === 'hut') {
    taskTitle.textContent = '清理外围树木'
    taskCopy.textContent = '切换清理工具，点击树木回收木材。'
  }
  if (count >= 5) {
    taskTitle.textContent = '聚落运转正常'
    taskCopy.textContent = '继续规划道路、高地和功能建筑。'
    taskProgress.style.width = '100%'
  }
})

document.querySelectorAll<HTMLButtonElement>('.tool-rail button').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode as ToolMode
    events.emit('set-mode', mode)
    document.querySelectorAll('.tool-rail button').forEach((item) => item.classList.toggle('is-active', item === button))
    document.querySelectorAll('.building-card').forEach((card) => card.classList.toggle('is-selected', false))
    modeLabel.textContent = mode === 'clear' ? '点击树木或岩石进行清理' : mode === 'inspect' ? '点击格子查看地形信息' : '选择建筑后点击地图格'
  })
})

document.querySelector('#zoom-in')?.addEventListener('click', () => events.emit('zoom', 1))
document.querySelector('#zoom-out')?.addEventListener('click', () => events.emit('zoom', -1))
document.querySelector('#zoom-reset')?.addEventListener('click', () => {
  const scene = game.scene.getScene('forest')
  scene.cameras.main.setZoom(1).centerOn(720, 420)
})

const canvasHost = document.querySelector<HTMLDivElement>('#game')!
canvasHost.addEventListener('dragover', (event) => event.preventDefault())
canvasHost.addEventListener('drop', (event) => {
  event.preventDefault()
  const id = event.dataTransfer?.getData('text/plain')
  if (id) events.emit('select-building', id)
  events.emit('place-screen', event.clientX, event.clientY)
})

const dialog = document.querySelector<HTMLDialogElement>('#help-dialog')!
document.querySelector('#help-btn')?.addEventListener('click', () => dialog.showModal())
document.querySelector('#help-close')?.addEventListener('click', () => dialog.close())
