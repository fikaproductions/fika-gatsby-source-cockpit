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
  private collectionName: string
  private images: any
  private assets: any
  private markdowns: any
  private layouts: any
  private objectNodeFactory: ObjectNodeFactory

  constructor(createNode: any, collectionName: string, images: any, assets: any, markdowns: any, layouts: any) {
    this.createNode = createNode
    this.collectionName = collectionName
    this.images = images
    this.assets = assets
    this.markdowns = markdowns
    this.layouts = layouts
    this.objectNodeFactory = new ObjectNodeFactory(createNode)
  }

  public create(collectionItem: any) {
    const children = collectionItem.hasOwnProperty('children')
      ? collectionItem.children.map((childItem: any) => {
          return this.create(childItem)
        })
      : []
    delete collectionItem.children

    const nodeFactory = createNodeFactory(this.collectionName, (node: any) => {
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
      linkChildrenToParent(node, children)

      return node
    })

    const node = nodeFactory(collectionItem)
    this.createNode(node)

    return node
  }
}

const linkChildrenToParent = (node: any, children: any) => {
  if (Array.isArray(children) && children.length > 0) {
    node.children___NODE = children.map(child => child.id)
    children.forEach(child => {
      child.parent___NODE = node.id
    })
    delete node.children
  }
}
