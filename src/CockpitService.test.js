const CockpitService = require('./CockpitService')
const {
  INVALID_LOCALES,
  INVALID_BASE_URL,
  INVALID_TOKEN,
  INVALID_WHITE_LISTED_COLLECTION_NAMES,
  INVALID_WHITE_LISTED_SINGLETON_NAMES,
  INVALID_ALIASES,
} = require('./constants')

describe('Creating the CockpitService', () => {
  describe('when the locale list is null', () => {
    test('should throw', () => {
      expect(() => create({ locales: null })).toThrow(INVALID_LOCALES)
    })
  })

  describe('when locales is not an array', () => {
    test('should throw', () => {
      expect(() => create({ locales: 1 })).toThrow(INVALID_LOCALES)
    })
  })

  describe('when locales is an empty array', () => {
    test('should work', () => {
      create({ locales: [] })
    })
  })

  describe('when locales is not empty', () => {
    test('should work', () => {
      create({ locales: ['en'] })
    })
  })

  describe('when baseUrl is null', () => {
    test('should throw', () => {
      expect(() => create({ baseUrl: null })).toThrow(INVALID_BASE_URL)
    })
  })

  describe('when baseUrl is not a string', () => {
    test('should throw', () => {
      expect(() => create({ baseUrl: 1 })).toThrow(INVALID_BASE_URL)
    })
  })

  describe('when token is not a string', () => {
    test('should throw', () => {
      expect(() => create({ token: 1 })).toThrow(INVALID_TOKEN)
    })
  })

  describe('when whiteListedCollectionNames is null', () => {
    test('should work', () => {
      create({ whiteListedCollectionNames: null })
    })
  })

  describe('when whiteListedCollectionNames is undefined', () => {
    test('should work', () => {
      create({ whiteListedCollectionNames: undefined })
    })
  })

  describe('when whiteListedCollectionNames is not a list', () => {
    test('should throw', () => {
      expect(() =>
        create({ whiteListedCollectionNames: 'not a list' })
      ).toThrow(INVALID_WHITE_LISTED_COLLECTION_NAMES)
    })
  })

  describe('when whiteListedSingletonNames is null', () => {
    test('should work', () => {
      create({ whiteListedSingletonNames: null })
    })
  })

  describe('when whiteListedSingletonNames is undefined', () => {
    test('should work', () => {
      create({ whiteListedSingletonNames: undefined })
    })
  })

  describe('when whiteListedSingletonNames is not a list', () => {
    test('should throw', () => {
      expect(() => create({ whiteListedSingletonNames: 'not a list' })).toThrow(
        INVALID_WHITE_LISTED_SINGLETON_NAMES
      )
    })
  })

  describe('when aliases is undefined', () => {
    test('should work', () => {
      create({ aliases: undefined })
    })
  })

  describe('when aliases is not an object', () => {
    test('should throw', () => {
      expect(() => create({ aliases: 'not an object' })).toThrow(
        INVALID_ALIASES
      )
    })
  })
})

function create(options) {
  const baseUrl = getOption(options, 'baseUrl', 'https://exmaple.com')
  const token = getOption(options, 'token', '1234abcd1234abcd')
  const locales = getOption(options, 'locales', [])

  const {
    whiteListedCollectionNames,
    whiteListedSingletonNames,
    aliases,
  } = options

  return new CockpitService(
    baseUrl,
    token,
    locales,
    whiteListedCollectionNames,
    whiteListedSingletonNames,
    aliases
  )
}

function getOption(options, name, defaultValue) {
  const value = options[name]
  if (value === undefined) return defaultValue
  else return value
}
