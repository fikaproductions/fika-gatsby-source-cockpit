const {
  createNodeFactory,
  generateNodeId
} = require("gatsby-node-helpers").default({
  typePrefix: "Cockpit"
});
const { createRemoteFileNode } = require("gatsby-source-filesystem");

module.exports = class FileNodeFactory {
  constructor(createNode, store, cache) {
    this.createNode = createNode;
    this.store = store;
    this.cache = cache;
  }

  async createImageNode(image) {
    return createRemoteFileNode({
      url: image.path,
      store: this.store,
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId("Image", image.id)
    });
  }

  async createAssetNode(asset) {
    return createRemoteFileNode({
      url: asset.path,
      store: this.store,
      cache: this.cache,
      createNode: this.createNode,
      createNodeId: () => generateNodeId("Asset", asset.id)
    });
  }
};
