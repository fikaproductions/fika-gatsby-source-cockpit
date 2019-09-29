const { TYPE_PREFIX_COCKPIT } = require('./constants')
const ObjectNodeFactory = require('./ObjectNodeFactory')
const {
  linkImageFieldsToImageNodes,
  linkAssetFieldsToAssetNodes,
  linkMarkdownFieldsToMarkdownNodes,
  linkLayoutFieldsToLayoutNodes,
  linkCollectionLinkFieldsToCollectionItemNodes,
  createObjectNodes,
} = require('./helpers.js')

const {
  createNodeFactory,
  generateNodeId,
} = require('gatsby-node-helpers').default({
  typePrefix: TYPE_PREFIX_COCKPIT,
})

module.exports = class CollectionItemNodeFactory {
  constructor(
    createNode,
    createParentChildLink,
    collectionName,
    images,
    assets,
    markdowns,
    layouts
  ) {
    this.createNode = createNode
    this.createParentChildLink = createParentChildLink
    this.collectionName = collectionName
    this.images = images
    this.assets = assets
    this.markdowns = markdowns
    this.layouts = layouts

    this.objectNodeFactory = new ObjectNodeFactory(createNode)
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
      linkLayoutFieldsToLayoutNodes(node, this.layouts)
      linkCollectionLinkFieldsToCollectionItemNodes(node)
      createObjectNodes(node, this.objectNodeFactory)

      return node
    })

    const node = nodeFactory(collectionItem)
    this.createNode(node)
    linkChildrenToParent(node, children, this.createParentChildLink)

    return node
  }
}

const linkChildrenToParent = (node, children, createParentChildLink) => {
  if (Array.isArray(children) && children.length > 0) {
    children.forEach(child => {
      createParentChildLink({ parent: node, child })
    })
  }
}
