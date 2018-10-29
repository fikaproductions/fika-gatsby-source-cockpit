const mime = require("mime");
const request = require("request-promise");
const hash = require("string-hash");

const {
  METHODS,
  MARKDOWN_IMAGE_REGEXP,
  MARKDOWN_ASSET_REGEXP
} = require("./constants");

module.exports = class CockpitService {
  constructor(baseUrl, token, locales) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.locales = locales;
  }

  async fetch(endpoint, method, lang = null) {
    return request({
      uri: `${this.baseUrl}/api${endpoint}?token=${this.token}${
        lang ? `&lang=${lang}` : ""
      }`,
      method,
      json: true
    });
  }

  async validateBaseUrl() {
    try {
      await this.fetch("", METHODS.GET);
    } catch (error) {
      throw new Error(
        "BaseUrl config parameter is invalid or there is no internet connection"
      );
    }
  }

  async validateToken() {
    try {
      await this.fetch("/collections/listCollections", METHODS.GET);
    } catch (error) {
      throw new Error("Token config parameter is invalid");
    }
  }

  async getCollectionNames() {
    return this.fetch("/collections/listCollections", METHODS.GET);
  }

  async getCollection(name) {
    const { fields: collectionFields, entries } = await this.fetch(
      `/collections/get/${name}`,
      METHODS.GET
    );

    const items = entries.map(entry =>
      createCollectionItem(collectionFields, entry)
    );

    for (let index = 0; index < this.locales.length; index++) {
      const { fields: collectionFields, entries } = await this.fetch(
        `/collections/get/${name}`,
        METHODS.GET,
        this.locales[index]
      );

      items.push(
        ...entries.map(entry =>
          createCollectionItem(collectionFields, entry, this.locales[index])
        )
      );
    }

    return { items, name };
  }

  async getCollections() {
    const names = await this.getCollectionNames();

    return Promise.all(names.map(name => this.getCollection(name)));
  }

  normalizeCollectionsImages(collections) {
    const images = [];

    collections.forEach(collection => {
      collection.items.forEach(item => {
        Object.keys(item)
          .filter(fieldName => item[fieldName].type === "image")
          .forEach(fieldName => {
            const imageField = item[fieldName];
            let path = imageField.value.path;

            if (path) {
              trimAssetField(imageField);

              if (path.startsWith("/")) {
                path = `${this.baseUrl}${path}`;
              }

              if (images.filter(image => image.path === path).length === 0) {
                images.push({ path, id: imageField.value.cockpitId });
              }
            }
          });
      });
    });

    return images;
  }

  normalizeCollectionsAssets(collections) {
    const assets = [];

    collections.forEach(collection => {
      collection.items.forEach(item => {
        Object.keys(item)
          .filter(fieldName => item[fieldName].type === "asset")
          .forEach(fieldName => {
            const assetField = item[fieldName];
            let path = assetField.value.path;

            if (path) {
              trimAssetField(assetField);

              path = `${this.baseUrl}/storage/uploads${path}`;

              if (assets.filter(asset => asset.path === path).length === 0) {
                assets.push({ path, id: assetField.value.cockpitId });
              }
            }
          });
      });
    });

    return assets;
  }

  normalizeCollectionsMarkdowns(collections, existingImages, existingAssets) {
    const markdowns = [];

    collections.forEach(collection => {
      collection.items.forEach(item => {
        Object.keys(item)
          .filter(fieldName => item[fieldName].type === "markdown")
          .forEach(fieldName => {
            const markdownField = item[fieldName];
            const id = hash(markdownField.value);

            if (markdowns.filter(markdown => markdown.id === id).length === 0) {
              markdowns.push({ raw: markdownField.value, id });
              extractImagesFromMarkdown(markdownField.value, existingImages);
              extractAssetsFromMarkdown(markdownField.value, existingAssets);
            }

            markdownField.value = { cockpitId: id };
          });
      });
    });

    return markdowns;
  }
};

const trimAssetField = assetField => {
  assetField.value.cockpitId =
    assetField.value._id || `${hash(assetField.value.path)}`;

  delete assetField.value._id;
  delete assetField.value.path;
  delete assetField.value.title;
  delete assetField.value.mime;
  delete assetField.value.size;
  delete assetField.value.image;
  delete assetField.value.video;
  delete assetField.value.audio;
  delete assetField.value.archive;
  delete assetField.value.document;
  delete assetField.value.code;
  delete assetField.value.created;
  delete assetField.value.modified;
  delete assetField.value._by;

  Object.keys(assetField.value).forEach(attribute => {
    if (attribute !== "cockpitId") {
      assetField[attribute] = assetField.value[attribute];
      delete assetField.value[attribute];
    }
  });
};

const createCollectionItem = (
  collectionFields,
  collectionEntry,
  locale = null
) => {
  const item = {
    cockpitId: collectionEntry._id,
    lang: locale == null ? "any" : locale
  };

  Object.keys(collectionFields).forEach(collectionFieldName => {
    if (
      !(
        Array.isArray(collectionEntry[collectionFieldName]) &&
        collectionEntry[collectionFieldName].length === 0
      ) &&
      collectionEntry[collectionFieldName] != null
    ) {
      const itemField = {
        ...collectionFields[collectionFieldName],
        value: collectionEntry[collectionFieldName]
      };
      delete itemField.name;
      delete itemField.localize;
      delete itemField.options;
      item[collectionFieldName] = itemField;
    }
  });

  return item;
};

const extractImagesFromMarkdown = (markdown, existingImages) => {
  let unparsedMarkdown = markdown;
  let match;

  while ((match = MARKDOWN_IMAGE_REGEXP.exec(unparsedMarkdown))) {
    unparsedMarkdown = unparsedMarkdown.substring(
      match.index + match[0].length
    );

    if (existingImages.filter(image => image.path === match[1]).length === 0) {
      existingImages.push({
        path: match[1],
        id: `${hash(match[1])}`
      });
    }
  }
};

const extractAssetsFromMarkdown = (markdown, existingAssets) => {
  let unparsedMarkdown = markdown;
  let match;

  while ((match = MARKDOWN_ASSET_REGEXP.exec(unparsedMarkdown))) {
    unparsedMarkdown = unparsedMarkdown.substring(
      match.index + match[0].length
    );
    const mediaType = mime.getType(match[1]);

    if (
      mediaType &&
      mediaType !== "text/html" &&
      existingAssets.filter(asset => asset.path === match[1]).length === 0
    ) {
      existingAssets.push({ path: match[1], id: `${hash(match[1])}` });
    }
  }
};
