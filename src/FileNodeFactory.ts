import { readFileSync } from 'fs'
import gatsbyNodeHelpers from 'gatsby-node-helpers'
import { createRemoteFileNode } from 'gatsby-source-filesystem'
import hash from 'string-hash'

import { TYPE_PREFIX_COCKPIT } from './constants'

const { generateNodeId } = gatsbyNodeHelpers({
  typePrefix: TYPE_PREFIX_COCKPIT,
})

export default class {
  private createNode: any
  private store: any
  private cache: any
  private reporter: any

  constructor(createNode: any, store: any, cache: any, reporter: any) {
    this.createNode = createNode
    this.store = store
    this.cache = cache
    this.reporter = reporter
  }

  public async createImageNode(path: string) {
    const imageNode = await createRemoteFileNode({
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId('Image', `${hash(path)}`),
      store: this.store,
      url: path,
    })

    return this.checkIfDownloadIsSuccessful(path, imageNode)
  }

  public async createAssetNode(path: string) {
    const assetNode = await createRemoteFileNode({
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId('Asset', `${hash(path)}`),
      store: this.store,
      url: path,
    })

    return this.checkIfDownloadIsSuccessful(path, assetNode)
  }

  private checkIfDownloadIsSuccessful(path: string, fileNode: any) {
    const filePath = fileNode.absolutePath
    const content = readFileSync(filePath)
    // TODO: evaluate if we should check for something else if Cockpit instance is localized
    if (content.indexOf('<title>Authenticate Please!</title>') > 0) {
      this.reporter.warn('Invalid asset url: ' + path)
      return null
    }
    return fileNode
  }
}
