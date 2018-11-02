const fs = require("fs");
const path = require("path");

const CockpitService = require("./src/CockpitService");
const CollectionItemNodeFactory = require("./src/CollectionItemNodeFactory");
const {
  MARKDOWN_IMAGE_REGEXP_GLOBAL,
  MARKDOWN_ASSET_REGEXP_GLOBAL
} = require("./src/constants");
const FileNodeFactory = require("./src/FileNodeFactory");
const MarkdownNodeFactory = require("./src/MarkdownNodeFactory");

exports.sourceNodes = async ({ actions, cache, store }, configOptions) => {
  const { createNode } = actions;
  const cockpit = new CockpitService(
    configOptions.baseUrl,
    configOptions.token,
    configOptions.locales
  );
  const fileNodeFactory = new FileNodeFactory(createNode, store, cache);
  const markdownNodeFactory = new MarkdownNodeFactory(createNode);

  await cockpit.validateBaseUrl();
  await cockpit.validateToken();

  const collections = await cockpit.getCollections();
  const images = await cockpit.normalizeCollectionsImages(collections);
  const assets = await cockpit.normalizeCollectionsAssets(collections);
  const markdowns = await cockpit.normalizeCollectionsMarkdowns(
    collections,
    images,
    assets
  );

  for (let index = 0; index < images.length; index++) {
    const imageNode = await fileNodeFactory.createImageNode(images[index]);
    images[index].localPath = copyFileToStaticFolder(imageNode);
  }

  for (let index = 0; index < assets.length; index++) {
    const assetNode = await fileNodeFactory.createAssetNode(assets[index]);
    assets[index].localPath = copyFileToStaticFolder(assetNode);
  }

  markdowns.forEach(markdown => {
    updateImagePathsWithLocalPaths(markdown, images);
    updateAssetPathsWithLocalPaths(markdown, assets);
    markdownNodeFactory.create(markdown);
  });

  collections.forEach(collection => {
    const nodeFactory = new CollectionItemNodeFactory(
      createNode,
      collection.name
    );

    collection.items.forEach(item => {
      nodeFactory.create(item);
    });
  });
};

const copyFileToStaticFolder = ({ absolutePath, name, ext, internal }) => {
  const localPath = path.join(
    "/",
    "static",
    `${name}-${internal.contentDigest}${ext}`
  );

  fs.copyFileSync(absolutePath, path.join(process.cwd(), "public", localPath));

  return localPath;
};

const updateImagePathsWithLocalPaths = (markdown, images) => {
  markdown.raw = markdown.raw.replace(
    MARKDOWN_IMAGE_REGEXP_GLOBAL,
    (...match) =>
      match[0].replace(
        match[1],
        images.filter(image => image.path === match[1])[0].localPath
      )
  );
};

const updateAssetPathsWithLocalPaths = (markdown, assets) => {
  markdown.raw = markdown.raw.replace(
    MARKDOWN_ASSET_REGEXP_GLOBAL,
    (...match) => {
      const matchingAsset = assets.filter(asset => asset.path === match[1])[0];

      if (matchingAsset) {
        return match[0].replace(match[1], matchingAsset.localPath);
      }

      return match[0];
    }
  );
};
