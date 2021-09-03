#!/usr/bin/env node
/*jshint esversion: 6 */

const program = require('commander');
const contentful = require('contentful')
const fs = require('fs')
const path = require('path')
const Rx = require('rx')

const toInterfaceName = (s, prefix = '') => {
  s.replace(/-[[:alnum:]]/gm, (match) => { console.log('Match', match); return match.slice(1).toUpperCase()})
  return prefix + s.charAt(0).toUpperCase() + s.slice(1)
    .replace(/-[A-Za-z0-9_]/g, (match) => match.slice(1).toUpperCase())
}

const relativePath = path.normalize(path.relative(process.cwd(), __dirname))

const mapToStringArray = arr => arr.map(validValue => `'${validValue}'`)

const formatArray = (isArray, typeName) => isArray ? `ReadonlyArray<${typeName}>` : typeName

const concatLinkTypes = (prefix, linkContentType) =>
  Array.isArray(linkContentType)
    ? linkContentType.map(type => {
        return toInterfaceName(type, prefix)
      }).join('|')
    : toInterfaceName(linkContentType, prefix)

const formatType = (field, prefix = '', isArray = false) => {
  const type = field.type
  switch (type) {
    case 'Text':
    case 'Symbol':
    case 'Date':
      const specificValuesValidation = field.validations &&
        field.validations.find(validation => validation.hasOwnProperty('in'))
      if (specificValuesValidation) {
        console.log('specificValuesValidation', specificValuesValidation)
        return formatArray(isArray, mapToStringArray(specificValuesValidation.in).join('|'))
      } else {
        return formatArray(isArray, 'string')
      }
    case 'Number':
    case 'Integer':
      return 'number'
    case 'Boolean':
      return 'boolean'
    case 'Location':
      return '{ lat:string, lon:string }' // Use type directly from contentful.js when available
    case 'Object': // JSON object
      return 'any'
    case 'RichText':
      return '{ content: any, data: any, nodeType: string }' // Use type directly from contentful.js when available
    case 'Link':
      if (field.linkType === 'Asset') {
        return formatArray(isArray, 'Asset')
      } else if (field.linkType === 'Entry') {
        const linkContentTypeValidation = field.validations && field.validations.find(validation => validation.hasOwnProperty('linkContentType'))
        if (linkContentTypeValidation) {
          const linkContentType = linkContentTypeValidation.linkContentType
          const fieldTypes = concatLinkTypes(prefix, linkContentType)
          return formatArray(isArray, `Entry<${fieldTypes}>`)
        } else {
          return formatArray(isArray, 'any')
        }
      } else {
        console.warn(`Unknown linkType "${field.linkType}" in field ${field.id}`)
        return 'any'
      }
    case 'Array':
      return formatType(field.items, prefix, true)
    default:
      console.warn(`Unknown field type: ${type} in field ${field.id}`)
      return formatArray(isArray, 'any')
  }
}

const writeTypesToFile = (types, outputFilePath, prefix, ignoredFields = [] ) => {
  const items = types.items
  var stream = fs.createWriteStream(outputFilePath)
  stream.once('open', () => {
    stream.write(`import { Entry, Asset } from 'contentful'\n`)
    items.sort((a, b) => toInterfaceName(a.sys.id, prefix).localeCompare(toInterfaceName(b.sys.id, prefix))).forEach(item => {
        stream.write(`export const ${toInterfaceName(item.sys.id, prefix)} = '${item.sys.id}'\n`)
        stream.write(`export interface ${toInterfaceName(item.sys.id, prefix)} {\n`)
        stream.write(`  //${item.name}\n`)
        stream.write(`  /* ${item.description} */\n`)
        item.fields.sort((a, b) => a.id.localeCompare(b.id)).forEach(field => {
          if(field.omitted !== true && !ignoredFields.includes(field.id)) {
            var type = formatType(field, prefix)
            var nullable = field.required === true ? '' : '?'
            stream.write(`  readonly ${field.id}${nullable}: ${type}\n`)
          }
        })
        stream.write(`}\n\n`)
    })
    stream.end()
  })
}

const generateContentfulTypes = (space, accessToken, outputFilePath = './contentfulTypes.d.ts', host = 'cdn.contentful.com', environment = 'master', prefix = '', ignoredFields) => {
  const client = contentful.createClient({
    host,
    environment,
    space,
    accessToken,
    resolveLinks: true,
  })

  Rx.Observable
    .fromPromise(client.getContentTypes())
    .subscribe({
      onNext: (types) => {
        writeTypesToFile(types, outputFilePath, prefix, ignoredFields.split(','))
      },
      onError: (e) => {
        console.log(e)
      },
      onCompleted: () => {
        console.log('Generated to', path.normalize(outputFilePath))
      }
    })
}

program
  .arguments('<spaceId> <accessToken>')
  .usage(`[options] <spaceId> <accessToken>
  Example:
    node ${relativePath} -o ./src/types.d.ts -p Contentful spaceId accessToken`)
  .option('-o, --output <file>', 'Output file path', './contentfulTypes.d.ts')
  .option('-e, --environment [value]', 'Contentful environment id to use', 'master')
  .option('-p, --prefix <value>', 'Name prefix for generated interfaces', '')
  .option('-h, --host [value]', 'Contentful host (cdn.contentful.com, preview.contentful.com)', 'cdn.contentful.com')
  .option('-i, --ignore [value]', 'Ignored field(s): a single field id or comma separated list of field ids', '')
  .action((spaceId, accessToken, options) => generateContentfulTypes(spaceId, accessToken, options.output, options.host, options.environment, options.prefix, options.ignore))
  .parse(process.argv);

if (!program.args.length) {
  program.help()
}

module.exports = generateContentfulTypes
