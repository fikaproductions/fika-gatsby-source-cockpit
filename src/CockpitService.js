const mime = require("mime");
const request = require("request-promise");

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

  normalizeCollectionsImages(collections, existingImages = {}) {

    collections.forEach(collection => {
      collection.items.forEach(item => {
        this.normalizeCollectionItemImages(item, existingImages);
      });
    });

    return existingImages;
  }

  normalizeCollectionItemImages(item, existingImages) {
        Object.keys(item)
          .filter(
            fieldName =>
              item[fieldName].type === "image" ||
              item[fieldName].type === "gallery"
          )
          .forEach(fieldName => {
            if (!Array.isArray(item[fieldName].value)) {
              const imageField = item[fieldName];
              let path = imageField.value.path;

              if (path == null) {
                return;
              }

              trimAssetField(imageField);

              if (path.startsWith("/")) {
                path = `${this.baseUrl}${path}`;
              } else if (!path.startsWith("http")) {
                path = `${this.baseUrl}/${path}`;
              }

              imageField.value = path;
          	  existingImages[path] = null;
            } else {
              const galleryField = item[fieldName];

              galleryField.value.forEach(galleryImageField => {
                let path = galleryImageField.path;

                if (path == null) {
                  return;
                }

                trimGalleryImageField(galleryImageField);

                if (path.startsWith("/")) {
                  path = `${this.baseUrl}${path}`;
                } else {
                  path = `${this.baseUrl}/${path}`;
                }

                galleryImageField.value = path;
                existingImages[path] = null;
              });
            }
          });

    // Check the child items of the collection for any images
    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeCollectionItemImages(child, existingImages);
      })
  }
  }


  normalizeCollectionsAssets(collections, existingAssets = {}) {

    collections.forEach(collection => {
      collection.items.forEach(item => {
        this.normalizeCollectionItemAssets(item, existingAssets);
      });
    });

    return existingAssets;
  }

  normalizeCollectionItemAssets(item, existingAssets) {
        Object.keys(item)
          .filter(fieldName => item[fieldName].type === "asset")
          .forEach(fieldName => {
            const assetField = item[fieldName];
            let path = assetField.value.path;

            trimAssetField(assetField);

            path = `${this.baseUrl}/storage/uploads${path}`;

            assetField.value = path;
        existingAssets[path] = null;
          });

    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeCollectionItemAssets(child, existingAssets);
      })
    }
  }

  normalizeCollectionsMarkdowns(collections, existingImages, existingAssets, existingMarkdowns = {}) {
    collections.forEach(collection => {
      collection.items.forEach(item => {
        this.normalizeCollectionItemMarkdowns(item, existingImages, existingAssets, existingMarkdowns);
      });
    });

    return existingMarkdowns;
  }

  normalizeCollectionItemMarkdowns(item, existingImages, existingAssets, existingMarkdowns) {
        Object.keys(item)
          .filter(fieldName => item[fieldName].type === "markdown")
          .forEach(fieldName => {
            const markdownField = item[fieldName];

        existingMarkdowns[markdownField.value] = null;
            extractImagesFromMarkdown(markdownField.value, existingImages);
            extractAssetsFromMarkdown(markdownField.value, existingAssets);
          });

    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeCollectionItemMarkdowns(child, existingImages, existingAssets, existingMarkdowns);
      })
    }
  }
};

const trimAssetField = assetField => {
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
    assetField[attribute] = assetField.value[attribute];
    delete assetField.value[attribute];
  });
};

const trimGalleryImageField = galleryImageField => {
  galleryImageField.type = "image";

  delete galleryImageField.meta.asset;
  delete galleryImageField.path;
};

const createCollectionItem = (
  collectionFields,
  collectionEntry,
  locale = null,
  level = 1
) => {
  const item = {
    cockpitId: collectionEntry._id,
    lang: locale == null ? "any" : locale,
    level: level,
  };

  Object.keys(collectionFields).forEach(collectionFieldName => {
    if (
      !(
        Array.isArray(collectionEntry[collectionFieldName]) &&
        collectionEntry[collectionFieldName].length === 0
      ) &&
      collectionEntry[collectionFieldName] != null &&
      collectionEntry[collectionFieldName] !== ''
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

  if (collectionEntry.hasOwnProperty('children')) {
    item.children = collectionEntry.children.map((childEntry) => {
      return createCollectionItem(collectionFields, childEntry, locale, level + 1);
    });
  }

  return item;
};

const extractImagesFromMarkdown = (markdown, existingImages) => {
  let unparsedMarkdown = markdown;
  let match;

  while ((match = MARKDOWN_IMAGE_REGEXP.exec(unparsedMarkdown))) {
    unparsedMarkdown = unparsedMarkdown.substring(
      match.index + match[0].length
    );
    existingImages[match[1]] = null;
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

    if (mediaType && mediaType !== "text/html") {
      existingAssets[match[1]] = null;
    }
  }
};
