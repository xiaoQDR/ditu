import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const ROOT = 'public/Art/Map'
const TILE = [256, 148]
const registry = []

const palettes = {
  grass: ['#426f43', '#5e8e52', '#76a866', '#91bd78', '#b4d38d'],
  dirt: ['#6d5036', '#876745', '#a68155', '#c09a68', '#d5b783'],
  stone: ['#4f5d59', '#68756e', '#7f8a7d', '#9da393', '#bec0aa'],
  water: ['#285f68', '#397d83', '#55a0a0', '#83beb2', '#b0d9c6'],
  wood: ['#4f3527', '#6e4930', '#8d623e', '#b08252', '#d2a96b'],
  leaf: ['#244d37', '#326443', '#477b4e', '#61975c', '#88b46c'],
  cliff: ['#4d4231', '#67563b', '#806b48', '#9b8158', '#b69c70'],
}

function hash(value) {
  let h = 2166136261
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619)
  return Math.abs(h >>> 0)
}

function svg(width, height, body, metadata = '') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" shape-rendering="geometricPrecision">${metadata ? `<metadata>${metadata}</metadata>` : ''}${body}</svg>\n`
}

async function save(group, fileName, body, priority = 'P0', width = 256, height = 148, metadata = '') {
  const path = join(ROOT, group, fileName)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, svg(width, height, body, metadata))
  registry.push({ id: fileName.replace(/\.svg$/, ''), group, priority, path: path.replace('public/', '/'), format: 'svg', size: [width, height], status: 'complete' })
}

function diamond(fill, detail = '') {
  return `<path fill="${fill}" d="M128 0 256 74 128 148 0 74Z"/>${detail}`
}

function groundSvg(material, index) {
  const p = palettes[material]
  const n = index * 17
  const details = index <= 4 ? '' : material === 'grass'
    ? `<path fill="${p[1]}" d="m${72 + n % 43} ${45 + n % 28} 5-18 3 20 9-15-5 23Z"/><path fill="${p[3]}" d="m${160 - n % 29} ${83 - n % 19} 4-14 4 15 7-11-3 17Z"/>`
    : material === 'dirt'
      ? `<ellipse cx="${76 + n % 87}" cy="${49 + n % 38}" rx="18" ry="7" fill="${p[1]}"/><ellipse cx="${158 - n % 31}" cy="${91 - n % 22}" rx="9" ry="4" fill="${p[3]}"/>`
      : `<path fill="${p[1]}" d="m${72 + n % 45} ${57 + n % 22} 18-8 17 9-9 11-21 1Z"/><path fill="${p[3]}" d="m${157 - n % 26} ${71 + n % 18} 12-5 10 6-6 8-14-1Z"/>`
  return diamond(p[2], details)
}

function edgeBand(side, color) {
  const paths = {
    n: 'M128 0 256 74 248 79 128 10Z',
    e: 'M256 74 128 148 128 137 248 68Z',
    s: 'M128 148 0 74 8 68 128 137Z',
    w: 'M0 74 128 0 128 10 8 79Z',
  }
  return `<path fill="${color}" d="${paths[side]}"/>`
}

function autotileSvg(mask, index) {
  const p = palettes.grass
  const bits = { n: 1, e: 2, s: 4, w: 8, ne: 16, se: 32, sw: 64, nw: 128 }
  let body = diamond(p[2])
  for (const side of ['n', 'e', 's', 'w']) if (!(mask & bits[side])) body += edgeBand(side, p[0])
  const corners = {
    ne: 'M128 0 148 12 128 24 108 12Z',
    se: 'M256 74 235 62 215 74 235 86Z',
    sw: 'M128 148 108 136 128 124 148 136Z',
    nw: 'M0 74 21 62 41 74 21 86Z',
  }
  for (const corner of ['ne', 'se', 'sw', 'nw']) if (!(mask & bits[corner])) body += `<path fill="${p[1]}" d="${corners[corner]}"/>`
  body += `<path fill="${p[3]}" d="m${74 + index % 41} ${54 + index % 23} 4-13 3 14 7-10-3 17Z"/>`
  return body
}

function cliffSvg(id) {
  const p = palettes.cliff
  const n = hash(id)
  return `<path fill="${p[0]}" d="M0 74 128 148 256 74v38l-128 74L0 112Z"/><path fill="${p[2]}" d="M0 74 128 148v38L0 112Z"/><path fill="${p[1]}" d="M256 74 128 148v38l128-74Z"/><path fill="${palettes.grass[2]}" d="M128 0 256 74 128 148 0 74Z"/><path fill="${palettes.grass[3]}" d="M128 0 256 74 246 78 128 11 10 78 0 74Z"/><path fill="${p[3]}" d="m${45 + n % 62} ${119 + n % 24} 28 16-8 27-25-15Z"/><path fill="${p[0]}" d="m${167 + n % 31} ${131 + n % 18} 25-12 17 12-22 19Z"/>`
}

function rampSvg(id) {
  const n = hash(id)
  return diamond(palettes.grass[2], `<path fill="${palettes.dirt[2]}" d="M128 18 218 70 128 130 38 78Z"/><path fill="${palettes.dirt[3]}" d="M128 31 199 72 128 117 57 76Z"/><path fill="${palettes.cliff[1]}" d="m${74 + n % 18} 78 54 31 54-31-7 18-47 28-47-28Z"/>`)
}

function pathTileSvg(id, kind) {
  const n = hash(id)
  const isCurve = id.includes('curve')
  const isJunction = id.includes('_t_') || id.includes('junction')
  const isCap = id.includes('source') || id.includes('cap') || id.includes('interface')
  const rotate = n % 4
  const center = kind === 'water' ? palettes.water[2] : palettes.dirt[2]
  const dark = kind === 'water' ? palettes.water[0] : palettes.dirt[0]
  const light = kind === 'water' ? palettes.water[4] : palettes.dirt[4]
  const transforms = [`rotate(0 128 74)`, `rotate(180 128 74)`, `matrix(-1 0 0 1 256 0)`, `matrix(1 0 0 -1 0 148)`]
  let shape = isCurve
    ? `<path fill="${dark}" d="M16 60 128 125 240 60l16 14-128 74L0 74Z"/><path fill="${center}" d="M35 61 128 114 221 61l18 11-111 64L17 72Z"/>`
    : `<path fill="${dark}" d="M83 0h54l119 69v10L137 148H83L202 74Z"/><path fill="${center}" d="M99 0h31l111 68v12L130 148H99L218 74Z"/>`
  if (isJunction) shape += `<path fill="${dark}" d="M0 67 120 0h36L34 74l94 55-17 10L0 77Z"/><path fill="${center}" d="M0 71 121 3h21L21 74l100 59-10 6L0 77Z"/>`
  if (isCap) shape += `<ellipse cx="128" cy="74" rx="45" ry="27" fill="${center}"/><ellipse cx="128" cy="70" rx="22" ry="11" fill="${light}" opacity=".45"/>`
  if (kind === 'water') shape += `<path fill="${light}" d="m86 56 36 20-8 5-36-20Zm55 34 29 16-8 5-29-16Z" opacity=".55"/>`
  else shape += `<ellipse cx="${90 + n % 56}" cy="${62 + n % 29}" rx="8" ry="4" fill="${light}" opacity=".5"/>`
  return `<g transform="${transforms[rotate]}">${shape}</g>`
}

function lakeSvg(id) {
  const n = hash(id)
  const p = palettes.water
  const rotate = [`rotate(0 128 74)`, `rotate(90 128 74)`, `rotate(180 128 74)`, `rotate(270 128 74)`][n % 4]
  const inner = id.includes('inner')
  const special = id.includes('special')
  return `<g transform="${rotate}"><path fill="${p[0]}" d="M0 74 128 0l128 74-128 74Z"/><path fill="${p[2]}" d="M0 74 128 0v18L31 74l97 56v18Z"/>${inner ? `<path fill="${palettes.grass[2]}" d="M128 18 225 74 128 130 85 105l43-25Z"/>` : `<path fill="${palettes.grass[2]}" d="M128 0 256 74 225 92 128 36 31 92 0 74Z"/>`}${special ? `<path fill="${palettes.dirt[3]}" d="M92 67 128 47l36 20-12 7-24-13-24 13Z"/>` : ''}<path fill="${p[4]}" d="m34 73 39-22 7 4-39 22Z" opacity=".55"/></g>`
}

function waterfallSvg(id) {
  const n = hash(id)
  const flip = n % 2 ? 'matrix(-1 0 0 1 256 0)' : 'translate(0 0)'
  return `<g transform="${flip}"><path fill="${palettes.cliff[1]}" d="M0 74 128 148l128-74v54l-128 74L0 128Z"/><path fill="${palettes.water[1]}" d="M84 49 128 74l44-25v82l-44 26-44-26Z"/><path fill="${palettes.water[3]}" d="m99 58 15 9v74l-15-9Zm32 17 17-10v75l-17 10Z"/><ellipse cx="128" cy="161" rx="55" ry="20" fill="${palettes.water[2]}"/><ellipse cx="128" cy="157" rx="31" ry="10" fill="${palettes.water[4]}" opacity=".55"/></g>`
}

function decalSvg(id) {
  const n = hash(id)
  if (id.includes('flower')) return `<path fill="${palettes.leaf[2]}" d="m126 126 3-48 5 48Z"/><circle cx="130" cy="77" r="9" fill="#e5b9a8"/><circle cx="121" cy="84" r="9" fill="#d99a9e"/><circle cx="139" cy="84" r="9" fill="#d99a9e"/><circle cx="130" cy="84" r="5" fill="#e9c768"/>`
  if (id.includes('pebble')) return `<ellipse cx="${107 + n % 32}" cy="101" rx="18" ry="9" fill="${palettes.stone[2]}"/><ellipse cx="${147 - n % 21}" cy="94" rx="11" ry="6" fill="${palettes.stone[3]}"/>`
  if (id.includes('branch')) return `<path fill="${palettes.wood[2]}" d="m74 103 93-43 5 10-93 43Z"/><path fill="${palettes.wood[3]}" d="m133 75 18-24 6 5-13 24Z"/>`
  if (id.includes('leaf')) return `<path fill="${palettes.leaf[2]}" d="M85 106c23-32 54-36 78-26-14 30-44 44-78 26Z"/><path fill="${palettes.leaf[4]}" d="m96 102 51-18-45 25Z"/>`
  return `<path fill="${palettes.leaf[2]}" d="m88 126 9-52 7 49 14-69 5 68 18-48-9 54Z"/><path fill="${palettes.leaf[4]}" d="m107 119 11-65 5 68Z"/>`
}

function objectShadow() { return `<ellipse cx="128" cy="266" rx="57" ry="18" fill="#183a31" opacity=".28"/>` }

function treeSvg(id) {
  const n = hash(id)
  const dead = id.includes('dead')
  const pine = id.includes('pine')
  const giant = id.includes('giant')
  if (dead) return `${objectShadow()}<path fill="${palettes.wood[2]}" d="M116 260 111 91l-34-36 10-8 30 25 5-49 15 2-5 72 43-31 9 12-50 42 4 140Z"/><path fill="${palettes.wood[3]}" d="m117 92 9-66 7 2-7 71Z"/>`
  if (pine) return `${objectShadow()}<path fill="${palettes.wood[2]}" d="M120 260h17l-3-88h-11Z"/><path fill="${palettes.leaf[0]}" d="m128 30 70 142H58Z"/><path fill="${palettes.leaf[2]}" d="m128 48 52 98H76Z"/><path fill="${palettes.leaf[3]}" d="m128 65 31 58H97Z"/>`
  const scale = giant ? 1.13 : 1
  return `${objectShadow()}<g transform="translate(${128 - 128 * scale} ${270 - 270 * scale}) scale(${scale})"><path fill="${palettes.wood[2]}" d="m116 260 5-102h15l6 102Z"/><path fill="${palettes.wood[3]}" d="m125 254 4-94h7l6 94Z"/><path fill="${palettes.leaf[0]}" d="M54 142c0-31 25-54 55-55 7-33 50-46 72-20 35 3 50 44 28 68 10 34-26 60-55 45-24 25-68 12-69-22-17 1-31-4-31-16Z"/><circle cx="${92 + n % 24}" cy="112" r="42" fill="${palettes.leaf[2]}"/><circle cx="157" cy="96" r="45" fill="${palettes.leaf[3]}"/><circle cx="139" cy="67" r="31" fill="${palettes.leaf[4]}"/></g>`
}

function bushSvg(id) {
  const fern = id.includes('fern')
  const vine = id.includes('vine')
  if (vine) return `${objectShadow()}<path fill="${palettes.leaf[1]}" d="M71 246c41-84 83-91 116-159l9 5c-32 75-84 89-110 158Z"/><path fill="${palettes.leaf[3]}" d="M114 188c-27-2-41-15-50-35 28-2 45 11 50 35Zm37-46c-3-25 9-42 30-54 4 27-7 44-30 54Z"/>`
  if (fern) return `${objectShadow()}<path fill="${palettes.leaf[3]}" d="M127 258c-12-78-37-116-72-150 43 17 65 62 72 150Zm5 0c10-81 37-123 77-148-36 39-56 83-77 148Z"/><path fill="${palettes.leaf[1]}" d="M128 248c-45-48-71-58-99-57 38 15 63 36 99 57Zm5 0c41-45 69-60 97-58-37 13-65 38-97 58Z"/>`
  return `${objectShadow()}<circle cx="83" cy="219" r="39" fill="${palettes.leaf[1]}"/><circle cx="129" cy="204" r="52" fill="${palettes.leaf[2]}"/><circle cx="178" cy="221" r="37" fill="${palettes.leaf[1]}"/><circle cx="137" cy="183" r="28" fill="${palettes.leaf[4]}"/>`
}

function rockSvg(id) {
  const moss = id.includes('moss')
  const pile = id.includes('pile')
  return `${objectShadow()}<path fill="${palettes.stone[1]}" d="m${pile ? 48 : 67} 248 23-70 58-24 61 39 19 55Z"/><path fill="${palettes.stone[3]}" d="m71 178 58-24 25 16-43 31-52 8Z"/>${pile ? `<path fill="${palettes.stone[2]}" d="m126 243 18-49 39-16 31 30-8 40Z"/>` : ''}${moss ? `<path fill="${palettes.leaf[2]}" d="m83 174 46-20 25 16-22 16-31-2Z"/>` : ''}`
}

function woodSvg(id) {
  if (id.includes('stump')) return `${objectShadow()}<path fill="${palettes.wood[1]}" d="m90 187 76 0 14 68-99 0Z"/><ellipse cx="128" cy="187" rx="38" ry="18" fill="${palettes.wood[4]}"/><ellipse cx="128" cy="187" rx="22" ry="10" fill="${palettes.wood[2]}"/>`
  if (id.includes('log')) return `${objectShadow()}<path fill="${palettes.wood[1]}" d="m55 220 123-51 27 49-122 49Z"/><ellipse cx="191" cy="194" rx="21" ry="27" transform="rotate(-31 191 194)" fill="${palettes.wood[4]}"/><ellipse cx="191" cy="194" rx="11" ry="16" transform="rotate(-31 191 194)" fill="${palettes.wood[2]}"/>`
  return `${objectShadow()}<path fill="${palettes.wood[2]}" d="m66 246 105-65 9 13-105 65Zm14-48 114 40-5 15-115-40Z"/>`
}

function propSvg(id) {
  if (id.includes('totem')) return `${objectShadow()}<path fill="${palettes.wood[1]}" d="M96 259 105 74h46l10 185Z"/><path fill="${palettes.wood[4]}" d="m105 87 23-22 23 22-23 19Z"/><circle cx="116" cy="126" r="7" fill="#e2c36f"/><circle cx="140" cy="126" r="7" fill="#e2c36f"/><path fill="${palettes.wood[0]}" d="m111 154 17 13 17-13-4 28h-27Z"/>`
  if (id.includes('sign')) return `${objectShadow()}<path fill="${palettes.wood[1]}" d="m121 260 8-99 13 1-5 98Z"/><path fill="${palettes.wood[3]}" d="m61 155 32-30h104l-22 61H76Z"/><path fill="${palettes.wood[4]}" d="m78 151 91-9-10 10-79 9Z"/>`
  if (id.includes('bones')) return `${objectShadow()}<path fill="#d8cfad" d="m76 231 9-9 88 35-7 12Zm96-4 10 8-89 34-8-11Z"/><circle cx="77" cy="224" r="9" fill="#e7ddbd"/><circle cx="180" cy="233" r="9" fill="#e7ddbd"/>`
  return `${objectShadow()}<path fill="${palettes.stone[1]}" d="M72 260 84 101h39l6 63 20-96h37l13 192Z"/><path fill="${palettes.stone[3]}" d="M84 101h39l-4 29H82Zm65-33h37l-5 28h-38Z"/><path fill="${palettes.leaf[2]}" d="M83 145c32-12 57 3 69 34-35 3-60-8-69-34Z"/>`
}

function animalSvg(id) {
  const species = id.split('_')[1]
  const moving = id.includes('walk') || id.includes('fly')
  const colors = { deer: '#b68152', boar: '#665443', rabbit: '#b9b39f', bird: '#5f7990' }
  const c = colors[species]
  if (species === 'bird') return `${objectShadow()}<ellipse cx="128" cy="${moving ? 164 : 222}" rx="32" ry="22" fill="${c}"/><path fill="#8199a4" d="m106 ${moving ? 160 : 218}-54-31 60 9Zm44 0 54-31-60 9Z"/><circle cx="151" cy="${moving ? 157 : 215}" r="13" fill="${c}"/><path fill="#d4ae61" d="m162 ${moving ? 156 : 214} 20 7-20 7Z"/>`
  if (species === 'rabbit') return `${objectShadow()}<ellipse cx="121" cy="230" rx="45" ry="31" fill="${c}"/><circle cx="166" cy="210" r="26" fill="${c}"/><path fill="${c}" d="m151 191-1-70 18 64 10-67 4 76Z"/><circle cx="174" cy="205" r="4" fill="#292b28"/><circle cx="75" cy="218" r="14" fill="#e1d9c4"/>`
  const antler = species === 'deer' ? `<path fill="${palettes.wood[2]}" d="m171 178 6-51 7 1-2 20 17-15 5 6-23 22-3 20Zm-17-1-3-47-7 1 2 19-16-13-5 6 22 20 1 18Z"/>` : ''
  return `${objectShadow()}<ellipse cx="119" cy="222" rx="62" ry="38" fill="${c}"/><path fill="${c}" d="m151 202 16-50 32 14 5 49-30 14Z"/><path fill="${c}" d="m177 162-13-25 22 18 16-15-5 30Z"/>${antler}<path fill="#3d332b" d="m88 247 12 0-2 27H84Zm46 0 12-1 5 27h-14Z"/><circle cx="190" cy="181" r="4" fill="#1d2724"/>`
}

function resourceSvg(id) {
  if (id.includes('wood')) return woodSvg('obj_wood_log_01')
  if (id.includes('stone') || id.includes('ore')) return `${rockSvg(id)}${id.includes('ore') ? `<path fill="#c5a35a" d="m108 194 21-13 13 10-17 18Z"/>` : ''}`
  if (id.includes('herb')) return bushSvg('obj_bush_fern_01')
  if (id.includes('game')) return animalSvg('animal_deer_idle_se')
  return `${objectShadow()}<path fill="${palettes.dirt[2]}" d="m78 255 20-60 59-18 31 57-28 26Z"/><path fill="${palettes.dirt[4]}" d="m98 195 59-18 18 31-61 17Z"/>`
}

const buildingColors = {
  trap: ['#8a603f', '#c49758'], handcart: ['#6f4931', '#d3a154'], hut: ['#775137', '#b97c48'], hunter_hut: ['#5c5937', '#829653'],
  trading_post: ['#76513a', '#d2b45f'], tannery: ['#76503b', '#a86f52'], smokehouse: ['#6f4834', '#a95a43'], workshop: ['#51614f', '#6f9278'],
  steelworks: ['#4d5554', '#788786'], armory: ['#4c5147', '#7e846d'],
}

function buildingSvg(id) {
  const key = id.replace(/^bld_/, '').replace(/_lv01$/, '')
  const [dark, accent] = buildingColors[key]
  const shadow = `<ellipse cx="256" cy="370" rx="112" ry="35" fill="#173a31" opacity=".3"/>`
  if (key === 'trap') return `${shadow}<path fill="${dark}" d="m159 348 97-58 97 58-97 57Z"/><path fill="${accent}" d="m182 345 74-43 73 43-73 43Z"/><path fill="#563b2b" d="m201 329 55 60 55-60-11-7-44 49-44-49Z"/><path fill="#d9c598" d="m256 340-19-18 19-18 19 18Z"/>`
  if (key === 'handcart') return `${shadow}<path fill="${dark}" d="m170 318 140-13 30 59-144 12Z"/><path fill="${accent}" d="m183 312 119-11 21 43-122 10Z"/><circle cx="207" cy="373" r="27" fill="#4b372a"/><circle cx="312" cy="364" r="27" fill="#4b372a"/><path fill="${palettes.wood[3]}" d="m325 315 76-34 8 13-75 35Z"/>`
  const industrial = ['workshop', 'steelworks', 'armory'].includes(key)
  const tall = ['smokehouse', 'steelworks'].includes(key)
  const market = key === 'trading_post'
  const tannery = key === 'tannery'
  return `${shadow}<path fill="${dark}" d="m166 345 90-53 91 53-91 53Z"/><path fill="${industrial ? '#69716a' : '#9c7249'}" d="M184 235 256 275v91l-72-41Z"/><path fill="${industrial ? '#56615c' : '#815c3d'}" d="m256 275 72-40v90l-72 41Z"/><path fill="${accent}" d="m160 237 96-81 97 81-25 25-72-61-72 61Z"/><path fill="${dark}" d="m256 156 97 81-10 10-87-72-86 72-10-10Z"/><path fill="#45382d" d="m231 317 25 14v48l-25-14Z"/><path fill="#e4c875" d="m278 295 28-16v30l-28 16Z"/>${tall ? `<path fill="#55564f" d="m290 189 25-14 2 72-25 13Z"/><path fill="#d6cfb5" d="m302 157 21-12 16 19-26 15Z" opacity=".7"/>` : ''}${market ? `<path fill="#e3cf91" d="m190 245 66 37 66-37v23l-66 38-66-38Z"/>` : ''}${tannery ? `<path fill="#d7b480" d="M202 262c24-19 43-14 54 8 15-23 38-27 57-8-14 14-24 36-28 65h-58c-4-28-12-50-25-65Z"/>` : ''}${industrial ? `<path fill="#3f4a46" d="m198 281 23 13v42l-23-13Zm95 8 22-13v42l-22 13Z"/>` : ''}`
}

const variants = (prefix, items) => items.map((suffix) => `${prefix}_${suffix}`)

for (let i = 1; i <= 8; i++) await save('Tiles/Ground/Grass', `tile_ground_grass_${String(i).padStart(2, '0')}.svg`, groundSvg('grass', i), 'P0')
for (let i = 1; i <= 4; i++) await save('Tiles/Ground/Dirt', `tile_ground_dirt_${String(i).padStart(2, '0')}.svg`, groundSvg('dirt', i), 'P1')
for (let i = 1; i <= 4; i++) await save('Tiles/Ground/Stone', `tile_ground_stone_${String(i).padStart(2, '0')}.svg`, groundSvg('stone', i), 'P1')

const masks = []
for (let mask = 0; mask < 256; mask++) {
  if ((mask & 16) && (!(mask & 1) || !(mask & 2))) continue
  if ((mask & 32) && (!(mask & 2) || !(mask & 4))) continue
  if ((mask & 64) && (!(mask & 4) || !(mask & 8))) continue
  if ((mask & 128) && (!(mask & 8) || !(mask & 1))) continue
  masks.push(mask)
}
if (masks.length !== 47) throw new Error(`Expected 47 valid blob masks, got ${masks.length}`)
for (let i = 0; i < masks.length; i++) await save('Tiles/Autotile/GrassEdge', `tile_autotile_grass_edge_${String(i + 1).padStart(3, '0')}.svg`, autotileSvg(masks[i], i + 1), 'P0', 256, 148, `neighbor-mask:${masks[i]}`)

const dirs = ['ne', 'se', 'sw', 'nw']
const cliffIds = [
  ...variants('front', ['ne_01','ne_02','nw_01','nw_02']), ...variants('back', ['se_01','se_02','sw_01','sw_02']),
  ...variants('outer', dirs), ...variants('inner', dirs), ...variants('cap', dirs), ...variants('join', dirs),
]
for (const id of cliffIds) await save('Tiles/Height/Cliff', `tile_cliff_${id}.svg`, cliffSvg(id), 'P0', 256, 220)
for (const dir of dirs) for (let i = 1; i <= 2; i++) await save('Tiles/Height/Ramp', `tile_ramp_${dir}_${String(i).padStart(2, '0')}.svg`, rampSvg(`${dir}_${i}`))

const riverIds = [...variants('straight', ['ne_sw_01','ne_sw_02','nw_se_01','nw_se_02']), ...variants('curve', dirs), ...variants('source', dirs), ...variants('t', dirs), ...variants('interface', dirs)]
for (const id of riverIds) await save('Tiles/Water/River', `tile_river_${id}.svg`, pathTileSvg(id, 'water'))
const lakeIds = [...variants('edge', dirs), ...variants('outer', dirs), ...variants('inner', dirs), ...variants('special', dirs)]
for (const id of lakeIds) await save('Tiles/Water/Lake', `tile_lake_${id}.svg`, lakeSvg(id))
for (const id of ['front_ne_01','front_ne_02','front_nw_01','front_nw_02','side_ne_01','side_nw_01']) await save('Tiles/Water/Waterfall', `tile_waterfall_${id}.svg`, waterfallSvg(id), 'P1', 256, 220)

const roadIds = [...variants('straight', ['ne_sw_01','ne_sw_02','nw_se_01','nw_se_02']), ...variants('curve', dirs), ...variants('cap', dirs), ...variants('junction', dirs)]
for (const id of roadIds) await save('Tiles/Path/DirtRoad', `tile_road_dirt_${id}.svg`, pathTileSvg(id, 'road'))

const decalIds = [...variants('grass_tuft', ['01','02','03','04','05','06']), ...variants('flower', ['01','02','03','04']), ...variants('pebble', ['01','02','03','04']), ...variants('branch', ['01','02','03']), ...variants('leaf', ['01','02','03'])]
for (const id of decalIds) await save('Tiles/Decal/GroundDetail', `decal_ground_${id}.svg`, decalSvg(id), 'P1')

const treeIds = [...variants('broadleaf', ['01','02','03','04']), ...variants('pine', ['01','02','03']), ...variants('dead', ['01','02']), ...variants('giant', ['01','02','03'])]
for (const id of treeIds) await save('Objects/Tree', `obj_tree_${id}.svg`, treeSvg(id), 'P0', 256, 296)
const bushIds = [...variants('shrub', ['01','02','03']), ...variants('fern', ['01','02','03']), ...variants('vine', ['01','02'])]
for (const id of bushIds) await save('Objects/Bush', `obj_bush_${id}.svg`, bushSvg(id), 'P0', 256, 296)
const rockIds = [...variants('single', ['01','02','03']), ...variants('pile', ['01','02','03']), ...variants('moss', ['01','02'])]
for (const id of rockIds) await save('Objects/Rock', `obj_rock_${id}.svg`, rockSvg(id), 'P0', 256, 296)
const woodIds = [...variants('stump', ['01','02']), ...variants('log', ['01','02']), ...variants('branch_pile', ['01','02'])]
for (const id of woodIds) await save('Objects/Wood', `obj_wood_${id}.svg`, woodSvg(id), 'P1', 256, 296)
const propIds = [...variants('ruin', ['01','02','03']), ...variants('totem', ['01','02']), ...variants('sign', ['01','02']), 'bones_01']
for (const id of propIds) await save('Objects/JungleProp', `obj_jungle_prop_${id}.svg`, propSvg(id), 'P1', 256, 296)
const animalIds = ['deer_idle_se','deer_walk_se','boar_idle_se','boar_walk_se','rabbit_idle_se','rabbit_walk_se','bird_idle_se','bird_fly_se']
for (const id of animalIds) await save('Objects/Animal', `animal_${id}.svg`, animalSvg(`animal_${id}`), 'P0', 256, 296)
for (const id of ['wood_normal','stone_normal','herb_normal','game_normal','clay_normal','ore_normal']) await save('Objects/ResourceNode', `obj_resource_${id}.svg`, resourceSvg(id), 'P0', 256, 296)

const buildingFolders = { trap: 'Trap', handcart: 'Handcart', hut: 'Hut', hunter_hut: 'HunterHut', trading_post: 'TradingPost', tannery: 'Tannery', smokehouse: 'Smokehouse', workshop: 'Workshop', steelworks: 'Steelworks', armory: 'Armory' }
for (const [id, folder] of Object.entries(buildingFolders)) {
  await save(`Buildings/${folder}/Source`, `bld_${id}_lv01.svg`, buildingSvg(`bld_${id}_lv01`), 'P0', 512, 430)
  for (const subfolder of ['Export', 'Preview']) {
    const directory = join(ROOT, 'Buildings', folder, subfolder)
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, '.gitkeep'), '')
  }
}

if (registry.length !== 239) throw new Error(`Expected 239 SVG assets, got ${registry.length}`)
await writeFile(join(ROOT, 'asset_manifest.json'), `${JSON.stringify({ version: '1.1', view: 'Orthographic 2.5D Isometric', groundAxis: 30, tileSize: TILE, total: registry.length, counts: { terrain: 173, objects: 56, buildings: 10 }, assets: registry }, null, 2)}\n`)
const csv = ['slot,neighbor_mask,tile_id,file']
for (let i = 0; i < masks.length; i++) csv.push(`${String(i + 1).padStart(3, '0')},${masks[i]},${i},tile_autotile_grass_edge_${String(i + 1).padStart(3, '0')}.svg`)
await writeFile(join(ROOT, 'autotile_grass_edge_mask.csv'), `${csv.join('\n')}\n`)
console.log(`Generated ${registry.length} static SVG assets with ${masks.length} valid autotile masks.`)
