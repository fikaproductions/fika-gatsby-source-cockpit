const {
  createNodeFactory,
  generateNodeId,
} = require('gatsby-node-helpers').default({
  typePrefix: 'Cockpit',
})
const hash = require('string-hash')

module.exports = class MarkdownNodeFactory {
  constructor(createNode) {
    this.createNode = createNode
  }

  create(markdown) {
    const partialId = `${hash(markdown)}`

    this.createNode(
      createNodeFactory('Markdown', node => {
        node.internal.mediaType = 'text/markdown'
        node.internal.content = markdown
        delete node.cockpitId

        return node
      })({ id: partialId })
    )

    return generateNodeId('Markdown', partialId)
  }
}
