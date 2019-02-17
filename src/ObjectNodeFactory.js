const { TYPE_PREFIX_COCKPIT } = require('./constants')

const {
  createNodeFactory,
  generateNodeId,
} = require('gatsby-node-helpers').default({
  typePrefix: TYPE_PREFIX_COCKPIT,
})
const hash = require('string-hash')

module.exports = class ObjectNodeFactory {
  constructor(createNode) {
    this.createNode = createNode
  }

  create(object) {
    const stringifiedObject = JSON.stringify(object)
    const partialId = `${hash(stringifiedObject)}`

    this.createNode(
      createNodeFactory('ObjectNode', node => {
        node.internal.mediaType = 'application/json'
        node.internal.content = stringifiedObject
        delete node.cockpitId

        return node
      })({ id: partialId })
    )

    return generateNodeId('ObjectNode', partialId)
  }
}
