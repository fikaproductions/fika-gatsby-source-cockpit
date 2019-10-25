import Entry from '../entry'

interface EntityArgs {
  entries: Entry[]
  name: string
  type: string
}

abstract class Entity {
  public name: string
  public type: string

  private entries: Entry[]

  constructor({ entries, name, type }: EntityArgs) {
    this.entries = entries
    this.name = name
    this.type = type
  }
}

export default Entity
