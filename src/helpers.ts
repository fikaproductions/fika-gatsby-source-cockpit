import gatsbyNodeHelpers from 'gatsby-node-helpers'
import hash from 'string-hash'

import { TYPE_PREFIX_COCKPIT } from './constants'

const { generateNodeId } = gatsbyNodeHelpers({
  typePrefix: TYPE_PREFIX_COCKPIT,
})

export function getFieldsOfTypes(item: any, types: any) {
  const fieldsOfTypes = Object.keys(item)
    .filter(fieldName => item[fieldName] && types.includes(item[fieldName].type))
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
      item[fieldName].value.forEach((repeaterEntry: any) => {
        fieldsOfTypes.push(...getFieldsOfTypes({ repeater: repeaterEntry }, types))
      })
    })

  return fieldsOfTypes
}

export function linkImageFieldsToImageNodes(node: any, images: any) {
  getFieldsOfTypes(node, ['image']).forEach(field => {
    if (images[field.value] !== null) {
      field.value___NODE = images[field.value].id
      delete field.value
    } else {
      field.value = null
    }
  })

  getFieldsOfTypes(node, ['gallery']).forEach(field => {
    if (Array.isArray(field.value)) {
      field.value___NODE = field.value
        .map((imageField: any) => (images[imageField.value] !== null ? images[imageField.value].id : null))
        .filter((imageId: any) => imageId != null)
    }
    delete field.value
  })
}

export function linkAssetFieldsToAssetNodes(node: any, assets: any) {
  getFieldsOfTypes(node, ['asset']).forEach(field => {
    if (assets[field.value]) {
      field.value___NODE = assets[field.value].id
      delete field.value
    } else {
      field.value = null
    }
  })
}

export function createObjectNodes(node: any, objectNodeFactory: any) {
  getFieldsOfTypes(node, ['object']).forEach(field => {
    const objectNodeId = objectNodeFactory.create(field.value)
    field.value___NODE = objectNodeId
    delete field.value
  })
}

export function linkMarkdownFieldsToMarkdownNodes(node: any, markdowns: any) {
  getFieldsOfTypes(node, ['markdown']).forEach(field => {
    field.value___NODE = markdowns[field.value].id
    delete field.value
  })
}

export function linkLayoutFieldsToLayoutNodes(node: any, layouts: any) {
  getFieldsOfTypes(node, ['layout', 'layout-grid']).forEach(field => {
    const layoutHash = hash(JSON.stringify(field.value))
    field.value___NODE = layouts[layoutHash].id
    delete field.value
  })
}

export function linkCollectionLinkFieldsToCollectionItemNodes(node: any) {
  getFieldsOfTypes(node, ['collectionlink']).forEach(field => {
    if (Array.isArray(field.value)) {
      const collectionName = field.value[0].link

      field.value.forEach((linkedCollection: any) => {
        if (linkedCollection.link !== collectionName) {
          throw new Error(
            `One to many Collection-Links must refer to entries from a single collection (concerned field: )` // TO DO ${fieldName}
          )
        }
      })

      field.value___NODE = field.value.map((linkedCollection: any) =>
        generateNodeId(
          linkedCollection.link,
          node.lang === 'any' ? linkedCollection._id : `${linkedCollection._id}_${node.lang}`
        )
      )
    } else {
      field.value___NODE = generateNodeId(
        field.value.link,
        node.lang === 'any' ? field.value._id : `${field.value._id}_${node.lang}`
      )
    }

    delete field.value
  })
}
