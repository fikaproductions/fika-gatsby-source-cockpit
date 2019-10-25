import ObjectUtils from '../../utils/object-utils'
import FieldFactory from './factory'
import Field from './field'

interface RepeaterFieldArgs {
  repeatedFieldData: {
    type: string
    [key: string]: any
  }
  value: Array<{ [key: string]: any }>
}

class RepeaterField extends Field {
  constructor({ repeatedFieldData, value }: RepeaterFieldArgs) {
    const repeatedFields = value
      .map((repeatedEntryData: { [key: string]: any }) => {
        return FieldFactory.create({
          fieldData: {
            localize: false,
            name: 'value',
            options: [],
            ...repeatedFieldData,
          },
          value: repeatedEntryData.value,
          ...ObjectUtils.getRelatedEntriesSubset(repeatedEntryData, 'value'),
        })
      })
      .filter((field: Field | null): field is Field => !!field)

    super({ type: 'repeater', value: repeatedFields })
  }
}

export default RepeaterField
