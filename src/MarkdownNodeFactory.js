const {
  createNodeFactory,
  generateNodeId,
} = require('gatsby-node-helpers').default({
  typePrefix: 'Cockpit',
})

module.exports = class MarkdownNodeFactory {
  constructor(createNode) {
    this.createNode = createNode
  }

  create(markdown) {
    this.createNode(
      createNodeFactory('Markdown', node => {
        node.internal.mediaType = 'text/markdown'
        node.internal.content = markdown.raw
        delete node.cockpitId

        return node
      })({ id: markdown.id })
    )
  }
}
