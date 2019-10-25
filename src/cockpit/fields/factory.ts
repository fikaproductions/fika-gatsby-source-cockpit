import ArrayUtils from '../../utils/array-utils'
import Field from './field'
import RepeaterField from './repeater-field'
import TextField from './text-field'

interface FieldFactoryCreateArgs {
  fieldData: import('../client').FieldPayload
  value: any
  [relatedValue: string]: any
}

class FieldFactory {
  public static create({ fieldData, value, ...relatedValues }: FieldFactoryCreateArgs): Field | null {
    if (ArrayUtils.isEmptyArray(value) || value == null || value === '') {
      return null
    }

    switch (fieldData.type) {
      case 'text':
        return new TextField({ slug: relatedValues.slug, value })
      case 'repeater': {
        if (!Array.isArray(fieldData.options)) {
          if (fieldData.options.field) {
            return new RepeaterField({ repeatedFieldData: fieldData.options.field, value })
          }

          if (fieldData.options.fields) {
            return null
          }
        }

        return null
      }
      default:
        return new Field({ type: fieldData.type, value })
    }
  }
}

export default FieldFactory
