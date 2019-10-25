import ArrayUtils from '../utils/array-utils'
import CockpitClient from './client'
import Collection from './entities/collection'
import Entity from './entities/entity'
import Singleton from './entities/singleton'

interface CockpitServiceArgs {
  client: CockpitClient
  whitelistedCollections?: string[]
  whitelistedSingletons?: string[]
}

class CockpitService {
  private client: CockpitClient
  private whitelistedCollections: string[]
  private whitelistedSingletons: string[]

  constructor({ client, whitelistedCollections = [], whitelistedSingletons = [] }: CockpitServiceArgs) {
    this.client = client
    this.whitelistedCollections = whitelistedCollections
    this.whitelistedSingletons = whitelistedSingletons
  }

  public async getEntities(): Promise<Entity[]> {
    const entities = (await Promise.all([this.getCollections(), this.getSingletons()])).flat()
    this.validateEntitiesNames(entities)

    return entities
  }

  private async getCollections(): Promise<Collection[]> {
    const names = await this.client.getCollectionNames()

    return Promise.all(names.filter(this.isWhitelistedCollection).map(this.client.getCollection))
  }

  private async getSingletons(): Promise<Singleton[]> {
    const names = await this.client.getSingletonNames()

    return Promise.all(names.filter(this.isWhitelistedSingleton).map(this.client.getSingleton))
  }

  private isWhitelistedCollection(name: string): boolean {
    return ArrayUtils.isEmptyArray(this.whitelistedCollections) || this.whitelistedCollections.includes(name)
  }

  private isWhitelistedSingleton(name: string): boolean {
    return ArrayUtils.isEmptyArray(this.whitelistedSingletons) || this.whitelistedSingletons.includes(name)
  }

  private validateEntitiesNames(entities: Entity[]) {
    const collisions = Object.values(
      entities.reduce((map: { [name: string]: Entity[] }, entity: Entity) => {
        const name = `${entity.name[0].toUpperCase()}${entity.name.substring(1)}`

        if (map[name]) {
          map[name].push(entity)
        } else {
          map[name] = [entity]
        }

        return map
      }, {})
    )
      .filter((collidingEntities: Entity[]) => collidingEntities.length > 1)
      .map((collidingEntities: Entity[]) =>
        collidingEntities.reduce(
          (information: string, collidingEntity: Entity) =>
            `${information}${information && ' & '}${collidingEntity.name} (${collidingEntity.type})`,
          ''
        )
      )

    if (collisions.length > 0) {
      throw new Error(
        `
        Some collections or singletons names are colliding,
          you must provide aliases for some of them in the plugin's configuration.

        An example for a collection and a singleton both named "team" would be:
          options: {
            …
            aliases: {
              singleton: {
                team: 'Team', // 'team' would be valid too
              },
              collection: {
                team: 'Teams', // 'teams' would be valid too
              }
            }
          }
 
        The colliding names are:
          ${collisions.reduce((information: string, collision: string) => `${information}- ${collision}` + '\n', '')}
        `
      )
    }
  }
}

export default CockpitService
