import Phaser from 'phaser'

export const events = new Phaser.Events.EventEmitter()

export interface ResourceState {
  wood: number
  stone: number
  food: number
  population: number
}

export const resources: ResourceState = {
  wood: 520,
  stone: 260,
  food: 140,
  population: 0,
}
