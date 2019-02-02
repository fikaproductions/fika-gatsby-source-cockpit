const { TYPE_PREFIX_COCKPIT } = require('./constants')

const {
  createNodeFactory,
  generateNodeId,
} = require('gatsby-node-helpers').default({
  typePrefix: TYPE_PREFIX_COCKPIT,
})
const hash = require('string-hash')

module.exports = class LayoutNodeFactory {
  constructor(createNode) {
    this.createNode = createNode
  }

  create(layout) {
    const stringifiedLayout = JSON.stringify(layout)
    const partialId = `${hash(stringifiedLayout)}`

    this.createNode(
      createNodeFactory('LayoutNode', node => {
        node.internal.mediaType = 'application/json'
        node.internal.content = stringifiedLayout
        delete node.cockpitId

        return node
      })({ id: partialId })
    )

    return generateNodeId('LayoutNode', partialId)
  }
}
