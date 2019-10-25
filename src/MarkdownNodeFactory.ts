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

  public create(markdown: any) {
    const partialId = `${hash(markdown)}`

    this.createNode(
      createNodeFactory('Markdown', (node: any) => {
        node.internal.mediaType = 'text/markdown'
        node.internal.content = markdown
        delete node.cockpitId

        return node
      })({ id: partialId })
    )

    return generateNodeId('Markdown', partialId)
  }
}
