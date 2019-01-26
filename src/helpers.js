function getFieldsOfTypes(item, types) {
  const fieldsOfTypes = Object.keys(item)
    .filter(
      fieldName => item[fieldName] && types.includes(item[fieldName].type)
    )
    .map(fieldName => item[fieldName])

  // process fields nested in set
  Object.keys(item)
    .filter(fieldName => item[fieldName] && item[fieldName].type === 'set')
    .forEach(fieldName => {
      fieldsOfTypes.push(...getFieldsOfTypes(item[fieldName].value, types))
    })

  // process fields nested in repeater
  Object.keys(item)
    .filter(fieldName => item[fieldName] && item[fieldName].type === 'repeater')
    .forEach(fieldName => {
      item[fieldName].value.forEach(repeaterEntry => {
        fieldsOfTypes.push(
          ...getFieldsOfTypes({ repeater: repeaterEntry }, types)
        )
      })
    })

  return fieldsOfTypes
}

module.exports.getFieldsOfTypes = getFieldsOfTypes
