const { generateNodeId } = require('gatsby-node-helpers').default({
  typePrefix: 'Cockpit',
})
const { createRemoteFileNode } = require('gatsby-source-filesystem')
const hash = require('string-hash')

module.exports = class FileNodeFactory {
  constructor(createNode, store, cache) {
    this.createNode = createNode
    this.store = store
    this.cache = cache
  }

  async createImageNode(path) {
    return createRemoteFileNode({
      url: path,
      store: this.store,
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId('Image', `${hash(path)}`),
    })
  }

  async createAssetNode(path) {
    return createRemoteFileNode({
      url: path,
      store: this.store,
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId('Asset', `${hash(path)}`),
    })
  }
}
