const colorString = require('color-string')

const {
  createNodeFactory,
  generateNodeId,
} = require('gatsby-node-helpers').default({
  typePrefix: 'Cockpit',
})

module.exports = class NewCollectionItemNodeFactory {
  constructor(createNode, collectionName, images, assets, markdowns, config) {
    this.createNode = createNode
    this.collectionName = collectionName
    this.resources = {
      collectionName,
      images,
      assets,
      markdowns,
      config,
    }
  }

  create(collectionItem) {
    const children = collectionItem.hasOwnProperty('children')
      ? collectionItem.children.map(childItem => {
          return this.create(childItem)
        })
      : []
    delete collectionItem.children

    // TODO: check if this is required - nodeFactory should create a node id already
    const generateNodeIdFromItem = item => {
      return generateNodeId(
        this.collectionName,
        item.lang === 'any' ? item.cockpitId : `${item.cockpitId}_${item.lang}`
      )
    }

    const CollectionItem = createNodeFactory(this.collectionName, node => {
      node.id = generateNodeIdFromItem(node)

      if (Array.isArray(node.children)) {
        node.children___NODE = node.children.map(child => {
          child.parent___NODE = node.id
          return child.id
        })
        delete node.children
      }

      return node
    })

    const node = CollectionItem({
      ...generateNodeData(collectionItem, this.resources),
      children,
    })
    this.createNode(node)
    return node
  }
}

const generateNodeData = (item, resources) => {
  const result = {}
  // TODO: change this to a reduce implementation
  Object.keys(item).forEach(name => {
    if (['cockpitId', 'lang', 'level'].includes(name)) {
      result[name] = item[name]
    } else if (['children', 'parent'].includes(name)) {
      // do nothing as we handle this values later in the process
    } else {
      const fieldData = {
        ...item[name],
        name,
      }
      const [newName, newValue] = processField(fieldData, {
        ...resources,
        item,
      })
      result[newName] = newValue
    }
  })
  return result
}

const processField = (fieldData, resources) => {
  const { name, type } = fieldData

  if (!valueTransformers.hasOwnProperty(type)) {
    console.warn(
      `Unknown field type '${type}' found for field '${name}' - skipping field.`
    )
    return [name, null]
  }

  return valueTransformers[type](fieldData, resources)
}

const transformScalarFieldValue = ({ name, value }) => {
  return [name, value]
}

const transformAssetFieldValue = ({ name, value }, { assets }) => {
  if (assets.hasOwnProperty(value)) {
    return [`${name}___NODE`, assets[value].id]
  }
  return [name, null]
}

const transformImageFieldValue = ({ name, value }, { images }) => {
  if (images.hasOwnProperty(value)) {
    return [`${name}___NODE`, images[value].id]
  }
  return [name, null]
}

const transformGalleryFieldValue = ({ name, value }, { images }) => {
  if (Array.isArray(value)) {
    const result = value
      .map(({ value: imageUrl }) =>
        images.hasOwnProperty(imageUrl) ? images[imageUrl].id : null
      )
      .filter(image => image !== null)
    return [`${name}___NODE`, result]
  }

  return [fieldName, []]
}

const transformColorFieldValue = ({ name, value }) => {
  const parsedColor = colorString.get.rgb(value)
  const [red, green, blue, alpha] = parsedColor
  const parsedValue = {
    parsed: {
      red,
      green,
      blue,
      alpha,
    },
    hex: colorString.to.hex(parsedColor),
    rgb: colorString.to.rgb(parsedColor),
  }
  return [name, parsedValue]
}

const transformHTMLFieldValue = ({ name, value }) => {
  // TODO:
  //  - parse HTML Code into react representation
  //  - validate html code and strip stuff we don't want
  //  - replace image URLS
  return [name, value]
}

const transformMarkdownFieldValue = ({ name, value }, { markdowns }) => {
  return [`${name}___NODE`, markdowns[value].id]
}

const transformLayoutFieldValue = ({ name, value }) => {
  // TODO:
  //  - create separate node for layout object
  //  - parse data in add-entity-fields.js
  return [name, JSON.stringify(value)]
}

const transformObjectFieldValue = ({ name, value }) => {
  // TODO:
  //  - create separate node for json object
  //  - parse data in add-entity-fields.js
  return [name, JSON.stringify(value)]
}

const transformUnsupportedTypeFiledValue = ({ name, value, type }) => {
  console.warn(
    `Field type '${type}' is currently not supported by @fika/gatsby-source-cockpit`
  )
  return [name, null]
}

const transformSetFieldValue = ({ name, value }, resources) => {
  return [name, null]
}

const transformRepeaterFieldValue = ({ name, value }, resources) => {
  if (Array.isArray()) {
    return [name, null]
  }
}

const transformCollectionLinkFieldValue = ({ name, value }, { item }) => {
  // TODO: we should probably "normalize" the collection link ids much earlier in the process
  if (Array.isArray(value)) {
    const collectionName = value[0].link

    value.forEach(linkedCollection => {
      if (linkedCollection.link !== collectionName) {
        throw new Error(
          `One to many Collection-Links must refer to entries from a single collection (concerned field: ${fieldName})`
        )
      }
    })

    const result = value.map(linkedCollection =>
      generateNodeId(
        linkedCollection.link,
        item.lang === 'any'
          ? linkedCollection._id
          : `${linkedCollection._id}_${item.lang}`
      )
    )
    return [`${name}___NODE`, result]
  } else {
    const linkedNodeId = generateNodeId(
      value.link,
      item.lang === 'any' ? value._id : `${value._id}_${item.lang}`
    )
    return [`${name}___NODE`, linkedNodeId]
  }
}

const valueTransformers = {
  // for these types we just copy the values from Cockpit without modification
  text: transformScalarFieldValue,
  textarea: transformScalarFieldValue,
  boolean: transformScalarFieldValue,
  code: transformScalarFieldValue,
  rating: transformScalarFieldValue,
  location: transformScalarFieldValue,
  select: transformScalarFieldValue,
  multipleselect: transformScalarFieldValue,
  tags: transformScalarFieldValue,
  date: transformScalarFieldValue,
  time: transformScalarFieldValue,

  // for colors we parse the color and generate an object with color information
  color: transformColorFieldValue,
  colortag: transformColorFieldValue,

  // files & images are downloaded and stored in separate nodes, we just need to link them
  asset: transformAssetFieldValue,
  image: transformImageFieldValue,
  gallery: transformGalleryFieldValue,

  // html text will be parsed and optionally cleaned
  html: transformHTMLFieldValue,
  wysiwyg: transformHTMLFieldValue,
  markdown: transformMarkdownFieldValue,

  // nested fields need to be processed recursively
  collectionlink: transformCollectionLinkFieldValue,

  // JSON data is stored stringified (and later stored parsed in a GraphQLJSON field)
  object: transformObjectFieldValue,
  layout: transformLayoutFieldValue,
  'layout-grid': transformLayoutFieldValue,

  // not implemented yet but should be possible to implement
  'access-list': transformUnsupportedTypeFiledValue,
  'account-link': transformUnsupportedTypeFiledValue,
  file: transformUnsupportedTypeFiledValue,

  // password is returned encoded; there is probably no situation where this will
  // be useful in Gatsby therefore we just print a warning and ignore it for now.
  password: transformUnsupportedTypeFiledValue,
}
