const mime = require('mime')
const request = require('request-promise')
const getFieldsOfTypes = require('./helpers.js').getFieldsOfTypes
const slugify = require('slugify')

const {
  METHODS,
  MARKDOWN_IMAGE_REGEXP,
  MARKDOWN_ASSET_REGEXP,
} = require('./constants')

module.exports = class CockpitService {
  constructor(baseUrl, token, locales, whiteListedCollectionNames = []) {
    this.baseUrl = baseUrl
    this.token = token
    this.locales = locales
    this.whiteListedCollectionNames = whiteListedCollectionNames
  }

  async fetch(endpoint, method, lang = null) {
    return request({
      uri: `${this.baseUrl}/api${endpoint}?token=${this.token}${
        lang ? `&lang=${lang}` : ''
      }`,
      method,
      json: true,
    })
  }

  async validateBaseUrl() {
    try {
      await this.fetch('', METHODS.GET)
    } catch (error) {
      throw new Error(
        'BaseUrl config parameter is invalid or there is no internet connection'
      )
    }
  }

  async validateToken() {
    try {
      await this.fetch('/collections/listCollections', METHODS.GET)
    } catch (error) {
      throw new Error('Token config parameter is invalid')
    }
  }

  async getCollectionNames() {
    return this.fetch('/collections/listCollections', METHODS.GET)
  }

  async getCollection(name) {
    const { fields: collectionFields, entries } = await this.fetch(
      `/collections/get/${name}`,
      METHODS.GET
    )

    const items = entries.map(entry =>
      createCollectionItem(name, collectionFields, entry)
    )

    for (let index = 0; index < this.locales.length; index++) {
      const { fields: collectionFields, entries } = await this.fetch(
        `/collections/get/${name}`,
        METHODS.GET,
        this.locales[index]
      )

      items.push(
        ...entries.map(entry =>
          createCollectionItem(
            name,
            collectionFields,
            entry,
            this.locales[index]
          )
        )
      )
    }

    return { items, name }
  }

  async getCollections() {
    const names = await this.getCollectionNames()
    const whiteListedNames = this.whiteListedCollectionNames

    return Promise.all(
      names
        .filter(
          name =>
            whiteListedNames === null ||
            (Array.isArray(whiteListedNames) &&
              whiteListedNames.length === 0) ||
            whiteListedNames.includes(name)
        )
        .map(name => this.getCollection(name))
    )
  }

  normalizeResources(collections) {
    const existingImages = {}
    const existingAssets = {}
    const existingMarkdowns = {}

    collections.forEach(collection => {
      collection.items.forEach(item => {
        this.normalizeCollectionItemImages(item, existingImages)
        this.normalizeCollectionItemAssets(item, existingAssets)
        this.normalizeCollectionItemMarkdowns(
          item,
          existingImages,
          existingAssets,
          existingMarkdowns
        )
      })
    })

    return {
      images: existingImages,
      assets: existingAssets,
      markdowns: existingMarkdowns,
    }
  }

  normalizeCollectionItemImages(item, existingImages) {
    getFieldsOfTypes(item, ['image', 'gallery']).forEach(field => {
      if (!Array.isArray(field.value)) {
        const imageField = field
        let path = imageField.value.path

        if (path == null) {
          return
        }

        if (path.startsWith('/')) {
          path = `${this.baseUrl}${path}`
        } else if (!path.startsWith('http')) {
          path = `${this.baseUrl}/${path}`
        }

        imageField.value = path
        existingImages[path] = null
      } else {
        const galleryField = field

        galleryField.value.forEach(galleryImageField => {
          let path = galleryImageField.path

          if (path == null) {
            return
          }

          trimGalleryImageField(galleryImageField)

          if (path.startsWith('/')) {
            path = `${this.baseUrl}${path}`
          } else {
            path = `${this.baseUrl}/${path}`
          }

          galleryImageField.value = path
          existingImages[path] = null
        })
      }
    })

    // Check the child items of the collection for any images
    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeCollectionItemImages(child, existingImages)
      })
    }
  }

  normalizeCollectionItemAssets(item, existingAssets) {
    getFieldsOfTypes(item, ['asset']).forEach(assetField => {
      let path = assetField.value.path

      trimAssetField(assetField)

      path = `${this.baseUrl}/storage/uploads${path}`

      assetField.value = path
      existingAssets[path] = null
    })

    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeCollectionItemAssets(child, existingAssets)
      })
    }
  }

  normalizeCollectionItemMarkdowns(
    item,
    existingImages,
    existingAssets,
    existingMarkdowns
  ) {
    getFieldsOfTypes(item, ['markdown']).forEach(markdownField => {
      existingMarkdowns[markdownField.value] = null
      extractImagesFromMarkdown(markdownField.value, existingImages)
      extractAssetsFromMarkdown(markdownField.value, existingAssets)
    })

    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeCollectionItemMarkdowns(
          child,
          existingImages,
          existingAssets,
          existingMarkdowns
        )
      })
    }
  }
}

const trimAssetField = assetField => {
  delete assetField.value._id
  delete assetField.value.path
  delete assetField.value.title
  delete assetField.value.mime
  delete assetField.value.size
  delete assetField.value.image
  delete assetField.value.video
  delete assetField.value.audio
  delete assetField.value.archive
  delete assetField.value.document
  delete assetField.value.code
  delete assetField.value.created
  delete assetField.value.modified
  delete assetField.value._by

  Object.keys(assetField.value).forEach(attribute => {
    assetField[attribute] = assetField.value[attribute]
    delete assetField.value[attribute]
  })
}

const trimGalleryImageField = galleryImageField => {
  galleryImageField.type = 'image'

  delete galleryImageField.meta.asset
  delete galleryImageField.path
}

const createCollectionItem = (
  collectionName,
  collectionFields,
  collectionEntry,
  locale = null,
  level = 1
) => {
  const item = {
    cockpitId: collectionEntry._id,
    lang: locale == null ? 'any' : locale,
    level: level,
  }

  Object.keys(collectionFields).reduce((accumulator, collectionFieldName) => {
    const collectionFieldValue = collectionEntry[collectionFieldName]
    const collectionFieldConfiguration = collectionFields[collectionFieldName]
    const field = createCollectionField(
      collectionName,
      collectionFieldValue,
      collectionFieldConfiguration
    )

    if (field !== null) {
      accumulator[collectionFieldName] = field
    }

    return accumulator
  }, item)

  if (collectionEntry.hasOwnProperty('children')) {
    item.children = collectionEntry.children.map(childEntry => {
      return createCollectionItem(
        collectionFields,
        childEntry,
        locale,
        level + 1
      )
    })
  }

  return item
}

const createCollectionField = (
  collectionName,
  collectionFieldValue,
  collectionFieldConfiguration
) => {
  const collectionFieldType = collectionFieldConfiguration.type

  if (
    !(
      Array.isArray(collectionFieldValue) && collectionFieldValue.length === 0
    ) &&
    collectionFieldValue != null &&
    collectionFieldValue !== ''
  ) {
    const itemField = {
      type: collectionFieldType,
    }

    if (collectionFieldType === 'repeater') {
      const repeaterFieldOptions = collectionFieldConfiguration.options || {}

      if (typeof repeaterFieldOptions.field !== 'undefined') {
        itemField.value = collectionFieldValue.map(repeaterEntry =>
          createCollectionField(
            collectionName,
            repeaterEntry.value,
            repeaterFieldOptions.field
          )
        )
      } else if (typeof repeaterFieldOptions.fields !== 'undefined') {
        itemField.value = collectionFieldValue.map(repeaterEntry =>
          repeaterFieldOptions.fields.reduce(
            (accumulator, currentFieldConfiguration) => {
              if (
                typeof currentFieldConfiguration.name === 'undefined' &&
                currentFieldConfiguration.label === repeaterEntry.field.label
              ) {
                const generatedNameProperty = slugify(
                  currentFieldConfiguration.label,
                  { lower: true }
                )
                console.warn(
                  `\nRepeater field without 'name' attribute used in collection '${collectionName}'. ` +
                    `Using value '${generatedNameProperty}' for name (generated from the label).`
                )
                currentFieldConfiguration.name = generatedNameProperty
                repeaterEntry.field.name = generatedNameProperty
              }

              if (currentFieldConfiguration.name === repeaterEntry.field.name) {
                accumulator.valueType = currentFieldConfiguration.name
                accumulator.value[
                  currentFieldConfiguration.name
                ] = createCollectionField(
                  collectionName,
                  repeaterEntry.value,
                  currentFieldConfiguration
                )
              }

              return accumulator
            },
            { type: 'set', value: {} }
          )
        )
      }
    } else if (collectionFieldType === 'set') {
      const setFieldOptions = collectionFieldConfiguration.options || {}

      itemField.value = setFieldOptions.fields.reduce(
        (accumulator, currentFieldConfiguration) => {
          const currentFieldName = currentFieldConfiguration.name
          accumulator[currentFieldName] = createCollectionField(
            collectionName,
            collectionFieldValue[currentFieldName],
            currentFieldConfiguration
          )

          return accumulator
        },
        {}
      )
    } else {
      itemField.value = collectionFieldValue
    }

    return itemField
  }

  return null
}

const extractImagesFromMarkdown = (markdown, existingImages) => {
  let unparsedMarkdown = markdown
  let match

  while ((match = MARKDOWN_IMAGE_REGEXP.exec(unparsedMarkdown))) {
    unparsedMarkdown = unparsedMarkdown.substring(match.index + match[0].length)
    existingImages[match[1]] = null
  }
}

const extractAssetsFromMarkdown = (markdown, existingAssets) => {
  let unparsedMarkdown = markdown
  let match

  while ((match = MARKDOWN_ASSET_REGEXP.exec(unparsedMarkdown))) {
    unparsedMarkdown = unparsedMarkdown.substring(match.index + match[0].length)
    const mediaType = mime.getType(match[1])

    if (mediaType && mediaType !== 'text/html') {
      existingAssets[match[1]] = null
    }
  }
}
