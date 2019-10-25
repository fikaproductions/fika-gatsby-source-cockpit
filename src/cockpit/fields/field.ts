interface FieldArgs {
  type: string
  value: any
}

class Field {
  private type: string
  private value: any

  constructor({ type, value }: FieldArgs) {
    this.type = type
    this.value = value
  }
}

export default Field
