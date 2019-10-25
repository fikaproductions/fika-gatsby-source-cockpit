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

  public create(object: any) {
    const stringifiedObject = JSON.stringify(object)
    const partialId = `${hash(stringifiedObject)}`

    this.createNode(
      createNodeFactory('ObjectNode', (node: any) => {
        node.internal.mediaType = 'application/json'
        node.internal.content = stringifiedObject
        delete node.cockpitId

        return node
      })({ id: partialId })
    )

    return generateNodeId('ObjectNode', partialId)
  }
}
