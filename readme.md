# @fika/gatsby-source-cockpit

This is a Gatsby version 2.\*.\* source plugin that feeds the GraphQL tree with Cockpit Headless CMS collections data.

Actually, it supports querying raw texts (and any trivial field types), Markdown, images, galleries, assets, sets, repeaters, linked collections and internationalization.

## Installation

```
npm install --save @fika/gatsby-source-cockpit
```

This project has `gatsby-source-filesystem` as a peer dependency, don't forget to install it as well.

```
npm install --save gatsby-source-filesystem
```

## Contributing

1. Fork main project on github [here](https://github.com/fikaproductions/fika-gatsby-source-cockpit).
2. Clone your fork.
3. Create a new branch on your local fork.
4. Commit and push your changes on this branch.
5. Create a pull request on the main project by going [here](https://github.com/fikaproductions/fika-gatsby-source-cockpit/compare), click on "compare across forks" and select your own branch in the "head fork" section.
6. Compare changes and submit pull request.

## How to use

Add this to your project `gatsby-config.js` file:

```
plugins: [
  {
    resolve: 'gatsby-source-filesystem',
    options: {
      name: 'src',
      path: `${__dirname}/src/`,
    },
  },
  {
    resolve: '@fika/gatsby-source-cockpit',
    options: {
      token: 'YOUR_COCKPIT_API_TOKEN',
      baseUrl:
        'YOUR_COCKPIT_API_BASE_URL', // (1)
      locales: ['EVERY_LANGUAGE_KEYS_DEFINED_IN_YOUR_COCKPIT_CONFIGURATION'], // (2)
      collections: [] // (3)
    },
  },
]
```

Notes:

1. E.g. `'http://localhost:8080'`.
2. E.g. `['en', 'fr']`.
3. The specific Cockpit collections you want to fetch. If empty or null all collections will be fetched. E.g. `['Products', 'Menu']`

Adding the `gatsby-source-filesystem` dependency to your project grants access to the `publicURL` field resolver attribute on the file nodes that this plugin generates by extending the GraphQL type of the file nodes. So, as you can guess, the path specified in the plugin options could be anything, we do not need it to load any local files, we are just taking advantage of its extension of the file node type.

## How to query

Collections are converted into nodes. You can access many collection entries at once with this syntax:

(The collection is named 'team' or 'Team' in Cockpit.)

```
{
  allCockpitTeam(filter: { spiritAnimal: { eq: "tiger" } }) { // (1)
    edges {
      node { // (2)
        cockpitId // (3)
        TeamMember1
        TeamMember2
        TeamMember3
        children // (4)
      }
    }
  }
}
```

Notes:

1. You can filter amongst them.
2. Each node is a collection entry in an array.
3. You can get the original Cockpit element's id (aka the `_id`) that way.
4. You can access descendant collection entries within that field if you have hierarchically structured your collection entries in Cockpit (_Custom sortable entries_ turned on).

Or you can access one entry at the time that way:

(The collection is named 'definition' or 'Definition' in Cockpit.)

```
query($locale: String) { // (1)
    cockpitDefinition(cockpitId: { eq: "5bc78a3679ef0740297b4u04" }, lang: { eq: $locale }) { // (2)
        Header {
            type
            value
        }
    }
}
```

Notes:

1. Using `query` with a name or not is optional in GraphQL. However, if you want to use variables from your page context, it is mandatory.
2. You can get the appropriate language by filtering on the `lang` attribute.

### Special types of Cockpit fields

#### Collection-Links

Collection-Link fields will see their value attribute refering to another or many others collection(s) node(s) (GraphQL foreign key). One to many Collection-Links are only supported for multiple entries of a single collection. This an example with a TeamMember collection entry linked within a Team collection:

```
{
  allCockpitTeam {
    edges {
      node {
        Header {
          type
          value
        }
        TeamMember {
          type // (1)
          value { // (2)
            id
            Name {
              value
            }
            Task {
              value
            }
          }
        }
      }
    }
  }
}
```

Notes:

1. The type is `'collectionlink'` and it was originally refering to an entry of the TeamMember collection.
2. The refered node is attached here. The language is preserved across these bindings.

#### Images and gallery

Image and gallery fields nested within a collection will be downloaded and will get one or more file(s) node(s) attached under the `value` attribute like this:

(You can then access the child(ren) node(s) a plugin like `gatsby-transformer-sharp` would create.)

```
{
  allCockpitTeamMember {
    edges {
      node {
        Portrait {
          value {
            publicURL // (1)
            childImageSharp {
              fluid {
                ...GatsbyImageSharpFluid
              }
            }
          }
        }
      }
    }
  }
}
```

Notes:

1. You can use this field to access your images if their formats are not supported by `gatsby-transformer-sharp` which is the case for `svg` and `gif` files.

#### Assets

Just like image fields, asset fields nested within a collection will be downloaded and will get a file node attached under the `value` attribute.

You can access the file regardless of its type (document, video, etc.) using the `publicURL` field resolver attribute on the file node.

#### Markdown

Markdown fields nested within a collection will get a custom Markdown node attached under the `value` attribute. It mimics a file node — even if there is no existing Markdown file — in order to allow plugins like `gatsby-transformer-remark` to process them. Moreover, images and assets embedded into the Markdown are downloaded and their paths are updated accordingly. Example:

(You can then access the child node a plugin like `gatsby-transformer-remark` would create.)

```
{
  allCockpitDefinition {
    edges {
      node {
        Text {
          value {
            childMarkdownRemark {
              html
            }
            internal {
              content // (1)
            }
          }
        }
      }
    }
  }
}
```

Notes:

1. You can access the raw Markdown with this attribute.

#### Set

The set field type allows to logically group a number of other fields together.

You can then access their values as an object in the `value` of the set field.

```
{
  allCockpitTeamMember {
    edges {
      node {
        ContactData { // field of type set
          value {
            telephone {
              value
            }
            fax {
              value
            }
            email {
              value
            }
          }
        }
      }
    }
  }
}
```

#### Repeater

Repeater fields are one of the most powerful fields in Cockpit and allow support for two distinct use cases:

1.  Repeat any other field type (including the set type) an arbitrary number of times resulting in an array of fields with the same type (E.g. `[Image, Image, Image]`)
1.  Choose from a number of specified fields an arbitrary number of times resulting in an array where each entry might be of a different type (E.g `[Image, Text, Set]`)

For the first case the values can be queried almost like a normal scalar field. The only difference is that two nested values are needed with the first one representing the array and the second one the value in the array.

```
{
  allCockpitTeamMember {
    edges {
      node {
        responsibilities { // field of type repeater
          value { // value of repeater (array)
            value // value of repeated field
          }
        }
      }
    }
  }
```

The second case is a bit more complicated - in order to not cause any GraphQL Schema conflicts each array value must be of the same type. To achieve this the `gatsby-source-cockpit` plugin implicitely wraps the values in a set field, generating one field in the set for each `fields` option supplied in the repeater configuration.

E.g. assuming the repeater field is configured with these options:

```
{
  "fields": [
    {
      "name": "title",
      "type": "text",
      "label": "Some text",
    },
    {
      "name": "photo",
      "type": "image",
      "label": "Funny Photo",
    }
  ]
}
```

then the following query is necessary to get the data:

```
{
  allCockpitTeamMember {
    edges {
      node {
        responsibilities { // field of type repeater
          value { // value of repeater (array)
            title {
              value
            }
            photo {
              value {
                ...
              }
            }
          }
        }
      }
    }
  }
```

**Note:** For this to work the fields specified in the `field` option need to have a `name` attribute which is not required by Cockpit itself. If the name attribute is not set, the plugin will print a warning to the console and generate a `name` value out of the value of the `label` attribute but it is recommended to explicitely specify the `name` value.

---

## Powered by &nbsp; — &nbsp;&nbsp; <a href="https://www.fikaproductions.com"><img align="center" width="200" height="200" src="src/images/logo.png"></a>
