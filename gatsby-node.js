const fs = require('fs')
const path = require('path')

const CockpitService = require('./src/CockpitService')
const CollectionItemNodeFactory = require('./src/CollectionItemNodeFactory')
const SingletonItemNodeFactory = require('./src/SingletonItemNodeFactory')
const {
  MARKDOWN_IMAGE_REGEXP_GLOBAL,
  MARKDOWN_ASSET_REGEXP_GLOBAL,
  TYPE_PREFIX_COCKPIT,
} = require('./src/constants')
const FileNodeFactory = require('./src/FileNodeFactory')
const MarkdownNodeFactory = require('./src/MarkdownNodeFactory')
const LayoutNodeFactory = require('./src/LayoutNodeFactory')

exports.setFieldsOnGraphQLNodeType = require('./extend-node-type')
exports.sourceNodes = async (
  { actions, reporter, cache, store },
  configOptions
) => {
  const { createNode, createParentChildLink } = actions
  const cockpit = new CockpitService(
    configOptions.baseUrl,
    configOptions.token,
    configOptions.locales,
    configOptions.collections,
    configOptions.singletons,
    configOptions.aliases
  )
  const fileNodeFactory = new FileNodeFactory(
    createNode,
    store,
    cache,
    reporter
  )
  const markdownNodeFactory = new MarkdownNodeFactory(createNode)
  const layoutNodeFactory = new LayoutNodeFactory(createNode)

  await cockpit.validateBaseUrl()
  await cockpit.validateToken()

  const collections = await cockpit.getCollections()
  const singletons = await cockpit.getSingletons()
  validateNodeNames(collections, singletons)

  const nodes = [...collections, ...singletons]
  const { images, assets, markdowns, layouts } = cockpit.normalizeResources(
    nodes
  )

  cache.set(TYPE_PREFIX_COCKPIT, nodes)

  const brokenImageReplacement = await createBrokenImagePlaceholder(
    fileNodeFactory,
    configOptions.brokenImageReplacement
  )

  for (let path in images) {
    const imageNode = await fileNodeFactory.createImageNode(path)
    if (imageNode) {
      images[path] = {
        localPath: copyFileToStaticFolder(imageNode),
        id: imageNode.id,
      }
    } else if (brokenImageReplacement) {
      reporter.info('Using broken image replacement for missing image', path)
      images[path] = brokenImageReplacement
    }
  }

  for (let path in assets) {
    const assetNode = await fileNodeFactory.createAssetNode(path)
    assets[path] = {
      localPath: copyFileToStaticFolder(assetNode),
      id: assetNode.id,
    }
  }

  for (let markdown in markdowns) {
    const localMarkdown = updateAssetPathsWithLocalPaths(
      updateImagePathsWithLocalPaths(markdown, images),
      assets
    )
    const id = markdownNodeFactory.create(localMarkdown)
    markdowns[markdown] = { id }
  }

  for (let layout in layouts) {
    const id = layoutNodeFactory.create(layouts[layout])
    layouts[layout] = { id }
  }

  collections.forEach(collection => {
    const nodeFactory = new CollectionItemNodeFactory(
      createNode,
      createParentChildLink,
      collection.name,
      images,
      assets,
      markdowns,
      layouts
    )

    collection.items.forEach(item => {
      nodeFactory.create(item)
    })
  })

  singletons.forEach(singleton => {
    const nodeFactory = new SingletonItemNodeFactory(
      createNode,
      singleton.name,
      images,
      assets,
      markdowns,
      layouts
    )

    singleton.items.forEach(item => {
      nodeFactory.create(item)
    })
  })
}

const copyFileToStaticFolder = ({ absolutePath, name, ext, internal }) => {
  const localPath = path.join(
    '/',
    'static',
    `${name}-${internal.contentDigest}${ext}`
  )

  fs.copyFileSync(absolutePath, path.join(process.cwd(), 'public', localPath))

  return localPath
}

const updateImagePathsWithLocalPaths = (markdown, images) => {
  return markdown.replace(MARKDOWN_IMAGE_REGEXP_GLOBAL, (...match) =>
    match[0].replace(match[1], images[match[1]].localPath)
  )
}

const updateAssetPathsWithLocalPaths = (markdown, assets) => {
  return markdown.replace(MARKDOWN_ASSET_REGEXP_GLOBAL, (...match) =>
    assets[match[1]]
      ? match[0].replace(match[1], assets[match[1]].localPath)
      : match[0]
  )
}

const createBrokenImagePlaceholder = async (
  fileNodeFactory,
  placeholderURL
) => {
  const brokenImageReplacementURL = placeholderURL || null
  if (brokenImageReplacementURL) {
    const brokenImageReplacementNode = await fileNodeFactory.createImageNode(
      brokenImageReplacementURL
    )
    if (brokenImageReplacementNode) {
      const localPath = copyFileToStaticFolder(brokenImageReplacementNode)
      return {
        localPath: localPath,
        id: brokenImageReplacementNode.id,
      }
    }
  }
  return null
}

const validateNodeNames = (collections, singletons) => {
  const collisions = Object.values(
    collections
      .map(collection => ({
        type: 'collection',
        name: collection.name,
      }))
      .concat(
        singletons.map(singleton => ({
          type: 'singleton',
          name: singleton.name,
        }))
      )
      .reduce((accumulator, node) => {
        const key = node.name[0].toUpperCase() + node.name.substring(1)

        if (accumulator[key]) {
          accumulator[key].push(node)
        } else {
          accumulator[key] = [node]
        }

        return accumulator
      }, {})
  )
    .filter(association => association.length > 1)
    .map(association =>
      association.reduce(
        (accumulator, node) =>
          accumulator +
          (accumulator !== '' ? ' & ' : '') +
          `${node.name} (${node.type})`,
        ''
      )
    )

  if (collisions.length > 0) {
    throw new Error(
      `Some collections or singletons names are colliding,
       you must provide aliases for some of them in the plugin's configuration.` +
        '\n' +
        `An example for a collection and a singleton both named "team" would be:
        options: {
          …
          aliases: {
            singleton: {
              team: 'Team', // 'team' would be valid too
            },
            collection: {
              team: 'Teams', // 'teams' would be valid too
            }
          }
        }` +
        '\n' +
        'The colliding names are:\n' +
        collisions.reduce(
          (accumulator, collision) => accumulator + '- ' + collision + '\n',
          ''
        )
    )
  }
}
