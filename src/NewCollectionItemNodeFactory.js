const colorString = require('color-string');

const {
  createNodeFactory,
  generateNodeId
} = require("gatsby-node-helpers").default({
  typePrefix: "Cockpit"
});

module.exports = class NewCollectionItemNodeFactory {

  constructor(createNode, collectionName, images, assets, markdowns) {
    this.createNode = createNode;
    this.collectionName = collectionName;
    this.images = images;
    this.assets = assets;
    this.markdowns = markdowns;
    this.resources = {
      images,
      assets,
      markdowns,
    }
  }

  create(collectionItem) {
    const children = collectionItem.hasOwnProperty('children')
      ? collectionItem.children.map(childItem => {
        return this.create(childItem);
      })
      : [];
    delete collectionItem.children;

    const generateNodeIdFromItem = (item) => {
      return generateNodeId(
        this.collectionName,
        item.lang === "any"
          ? item.cockpitId
          : `${item.cockpitId}_${item.lang}`
      )
    }

    const nodeFactory = createNodeFactory(this.collectionName, item => {
      const node = this.processFields(item);
      node.id = generateNodeIdFromItem(item);
      return node;
    });

    const node = nodeFactory(collectionItem);
    linkChildrenToParent(node,  children);
    this.createNode(node);

    return node;
  }

  processFields(item) {
    const result = {};
    // TODO: change this to a reduce implementation
    Object.keys(item).forEach(fieldName => {
      const [newFieldName, newValue] = this.processField(fieldName, item[fieldName]);
      result[newFieldName] = newValue;
    });
    return result;
  }

  /**
   *
   * @param fieldName
   * @param fieldData
   * @returns [ string, mixed] tuple of new field name and new field value
   */
  processField(fieldName, fieldData) {
    const { type } = fieldData;
    // switch type, assign value
    if (!valueTransformers.hasOwnProperty(type)) {
      console.warn(`Unknown field type '${type}' found for field '${fieldName}' - skipping field.`);
      return [fieldName, null];
    }
    return valueTransformers[type]({
      ...fieldData,
      name: fieldName,
    }, this.resources);
  }
}

const transformScalarFieldValue = ({ name, value }) => {
  return [name, value];
}

const transformAssetFieldValue = ({ name, value }, { assets }) => {
  if (assets.hasOwnProperty(value)) {
    return [`${name}___NODE`, assets[value].id];
  }
  return [name, null];
}

const transformImageFieldValue = ({ name, value }, { images }) => {
  if (images.hasOwnProperty(value)) {
    return [`${name}___NODE`, images[value].id];
  }
  return [name, null];
}

const transformGalleryFieldValue = ({ name, value }, { images }) => {
  if (Array.isArray(value)) {
    const result = value.map(({ value: imageUrl }) =>
      images.hasOwnProperty(imageUrl)
        ? images[imageUrl].id
        : null
    ).filter(image => image !== null);
    return [`${name}___NODE`, result];
  }

  return [fieldName, []];
}

const transformColorFieldValue = ({ name, value }) => {
  const parsedColor = colorString.get.rgb(value);
  const [ red, green, blue, alpha ] = parsedColor;
  const parsedValue = {
    parsed: {
      red,
      green,
      blue,
      alpha
    },
    hex: colorString.to.hex(parsedColor),
    rgb: colorString.to.rgb(parsedColor),
  };
  return [name, parsedValue];
}

const transformHTMLFieldValue = ({ name, value }) => {
  // TODO:
  //  - parse HTML Code into react representation
  //  - validate html code and strip stuff we don't want
  //  - replace image URLS
  return [name, value];
}

const transformMarkdownFieldValue = ({ name, value }, { markdowns }) => {
  return [`${name}___NODE`, markdowns[value].id];
};

const transformLayoutFieldValue = ({ name, value }) => {
  // TODO:
  //  - create separate node for layout object
  //  - parse data in add-entity-fields.js
  return [name, JSON.stringify(value)];
}

const transformObjectFieldValue = ({ name, value }) => {
  // TODO:
  //  - create separate node for json object
  //  - parse data in add-entity-fields.js
  return [name, JSON.stringify(value)];
}

const transformUnsupportedTypeFiledValue = ({ name, value, type }) => {
  console.warn(`Field type '${type}' is currently not supported by @fika/gatsby-source-cockpit`);
  return [name, null];
}

const transformSetFieldValue = ({ name, value }, resources) => {
  console.log(value);
  return [name, null];
}

const transformRepeaterFieldValue = ({ name, value }, resources) => {
  if (Array.isArray()) {
    return [name, null];
  }
}

/*
const transformCollectionLinkFieldValue = (fieldName, value) => {
  if (Array.isArray(value)) {
    const collectionName = field.value[0].link;

    field.value.forEach(linkedCollection => {
      if (linkedCollection.link !== collectionName) {
        throw new Error(
          `One to many Collection-Links must refer to entries from a single collection (concerned field: ${fieldName})`
        );
      }
    });

    field.value___NODE = field.value.map(linkedCollection =>
      generateNodeId(
        linkedCollection.link,
        node.lang === "any"
          ? linkedCollection._id
          : `${linkedCollection._id}_${node.lang}`
      )
    );
  } else {
    const linkedNodeId = generateNodeId(
      value.link,
      node.lang === "any"
        ? value._id
        : `${value._id}_${node.lang}`
    );
    return [`${fieldName}___NODE`, linkedNodeId];
  }
}
*/



const linkChildrenToParent = (node, children) => {

  if (Array.isArray(children) && children.length > 0) {
    node.children___NODE = children.map(child => child.id);
    children.forEach(child => {
      child.parent___NODE = node.id;
    });
    delete node.children;
  }
};


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


  // JSON data is stored stringified (and later stored parsed in a GraphQLJSON field)
  object: transformObjectFieldValue,
  layout: transformLayoutFieldValue,
  'layout-grid': transformLayoutFieldValue,

  // not implemented yet but should be possible to implement
  'access-list': transformUnsupportedTypeFiledValue,
  'account-link': transformUnsupportedTypeFiledValue,
  'file': transformUnsupportedTypeFiledValue,

  // password is returned encoded; there is probably no situation where this will
  // be useful in Gatsby therefore we just print a warning and ignore it for now.
  password: transformUnsupportedTypeFiledValue,
}
