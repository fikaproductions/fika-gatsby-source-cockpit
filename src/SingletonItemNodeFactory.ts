import gatsbyNodeHelpers from 'gatsby-node-helpers'

import { TYPE_PREFIX_COCKPIT } from './constants'
import {
  createObjectNodes,
  linkAssetFieldsToAssetNodes,
  linkCollectionLinkFieldsToCollectionItemNodes,
  linkImageFieldsToImageNodes,
  linkLayoutFieldsToLayoutNodes,
  linkMarkdownFieldsToMarkdownNodes,
} from './helpers.js'
import ObjectNodeFactory from './ObjectNodeFactory'

const { createNodeFactory, generateNodeId } = gatsbyNodeHelpers({
  typePrefix: TYPE_PREFIX_COCKPIT,
})

export default class {
  private createNode: any
  private singletonName: string
  private images: any
  private assets: any
  private markdowns: any
  private layouts: any
  private objectNodeFactory: ObjectNodeFactory

  constructor(createNode: any, singletonName: string, images: any, assets: any, markdowns: any, layouts: any) {
    this.createNode = createNode
    this.singletonName = singletonName
    this.images = images
    this.assets = assets
    this.markdowns = markdowns
    this.layouts = layouts
    this.objectNodeFactory = new ObjectNodeFactory(createNode)
  }

  public create(singletonItem: any) {
    const nodeFactory = createNodeFactory(this.singletonName, (node: any) => {
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
