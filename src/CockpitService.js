const mime = require('mime')
const request = require('request-promise')
const slugify = require('slugify')
const hash = require('string-hash')

const {
  METHODS,
  MARKDOWN_IMAGE_REGEXP,
  MARKDOWN_ASSET_REGEXP,
  INVALID_BASE_URL,
  INVALID_TOKEN,
  INVALID_LOCALES,
  INVALID_WHITE_LISTED_COLLECTION_NAMES,
  INVALID_WHITE_LISTED_SINGLETON_NAMES,
  INVALID_ALIASES,
} = require('./constants')
const getFieldsOfTypes = require('./helpers.js').getFieldsOfTypes

module.exports = class CockpitService {
  constructor(
    baseUrl,
    token,
    locales,
    whiteListedCollectionNames = [],
    whiteListedSingletonNames = [],
    aliases = {}
  ) {
    if (typeof baseUrl !== 'string') {
      throw new TypeError(INVALID_BASE_URL)
    }

    if (typeof token !== 'string') {
      throw new TypeError(INVALID_TOKEN)
    }

    if (!Array.isArray(locales)) {
      throw new TypeError(INVALID_LOCALES)
    }

    if (
      whiteListedCollectionNames !== null &&
      !Array.isArray(whiteListedCollectionNames)
    ) {
      throw new TypeError(INVALID_WHITE_LISTED_COLLECTION_NAMES)
    }

    if (
      whiteListedSingletonNames !== null &&
      !Array.isArray(whiteListedSingletonNames)
    ) {
      throw new TypeError(INVALID_WHITE_LISTED_SINGLETON_NAMES)
    }

    if (typeof aliases !== 'object') {
      throw new TypeError(INVALID_ALIASES)
    }

    this.baseUrl = baseUrl
    this.token = token
    this.locales = locales
    this.whiteListedCollectionNames = whiteListedCollectionNames
    this.whiteListedSingletonNames = whiteListedSingletonNames
    this.aliases = aliases
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

  async getSingletonNames() {
    return this.fetch('/singletons/listSingletons', METHODS.GET)
  }

  async getCollection(name) {
    const {
      fields: collectionFields,
      entries: collectionEntries,
    } = await this.fetch(`/collections/get/${name}`, METHODS.GET)

    const collectionItems = collectionEntries.map(collectionEntry =>
      createCollectionItem(name, collectionFields, collectionEntry)
    )

    for (let index = 0; index < this.locales.length; index++) {
      const {
        fields: collectionFields,
        entries: collectionEntries,
      } = await this.fetch(
        `/collections/get/${name}`,
        METHODS.GET,
        this.locales[index]
      )

      collectionItems.push(
        ...collectionEntries.map(collectionEntry =>
          createCollectionItem(
            name,
            collectionFields,
            collectionEntry,
            this.locales[index]
          )
        )
      )
    }

    const officialName =
      (this.aliases['collection'] && this.aliases['collection'][name]) || name

    return { items: collectionItems, name: officialName }
  }

  async getSingleton(name) {
    const singletonEntry = await this.fetch(
      `/singletons/get/${name}`,
      METHODS.GET
    )

    const singletonDescriptor = await this.fetch(
      `/singletons/singleton/${name}`,
      METHODS.GET
    )

    const singletonItems = [
      createSingletonItem(singletonDescriptor, singletonEntry),
    ]

    for (let index = 0; index < this.locales.length; index++) {
      const singletonEntry = await this.fetch(
        `/singletons/get/${name}`,
        METHODS.GET,
        this.locales[index]
      )

      singletonItems.push(
        createSingletonItem(
          singletonDescriptor,
          singletonEntry,
          this.locales[index]
        )
      )
    }

    const officialName =
      (this.aliases['singleton'] && this.aliases['singleton'][name]) || name

    return { items: singletonItems, name: officialName }
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

  async getSingletons() {
    const names = await this.getSingletonNames()
    const whiteListedNames = this.whiteListedSingletonNames

    return Promise.all(
      names
        .filter(
          name =>
            whiteListedNames === null ||
            (Array.isArray(whiteListedNames) &&
              whiteListedNames.length === 0) ||
            whiteListedNames.includes(name)
        )
        .map(name => this.getSingleton(name))
    )
  }

  normalizeResources(nodes) {
    const existingImages = {}
    const existingAssets = {}
    const existingMarkdowns = {}
    const existingLayouts = {}

    nodes.forEach(node => {
      node.items.forEach(item => {
        this.normalizeNodeItemImages(item, existingImages)
        this.normalizeNodeItemAssets(item, existingAssets)
        this.normalizeNodeItemMarkdowns(
          item,
          existingImages,
          existingAssets,
          existingMarkdowns
        )
        this.normalizeNodeItemLayouts(
          item,
          existingImages,
          existingAssets,
          existingMarkdowns,
          existingLayouts
        )
      })
    })

    return {
      images: existingImages,
      assets: existingAssets,
      markdowns: existingMarkdowns,
      layouts: existingLayouts,
    }
  }

  normalizeNodeItemImages(item, existingImages) {
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
          } else if (!path.startsWith('http')) {
            path = `${this.baseUrl}/${path}`
          }

          galleryImageField.value = path
          existingImages[path] = null
        })
      }
    })

    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeNodeItemImages(child, existingImages)
      })
    }
  }

  normalizeNodeItemAssets(item, existingAssets) {
    getFieldsOfTypes(item, ['asset']).forEach(assetField => {
      let path = assetField.value.path

      trimAssetField(assetField)

      path = `${this.baseUrl}/storage/uploads${path}`

      assetField.value = path
      existingAssets[path] = null
    })

    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeNodeItemAssets(child, existingAssets)
      })
    }
  }

  normalizeNodeItemMarkdowns(
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
        this.normalizeNodeItemMarkdowns(
          child,
          existingImages,
          existingAssets,
          existingMarkdowns
        )
      })
    }
  }

  normalizeNodeItemLayouts(
    item,
    existingImages,
    existingAssets,
    existingMarkdowns,
    existingLayouts
  ) {
    getFieldsOfTypes(item, ['layout', 'layout-grid']).forEach(layoutField => {
      const stringifiedLayout = JSON.stringify(layoutField.value)
      const layoutHash = hash(stringifiedLayout)
      existingLayouts[layoutHash] = layoutField.value
      // TODO: this still needs to be implemented for layout fields
      // extractImagesFromMarkdown(markdownField.value, existingImages)
      // extractAssetsFromMarkdown(markdownField.value, existingAssets)
    })

    if (Array.isArray(item.children)) {
      item.children.forEach(child => {
        this.normalizeNodeItemLayouts(
          child,
          existingImages,
          existingAssets,
          existingMarkdowns,
          existingLayouts
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
    cockpitCreated: new Date(collectionEntry._created * 1000),
    cockpitModified: new Date(collectionEntry._modified * 1000),
    // TODO: Replace with Users... once implemented (GitHub Issue #15)
    cockpitBy: collectionEntry._by,
    cockpitModifiedBy: collectionEntry._mby,
    lang: locale == null ? 'any' : locale,
    level: level,
  }

  Object.keys(collectionFields).reduce((accumulator, collectionFieldName) => {
    const collectionFieldValue = collectionEntry[collectionFieldName]
    const collectionFieldConfiguration = collectionFields[collectionFieldName]
    const collectionFieldSlug = collectionEntry[`${collectionFieldName}_slug`]
    const field = createNodeField(
      'collection',
      collectionName,
      collectionFieldValue,
      collectionFieldConfiguration,
      collectionFieldSlug
    )

    if (field !== null) {
      accumulator[collectionFieldName] = field
    }

    return accumulator
  }, item)

  if (collectionEntry.hasOwnProperty('children')) {
    item.children = collectionEntry.children.map(childEntry => {
      return createCollectionItem(
        collectionName,
        collectionFields,
        childEntry,
        locale,
        level + 1
      )
    })
  }

  return item
}

const createSingletonItem = (
  singletonDescriptor,
  singletonEntry,
  locale = null
) => {
  const item = {
    cockpitId: singletonDescriptor._id,
    cockpitCreated: new Date(singletonDescriptor._created * 1000),
    cockpitModified: new Date(singletonDescriptor._modified * 1000),
    // TODO: Replace with Users... once implemented (GitHub Issue #15)
    cockpitBy: singletonEntry._by,
    cockpitModifiedBy: singletonEntry._mby,
    lang: locale == null ? 'any' : locale,
  }

  singletonDescriptor.fields.reduce(
    (accumulator, singletonFieldConfiguration) => {
      const singletonFieldValue =
        singletonEntry[singletonFieldConfiguration.name]
      const singletonFieldSlug =
        singletonEntry[`${singletonFieldConfiguration.name}_slug`]
      const field = createNodeField(
        'singleton',
        singletonDescriptor.name,
        singletonFieldValue,
        singletonFieldConfiguration,
        singletonFieldSlug
      )

      if (field !== null) {
        accumulator[singletonFieldConfiguration.name] = field
      }

      return accumulator
    },
    item
  )

  return item
}

const createNodeField = (
  nodeType,
  nodeName,
  nodeFieldValue,
  nodeFieldConfiguration,
  nodeFieldSlug
) => {
  const nodeFieldType = nodeFieldConfiguration.type

  if (
    !(Array.isArray(nodeFieldValue) && nodeFieldValue.length === 0) &&
    nodeFieldValue != null &&
    nodeFieldValue !== ''
  ) {
    const itemField = {
      type: nodeFieldType,
    }

    if (nodeFieldType === 'repeater') {
      const repeaterFieldOptions = nodeFieldConfiguration.options || {}

      if (typeof repeaterFieldOptions.field !== 'undefined') {
        itemField.value = nodeFieldValue.map(repeaterEntry =>
          createNodeField(
            nodeType,
            nodeName,
            repeaterEntry.value,
            repeaterFieldOptions.field
          )
        )
      } else if (typeof repeaterFieldOptions.fields !== 'undefined') {
        itemField.value = nodeFieldValue.map(repeaterEntry =>
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
                  `\nRepeater field without 'name' attribute used in ${nodeType} '${nodeName}'. ` +
                    `Using value '${generatedNameProperty}' for name (generated from the label).`
                )
                currentFieldConfiguration.name = generatedNameProperty
                repeaterEntry.field.name = generatedNameProperty
              }

              if (currentFieldConfiguration.name === repeaterEntry.field.name) {
                accumulator.valueType = currentFieldConfiguration.name
                accumulator.value[
                  currentFieldConfiguration.name
                ] = createNodeField(
                  nodeType,
                  nodeName,
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
    } else if (nodeFieldType === 'set') {
      const setFieldOptions = nodeFieldConfiguration.options || {}

      itemField.value = setFieldOptions.fields.reduce(
        (accumulator, currentFieldConfiguration) => {
          const currentFieldName = currentFieldConfiguration.name
          accumulator[currentFieldName] = createNodeField(
            nodeType,
            nodeName,
            nodeFieldValue[currentFieldName],
            currentFieldConfiguration
          )

          return accumulator
        },
        {}
      )
    } else {
      itemField.value = nodeFieldValue

      if (nodeFieldSlug) {
        itemField.slug = nodeFieldSlug
      }
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
