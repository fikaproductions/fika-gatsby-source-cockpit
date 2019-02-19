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

module.exports = class SingletonItemNodeFactory {
  constructor(createNode, singletonName, images, assets, markdowns, layouts) {
    this.createNode = createNode
    this.singletonName = singletonName
    this.images = images
    this.assets = assets
    this.markdowns = markdowns
    this.layouts = layouts

    this.objectNodeFactory = new ObjectNodeFactory(createNode)
  }

  create(singletonItem) {
    const nodeFactory = createNodeFactory(this.singletonName, node => {
      node.id = generateNodeId(
        this.singletonName,
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

    const node = nodeFactory(singletonItem)
    this.createNode(node)

    return node
  }
}
