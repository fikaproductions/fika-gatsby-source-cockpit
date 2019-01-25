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
  }

  create(collectionItem) {
    const children = collectionItem.hasOwnProperty('children')
      ? collectionItem.children.map(childItem => {
        return this.create(childItem);
      })
      : [];
    delete collectionItem.children;

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
   * @param type
   * @param value
   * @returns [ string, mixed] tuple of new field name and new field value
   */
  processField(fieldName, { type, value }) {
    // switch type, assign value
    console.log(`${fieldName}: assigning value of ${type}`);

    switch (type) {
      case 'text': case 'boolean': case 'code': case 'color': case 'colortag':
      case 'rating': case 'location': case 'select': case 'time':
        return [fieldName, value];

      case 'multipleselect':
        // TODO: check if we need to do something (e.g. split values, ...)
        return [fieldName, value];

      case 'date':
        // TODO: check if we can parse it or store it in some other way than just a string
        return [fieldName, value];

      case 'access-list': case 'account-link':
        console.warn(`Field type '${type}' is currently not supported by @fika/gatsby-source-cockpit`);
        return [fieldName, null];

      case 'password':
        // I cannot think of a use case for sending the password to gatsby so I am not implementing this for now.
        console.warn(`Field type '${type}' is currently not supported by @fika/gatsby-source-cockpit`);
        return [fieldName, null];

      case 'asset':
        return this.processAssetField(fieldName, value);

      case 'file':
        // TODO: deal with file
        return [fieldName, null];

      case 'image':
        return this.processImageField(fieldName, value);

      case 'gallery':
        // TODO: deal with gallery
        return [fieldName, null];

      case 'layout': case 'layout-grid':
        // TODO: deal with layout & layout-grid
        return [fieldName, null];

      case 'object':
        // TODO: deal with object
        return [fieldName, null];

      case 'html': case 'wysiwyg': case 'textarea':
        // TODO: parse HTML, Strip Tags, ... (See handling layout fields for more info)
        return [fieldName, value];

      case 'markdown':
        // TODO: implement markdown field
        return [fieldName, value];

      case 'collectionlink':
        // TODO: deal with collectionlinks
        return [fieldName, null];

      case 'repeater':
        // TODO: Implement support for repeater
        return [fieldName, []];

      case 'tags':
        // TODO: Implement support for tags
        return [fieldName, []];

      case 'set':
        // TODO: Implement support for set
        return [fieldName, {}];

      default:
        console.warn(`Unknown field type '${type}' found - skipping field.`);
        return [fieldName, null];
    }
  }

  processAssetField(fieldName, value) {
    if (this.assets.hasOwnProperty(value)) {
      return [`${fieldName}___NODE`, this.assets[value].id];
    }
    return [fieldName, null];
  }

  processImageField(fieldName, value) {
    if (this.images.hasOwnProperty(value)) {
      return [`${fieldName}___NODE`, this.images[value].id];
    }
    return [fieldName, null];
  }
}

const generateNodeIdFromItem = (item) => {
  return generateNodeId(
    this.collectionName,
    item.lang === "any"
      ? item.cockpitId
      : `${item.cockpitId}_${item.lang}`
  )
}

const linkImageFieldsToImageNodes = (node, images) => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];

    if (field.type === "image") {
      field.value___NODE = images[field.value].id;
      delete field.value;
    } else if (field.type === "gallery") {
      if (Array.isArray(field.value)) {
        field.value___NODE = field.value.map(
          imageField => images[imageField.value].id
        );
      }
      delete field.value;
    }
  });
};



const linkMarkdownFieldsToMarkdownNodes = (node, markdowns) => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];

    if (field.type === "markdown") {
      field.value___NODE = markdowns[field.value].id;
      delete field.value;
    }
  });
};

const linkCollectionLinkFieldsToCollectionItemNodes = node => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];

    if (field.type === "collectionlink") {
      if (Array.isArray(field.value)) {
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
        field.value___NODE = generateNodeId(
          field.value.link,
          node.lang === "any"
            ? field.value._id
            : `${field.value._id}_${node.lang}`
        );
      }

      delete field.value;
    }
  });
};

const linkChildrenToParent = (node, children) => {

  if (Array.isArray(children) && children.length > 0) {
    node.children___NODE = children.map(child => child.id);
    children.forEach(child => {
      child.parent___NODE = node.id;
    });
    delete node.children;
  }
};
