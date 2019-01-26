const colorString = require('color-string')

const {
  createNodeFactory,
  generateNodeId,
} = require('gatsby-node-helpers').default({
  typePrefix: 'Cockpit',
})

// TODO: add option to enabled "default" values that are not erased in the Graphql tree
// TODO: do we need a class? most of the rest of the code is functional
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
    // TODO: can i move this to the node factory?
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

    // TODO: recreating the node factory for every item kind of defeats the purpose
    // of having a factory
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
      ...generateNodeData(collectionItem, {
        ...this.resources,
        item: collectionItem,
      }),
      children,
    })
    this.createNode(node)
    return node
  }
}

const generateNodeData = (item, resources) => {
  const result = {}
  // TODO: change this to a reduce implementation
  // TODO: add context information (hierarchy in tree) to fieldData
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

      // TODO: is this Tuple the best solution?
      const [newName, newValue] = processField(fieldData, resources)
      result[newName] = newValue
    }
  })
  return result
}

const processField = (fieldData, resources) => {
  const { name, type } = fieldData

  // TODO: add check if type is present
  if (!valueTransformers.hasOwnProperty(type)) {
    console.warn(
      `Unknown field type '${type}' found for field '${name}' - skipping field.`
    )
    return [name, null]
  }

  return valueTransformers[type](fieldData, resources)
}

// TODO: rename, we are not transforming anything
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
  return [name, generateNodeData(value, resources)]
}

const transformRepeaterFieldValue = ({ name, value }, resources) => {
  if (Array.isArray(value)) {
    let isNodeLink = false
    const entries = value.map(field => {
      // the repeater fields are the only ones without a "name" attribute, so
      // we need to fake one so that processFields works correctly.
      const [fieldName, fieldValue] = processField(
        { ...field, name: 'repeaterentry' },
        resources
      )
      isNodeLink = fieldName.indexOf('___NODE') !== -1
      return fieldValue
    })
    return [isNodeLink ? `${name}___NODE` : name, entries]
  }
  return [name, []]
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

// TODO: extract this all to a different file/module/class
const valueTransformers = {
  // for these types we just copy the values from Cockpit without modification
  text: transformScalarFieldValue, // TODO: strip html tags (on demand)
  textarea: transformScalarFieldValue, // TODO: strip html tags (on demand)
  boolean: transformScalarFieldValue,
  code: transformScalarFieldValue,
  rating: transformScalarFieldValue,
  location: transformScalarFieldValue, // TODO: address field might not be set
  select: transformScalarFieldValue,
  multipleselect: transformScalarFieldValue,
  tags: transformScalarFieldValue,
  date: transformScalarFieldValue, // TODO: parse date
  time: transformScalarFieldValue,

  // for colors we parse the color and generate an object with color information
  color: transformColorFieldValue,
  colortag: transformColorFieldValue,

  // files & images are downloaded and stored in separate nodes, we just need to link them
  asset: transformAssetFieldValue, // TODO: evaluate metadata
  image: transformImageFieldValue, // TODO: evaluate metadata
  gallery: transformGalleryFieldValue, // TODO: evaluate metadata

  // html text will be parsed and optionally cleaned
  html: transformHTMLFieldValue, // TODO: parse HTML, sanitize HTML
  wysiwyg: transformHTMLFieldValue, // TODO: parse HTML, sanitize HTML
  markdown: transformMarkdownFieldValue, // TODO: transform markdown to html?

  // nested fields need to be processed recursively
  collectionlink: transformCollectionLinkFieldValue,
  set: transformSetFieldValue,
  repeater: transformRepeaterFieldValue,

  // JSON data is stored stringified (and later stored parsed in a GraphQLJSON field)
  object: transformObjectFieldValue, // TODO: store as JSON Node
  layout: transformLayoutFieldValue, // TODO: store as JSON Node (separate PR)
  'layout-grid': transformLayoutFieldValue,

  // not implemented yet but should be possible to implement
  'access-list': transformUnsupportedTypeFiledValue, // TODO: implement
  'account-link': transformUnsupportedTypeFiledValue, // TODO: implement
  file: transformUnsupportedTypeFiledValue, // TODO: implement

  // password is returned encoded; there is probably no situation where this will
  // be useful in Gatsby therefore we just print a warning and ignore it for now.
  password: transformUnsupportedTypeFiledValue,
}
