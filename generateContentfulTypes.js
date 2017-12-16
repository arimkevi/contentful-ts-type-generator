/*jshint esversion: 6 */

const contentful = require('contentful-management')
const fs = require('fs')

const YOUR_MANAGEMENT_TOKEN = ''
const PATH_TO_WRITE = './contentfulTypes.ts'
const SPACE_ID = ''
const CONTENTFUL_HOST = 'api.contentful.com'

const client = contentful.createClient({
  host: CONTENTFUL_HOST,
  accessToken: YOUR_MANAGEMENT_TOKEN,
  resolveLinks: true,
})

String.prototype.capitalize = function() {
  return this.charAt(0).toUpperCase() + this.slice(1)
}

function getTypes(space) {
  return space
    .getContentTypes({ limit: 300 })
    .then(entries => {
      return entries
    })
    .catch(e => console.log(e))
}

function formatType(field) {
  var type = field.type
  if (type === 'Text' || type === 'Symbol') return 'string'
  if (type === 'Number' || type === 'Integer') return 'number'
  if (type === 'Boolean') return 'boolean'
  if (type === 'Link' && field.linkType === 'Asset') {
    return 'Asset'
  }
  if (type === 'Link' && field.linkType === 'Entry') {
    if(field.validations[0] && field.validations[0].linkContentType) {
      if(field.validations[0].linkContentType.length === 1) {
        return `Entry <${field.validations[0].linkContentType[0].capitalize()}>`
      } else {
        let typeString = ''
        field.validations[0].linkContentType.forEach(type => {
          typeString = `${typeString} | ${type.capitalize()}`
        })
        return `Entry <${typeString.substr(3)}>`
      }
    } else {
      return 'any'
    }
  }

  if (type === 'Array') {
    const validations = field.items.validations[0]
    if(validations !== undefined && validations.linkContentType) {
      var typeString = 'Entry < '
      validations.linkContentType.forEach(item => {
        typeString = `${typeString}${item.capitalize()} ${validations.linkContentType.length === 1  ? '' : '|'} `
      })
      typeString = `${typeString}>  []`
      return typeString.indexOf('| >') > 0 ? typeString.slice(0,typeString.indexOf('| >')) + typeString.slice(typeString.indexOf('| >')+1): typeString
    }
    return 'Entry<any>[]'
  }
  return 'any'
}

client.getSpace(SPACE_ID).then(space => 
  getTypes(space)
  .then(result => {
    const items = result.items
    var stream = fs.createWriteStream(PATH_TO_WRITE)
    stream.once('open', () => {
      stream.write(`import { Entry, Asset } from 'contentful' \n`)
      items.forEach(item => {
        stream.write(`export const ${item.sys.id.capitalize()} = '${item.sys.id}'\n`)
        stream.write(`export interface ${item.sys.id.capitalize()} { \n`)
        stream.write(`  //${item.name}\n`)
        stream.write(`  //${item.description}\n`)
        item.fields.forEach(field => {
          var type = formatType(field)
          var nullable = field.required === 'true' ? '' : '?'
          stream.write(`  ${field.id}${nullable}: ${type}  \n`)
        })
        stream.write(`}\n\n`)
      })
      stream.end()
    })
  })
  .catch(e => {
    console.log(e)
  })
)
