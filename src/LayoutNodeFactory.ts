import gatsbyNodeHelpers from 'gatsby-node-helpers'
import hash from 'string-hash'

import { TYPE_PREFIX_COCKPIT } from './constants'

const { createNodeFactory, generateNodeId } = gatsbyNodeHelpers({
  typePrefix: TYPE_PREFIX_COCKPIT,
})

export default class {
  private createNode: any

  constructor(createNode: any) {
    this.createNode = createNode
  }

  public create(layout: any) {
    const stringifiedLayout = JSON.stringify(layout)
    const partialId = `${hash(stringifiedLayout)}`

    this.createNode(
      createNodeFactory('LayoutNode', (node: any) => {
        node.internal.mediaType = 'application/json'
        node.internal.content = stringifiedLayout
        delete node.cockpitId

        return node
      })({ id: partialId })
    )

    return generateNodeId('LayoutNode', partialId)
  }
}
