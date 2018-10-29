const {
  createNodeFactory,
  generateNodeId
} = require("gatsby-node-helpers").default({
  typePrefix: "Cockpit"
});

module.exports = class CollectionItemNodeFactory {
  constructor(createNode, collectionName) {
    this.createNode = createNode;
    this.collectionName = collectionName;
  }

  create(collectionItem) {
    this.createNode(
      createNodeFactory(this.collectionName, node => {
        node.id = generateNodeId(
          this.collectionName,
          node.lang === "any"
            ? node.cockpitId
            : `${node.cockpitId}_${node.lang}`
        );
        linkImageFieldsToImageNodes(node);
        linkAssetFieldsToAssetNodes(node);
        linkMarkdownFieldsToMarkdownNodes(node);
        linkCollectionLinkFieldsToCollectionItemNodes(node);

        return node;
      })(collectionItem)
    );
  }
};

const linkImageFieldsToImageNodes = node => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];
    if (field.type === "image") {
      field.value___NODE = generateNodeId("Image", field.value.cockpitId);
      delete field.value;
    }
  });
};

const linkAssetFieldsToAssetNodes = node => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];

    if (field.type === "asset") {
      field.value___NODE = generateNodeId("Asset", field.value.cockpitId);
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

const linkMarkdownFieldsToMarkdownNodes = node => {
  Object.keys(node).forEach(fieldName => {
    const field = node[fieldName];

    if (field.type === "markdown") {
      field.value___NODE = generateNodeId("Markdown", field.value.cockpitId);
      delete field.value;
    }
  });
};
