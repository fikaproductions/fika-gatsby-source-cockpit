import Entry from '../entry'
import Entity from './entity'

interface CollectionArgs {
  data: { [lang: string]: import('../client').CollectionPayload }
  name: string
}

class Collection extends Entity {
  constructor({ data, name }: CollectionArgs) {
    const entries: Entry[] = []

    Object.entries(data).forEach(([lang, collectionData]: [string, import('../client').CollectionPayload]) => {
      collectionData.entries.forEach((entryData: import('../client').EntryPayload) => {
        entries.push(new Entry({ entryData, fieldsData: Object.values(collectionData.fields), lang }))
      })
    })

    super({ entries, name, type: 'collection' })
  }
}

export default Collection
