const {
  createNodeFactory,
  generateNodeId,
} = require('gatsby-node-helpers').default({
  typePrefix: 'Cockpit',
})
const getFieldsOfTypes = require('./helpers.js').getFieldsOfTypes

module.exports = class CollectionItemNodeFactory {
  constructor(createNode, collectionName, images, assets, markdowns) {
    this.createNode = createNode
    this.collectionName = collectionName
    this.images = images
    this.assets = assets
    this.markdowns = markdowns
  }

  create(collectionItem) {
    const children = collectionItem.hasOwnProperty('children')
      ? collectionItem.children.map(childItem => {
          return this.create(childItem)
        })
      : []
    delete collectionItem.children

    const nodeFactory = createNodeFactory(this.collectionName, node => {
      node.id = generateNodeId(
        this.collectionName,
        node.lang === 'any' ? node.cockpitId : `${node.cockpitId}_${node.lang}`
      )
      linkImageFieldsToImageNodes(node, this.images)
      linkAssetFieldsToAssetNodes(node, this.assets)
      linkMarkdownFieldsToMarkdownNodes(node, this.markdowns)
      linkCollectionLinkFieldsToCollectionItemNodes(node)
      linkChildrenToParent(node, children)

      return node
    })

    const node = nodeFactory(collectionItem)
    this.createNode(node)

    return node
  }
}

const linkImageFieldsToImageNodes = (node, images) => {
  getFieldsOfTypes(node, ['image']).forEach(field => {
    field.value___NODE = images[field.value].id
    delete field.value
  })

  getFieldsOfTypes(node, ['gallery']).forEach(field => {
    if (Array.isArray(field.value)) {
      field.value___NODE = field.value.map(
        imageField => images[imageField.value].id
      )
    }
    delete field.value
  })
}

const linkAssetFieldsToAssetNodes = (node, assets) => {
  getFieldsOfTypes(node, ['asset']).forEach(field => {
    field.value___NODE = assets[field.value].id
    delete field.value
  })
}

const linkMarkdownFieldsToMarkdownNodes = (node, markdowns) => {
  getFieldsOfTypes(node, ['markdown']).forEach(field => {
    field.value___NODE = markdowns[field.value].id
    delete field.value
  })
}

const linkCollectionLinkFieldsToCollectionItemNodes = node => {
  getFieldsOfTypes(node, ['collectionlink']).forEach(field => {
    if (Array.isArray(field.value)) {
      const collectionName = field.value[0].link

      field.value.forEach(linkedCollection => {
        if (linkedCollection.link !== collectionName) {
          throw new Error(
            `One to many Collection-Links must refer to entries from a single collection (concerned field: ${fieldName})`
          )
        }
      })

      field.value___NODE = field.value.map(linkedCollection =>
        generateNodeId(
          linkedCollection.link,
          node.lang === 'any'
            ? linkedCollection._id
            : `${linkedCollection._id}_${node.lang}`
        )
      )
    } else {
      field.value___NODE = generateNodeId(
        field.value.link,
        node.lang === 'any'
          ? field.value._id
          : `${field.value._id}_${node.lang}`
      )
    }

    delete field.value
  })
}

const linkChildrenToParent = (node, children) => {
  if (Array.isArray(children) && children.length > 0) {
    node.children___NODE = children.map(child => child.id)
    children.forEach(child => {
      child.parent___NODE = node.id
    })
    delete node.children
  }
}
