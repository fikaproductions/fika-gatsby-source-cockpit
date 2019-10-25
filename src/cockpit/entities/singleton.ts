import Entry from '../entry'
import Entity from './entity'

interface SingletonArgs {
  data: { [lang: string]: import('../client').SingletonPayload }
  metadata: import('../client').SingletonDescriptorPayload
  name: string
}

class Singleton extends Entity {
  constructor({ data, metadata, name }: SingletonArgs) {
    const entries: Entry[] = []

    Object.entries(data).forEach(([lang, singletonData]: [string, import('../client').SingletonPayload]) => {
      entries.push(
        new Entry({
          entryData: {
            _created: metadata._created,
            _id: metadata._id,
            _modified: metadata._modified,
            ...singletonData,
          },
          fieldsData: metadata.fields,
          lang,
        })
      )
    })

    super({ entries, name, type: 'singleton' })
  }
}

export default Singleton
