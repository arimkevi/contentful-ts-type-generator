#!/usr/bin/env node
/*jshint esversion: 6 */

const program = require('commander');
const contentful = require('contentful-management')
const fs = require('fs')
const path = require('path')
const Rx = require('rx')

const toInterfaceName = (s, prefix = '') => {
  s.replace(/-[[:alnum:]]/gm, (match) => { console.log('Match', match); return match.slice(1).toUpperCase()})
  return prefix + s.charAt(0).toUpperCase() + s.slice(1)
    .replace(/-[A-Za-z0-9_]/g, (match) => match.slice(1).toUpperCase())
}

const relativePath = path.normalize(path.relative(process.cwd(), __dirname))

const formatType = (field, prefix = '', isArray = false) => {
  var type = field.type
  if (type === 'Text' || type === 'Symbol') {
    if(field.validations && field.validations[0] && field.validations[0].in) {
      if(isArray) {
        return `(${field.validations[0].in.map(validValue => `'${validValue}'`).join('|')})[]`
      } else {
        return field.validations[0].in.map(validValue => `'${validValue}'`).join('|')
      }
    } else {
      return 'string'+ (isArray ? '[]' : '')
    }
  }
  if (type === 'Number' || type === 'Integer') return 'number'
  if (type === 'Boolean') return 'boolean'
  if (type === 'Link' && field.linkType === 'Asset') {
    return `Asset${isArray ? '[]' : ''}`
  }
  if (type === 'Link' && field.linkType === 'Entry') {
    if(field.validations && field.validations[0] && field.validations[0].linkContentType) {
      const fieldTypes =  field.validations && field.validations[0].linkContentType.map(type => {
        return toInterfaceName(type, prefix)
      }).join('|')
      return `Entry<${fieldTypes}>${isArray ? '[]' : ''}`
    } else {
      return 'any'
    }
  }
  if (type === 'Array') {
    return formatType(field.items, prefix, true)
  }
}

const getSpace = (client, space) => {
  return Rx.Observable.fromPromise(client.getSpace(space))
}

const getEnvironment = (space, environment) => {
  return Rx.Observable.fromPromise(space.getEnvironment(environment))
}

const getTypes = (environment) => {
  return Rx.Observable.fromPromise(environment.getContentTypes({limit:1000, order: 'sys.id'}))
}

const createClient = (host, accessToken) => {
  return contentful.createClient({
    host,
    accessToken,
    resolveLinks: true,
  })
}

const writeTypesToFile = (types, outputFilePath, prefix, ignoredFields = [] ) => {
  const items = types.items
  var stream = fs.createWriteStream(outputFilePath)
  stream.once('open', () => {
    stream.write(`import { Entry, Asset } from 'contentful' \n`)
    items.forEach(item => {
        stream.write(`export const ${toInterfaceName(item.sys.id, prefix)} = '${item.sys.id}'\n`)
        stream.write(`export interface ${toInterfaceName(item.sys.id, prefix)} { \n`)
        stream.write(`  //${item.name}\n`)
        stream.write(`  /* ${item.description} */\n`)
        item.fields.forEach(field => {
          if(field.omitted !== true && !ignoredFields.includes(field.id)) {
            var type = formatType(field, prefix)
            var nullable = field.required === true ? '' : '?'
            stream.write(`  ${field.id}${nullable}: ${type}  \n`)
          }
        })
        stream.write(`}\n\n`)
    })
    stream.end()
  })
}
          
const generateContentfulTypes = (space, accessToken, outputFilePath = './contentfulTypes.d.ts', host = 'cdn.contentful.com', environment = 'master', prefix = '', ignoredFields) => {
  const client = createClient(host, accessToken)
  getSpace(client, space)
    .flatMap(space => getEnvironment(space, environment))
    .flatMap(getTypes)
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
  .option('-h, --host [value]', 'Contentful host', 'api.contentful.com')
  .option('-i, --ignore [value]', 'Ignored field(s): a single field id or comma separated list of field ids', '')
  .action((spaceId, accessToken, options) => generateContentfulTypes(spaceId, accessToken, options.output, options.host, options.environment, options.prefix, options.ignore))
  .parse(process.argv);

if (!program.args.length) {
  program.help()
}

module.exports = generateContentfulTypes
