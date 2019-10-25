import Field from './field'

interface TextFieldArgs {
  slug?: string
  value: string
}

class TextField extends Field {
  private slug?: string

  constructor({ slug, value }: TextFieldArgs) {
    super({ type: 'text', value })
    this.slug = slug
  }
}

export default TextField
