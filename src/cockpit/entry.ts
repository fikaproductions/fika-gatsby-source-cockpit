import { DEFAULT_LANGUAGE_LOCALE } from '../constants'
import ObjectUtils from '../utils/object-utils'
import FieldFactory from './fields/factory'
import Field from './fields/field'

interface EntryArgs {
  entryData: import('./client').EntryPayload
  fieldsData: Array<import('./client').FieldPayload>
  lang?: string
  level?: number
}

class Entry {
  private children?: Entry[]
  private cockpitBy: string
  private cockpitCreated: Date
  private cockpitId: string
  private cockpitModified: Date
  private cockpitModifiedBy: string
  private cockpitLang: string
  private cockpitLevel: number
  private fields: { [names: string]: Field }

  constructor({ entryData, fieldsData, lang = DEFAULT_LANGUAGE_LOCALE, level = 1 }: EntryArgs) {
    this.cockpitBy = entryData._by
    this.cockpitCreated = new Date(entryData._created * 1000)
    this.cockpitId = entryData._id
    this.cockpitModified = new Date(entryData._modified * 1000)
    this.cockpitModifiedBy = entryData._mby
    this.cockpitLang = lang
    this.cockpitLevel = level
    this.fields = {}

    fieldsData.forEach((fieldData: import('./client').FieldPayload) => {
      const field = FieldFactory.create({
        fieldData,
        value: entryData[fieldData.name],
        ...ObjectUtils.getRelatedEntriesSubset(entryData, fieldData.name),
      })

      if (field) {
        this.fields[fieldData.name] = field
      }
    })

    if (entryData.children) {
      this.children = entryData.children.map(
        (childEntryData: import('./client').EntryPayload) =>
          new Entry({
            entryData: childEntryData,
            fieldsData,
            lang,
            level: level + 1,
          })
      )
    }
  }
}

export default Entry
