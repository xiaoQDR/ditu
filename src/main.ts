import './styles.css'

interface AssetItem {
  id: string
  group: string
  priority: string
  path: string
  format: string
  size: [number, number]
  status: string
}

interface AssetManifest {
  version: string
  view: string
  groundAxis: number
  tileSize: [number, number]
  total: number
  counts: {
    terrain: number
    objects: number
    buildings: number
  }
  assets: AssetItem[]
}

type Category = 'all' | 'terrain' | 'objects' | 'buildings'

const categoryLabels: Record<Category, string> = {
  all: '全部',
  terrain: '地形瓦片',
  objects: '场景物件',
  buildings: '建筑',
}

const categoryOrder: Category[] = ['all', 'terrain', 'objects', 'buildings']

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) throw new Error('Missing element: ' + selector)
  return element
}

const gallery = requireElement<HTMLDivElement>('#gallery')
const summary = requireElement<HTMLDivElement>('#summary')
const filters = requireElement<HTMLElement>('#category-filter')
const searchInput = requireElement<HTMLInputElement>('#search-input')
const clearSearch = requireElement<HTMLButtonElement>('#clear-search')
const resultCount = requireElement<HTMLDivElement>('#result-count')
const loadingState = requireElement<HTMLDivElement>('#loading-state')
const emptyState = requireElement<HTMLDivElement>('#empty-state')

let manifest: AssetManifest | null = null
let activeCategory: Category = 'all'
let query = ''

function categoryOf(item: AssetItem): Category {
  if (item.group.startsWith('Tiles/')) return 'terrain'
  if (item.group.startsWith('Objects/')) return 'objects'
  if (item.group.startsWith('Buildings/')) return 'buildings'
  return 'objects'
}

function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path.replace(/^\/+/, '')
}

function countFor(category: Category): number {
  if (!manifest) return 0
  if (category === 'all') return manifest.assets.length
  return manifest.assets.filter((item) => categoryOf(item) === category).length
}

function renderSummary(): void {
  if (!manifest) return
  const values: Array<[number, string]> = [
    [manifest.assets.length, '全部素材'],
    [manifest.counts.terrain, '地形瓦片'],
    [manifest.counts.objects, '场景物件'],
    [manifest.counts.buildings, '建筑'],
  ]
  summary.replaceChildren()
  values.forEach(([count, label]) => {
    const item = document.createElement('div')
    const value = document.createElement('b')
    const caption = document.createElement('span')
    value.textContent = String(count)
    caption.textContent = label
    item.append(value, caption)
    summary.append(item)
  })
}

function renderFilters(): void {
  filters.replaceChildren()
  categoryOrder.forEach((category) => {
    const button = document.createElement('button')
    const label = document.createElement('span')
    const count = document.createElement('b')
    button.type = 'button'
    button.className = category === activeCategory ? 'is-active' : ''
    button.dataset.category = category
    label.textContent = categoryLabels[category]
    count.textContent = String(countFor(category))
    button.append(label, count)
    button.addEventListener('click', () => {
      activeCategory = category
      renderFilters()
      renderGallery()
    })
    filters.append(button)
  })
}

function createAssetCard(item: AssetItem): HTMLAnchorElement {
  const link = document.createElement('a')
  const preview = document.createElement('figure')
  const image = document.createElement('img')
  const info = document.createElement('div')
  const title = document.createElement('strong')
  const path = document.createElement('small')
  const meta = document.createElement('div')
  const size = document.createElement('span')
  const priority = document.createElement('span')

  link.className = 'asset-card asset-card--' + categoryOf(item)
  link.href = assetUrl(item.path)
  link.target = '_blank'
  link.rel = 'noreferrer'
  link.title = '打开原始 SVG：' + item.path

  preview.className = 'asset-card__preview'
  image.src = assetUrl(item.path)
  image.alt = item.id
  image.loading = 'lazy'
  image.decoding = 'async'
  preview.append(image)

  info.className = 'asset-card__info'
  title.textContent = item.id
  path.textContent = item.path.replace('/Art/Map/', '')
  meta.className = 'asset-card__meta'
  size.textContent = item.size[0] + ' × ' + item.size[1]
  priority.textContent = item.priority
  meta.append(size, priority)
  info.append(title, path, meta)

  link.append(preview, info)
  return link
}

function renderGallery(): void {
  if (!manifest) return

  const normalizedQuery = query.trim().toLocaleLowerCase()
  const visibleAssets = manifest.assets.filter((item) => {
    const categoryMatches = activeCategory === 'all' || categoryOf(item) === activeCategory
    const searchMatches = normalizedQuery.length === 0 ||
      item.id.toLocaleLowerCase().includes(normalizedQuery) ||
      item.group.toLocaleLowerCase().includes(normalizedQuery) ||
      item.path.toLocaleLowerCase().includes(normalizedQuery)
    return categoryMatches && searchMatches
  })

  const grouped = new Map<string, AssetItem[]>()
  visibleAssets.forEach((item) => {
    const items = grouped.get(item.group) ?? []
    items.push(item)
    grouped.set(item.group, items)
  })

  gallery.replaceChildren()
  grouped.forEach((items, groupName) => {
    const section = document.createElement('section')
    const heading = document.createElement('header')
    const title = document.createElement('h2')
    const count = document.createElement('span')
    const grid = document.createElement('div')

    section.className = 'asset-group'
    title.textContent = groupName.replaceAll('/', ' / ')
    count.textContent = items.length + ' 个'
    grid.className = 'asset-grid'
    items.forEach((item) => grid.append(createAssetCard(item)))
    heading.append(title, count)
    section.append(heading, grid)
    gallery.append(section)
  })

  const total = manifest.assets.length
  resultCount.textContent = '当前显示 ' + visibleAssets.length + ' / ' + total + ' 个素材 · ' + grouped.size + ' 组'
  emptyState.hidden = visibleAssets.length !== 0
}

function showLoadError(error: unknown): void {
  loadingState.classList.add('is-error')
  loadingState.replaceChildren()
  const title = document.createElement('strong')
  const detail = document.createElement('span')
  title.textContent = '素材清单加载失败'
  detail.textContent = error instanceof Error ? error.message : '请刷新页面重试。'
  loadingState.append(title, detail)
  resultCount.textContent = '无法读取素材'
}

searchInput.addEventListener('input', () => {
  query = searchInput.value
  clearSearch.hidden = query.length === 0
  renderGallery()
})

clearSearch.addEventListener('click', () => {
  searchInput.value = ''
  query = ''
  clearSearch.hidden = true
  searchInput.focus()
  renderGallery()
})

async function start(): Promise<void> {
  try {
    const response = await fetch(import.meta.env.BASE_URL + 'Art/Map/asset_manifest.json')
    if (!response.ok) throw new Error('HTTP ' + response.status)
    manifest = await response.json() as AssetManifest
    renderSummary()
    renderFilters()
    renderGallery()
    loadingState.remove()
  } catch (error) {
    showLoadError(error)
  }
}

void start()
