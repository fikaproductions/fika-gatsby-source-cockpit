const { TYPE_PREFIX_COCKPIT } = require('./constants')

const { generateNodeId } = require('gatsby-node-helpers').default({
  typePrefix: TYPE_PREFIX_COCKPIT,
})
const { createRemoteFileNode } = require('gatsby-source-filesystem')
const hash = require('string-hash')
const fs = require('fs')

module.exports = class FileNodeFactory {
  constructor(createNode, store, cache, reporter) {
    this.createNode = createNode
    this.store = store
    this.cache = cache
    this.reporter = reporter
  }

  async createImageNode(path) {
    const imageNode = await createRemoteFileNode({
      url: path,
      store: this.store,
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId('Image', `${hash(path)}`),
    })

    return this.checkIfDownloadIsSuccessful(path, imageNode)
  }

  async createAssetNode(path) {
    const assetNode = await createRemoteFileNode({
      url: path,
      store: this.store,
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId('Asset', `${hash(path)}`),
    })

    return this.checkIfDownloadIsSuccessful(path, assetNode)
  }

  checkIfDownloadIsSuccessful(path, fileNode) {
    const filePath = fileNode.absolutePath
    const content = fs.readFileSync(filePath)
    // TODO: evaluate if we should check for something else if Cockpit instance is localized
    if (content.indexOf('<title>Authenticate Please!</title>') > 0) {
      this.reporter.warn('Invalid asset url: ' + path)
      return null
    }
    return fileNode
  }
}
