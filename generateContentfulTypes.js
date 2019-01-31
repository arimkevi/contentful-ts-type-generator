#!/usr/bin/env node
/*jshint esversion: 6 */

const program = require('commander');
const contentful = require('contentful-management')
const fs = require('fs')
const path = require('path')

const toInterfaceName = (s, prefix = '') => {

  s.replace(/-[[:alnum:]]/gm, (match) => { console.log('Match', match); return match.slice(1).toUpperCase()})

  return prefix + s.charAt(0).toUpperCase() + s.slice(1)
    .replace(/-[A-Za-z0-9_]/g, (match) => match.slice(1).toUpperCase())
}

function formatType(field, prefix = '', isArray = false) {
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

const generateContentfulTypes = (contentfulManagementClient, space, environment, outputFilePath = './contentfulTypes.d.ts', prefix = '', ignoredFields = [] ) => {
  contentfulManagementClient.getSpace(space)
    .then((space) => space.getEnvironment(environment))
      .then((environment) => {
        environment.getContentTypes({limit:1000})
          .then(result => {
            const items = result.items
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
              console.log('Generated ', path.normalize(outputFilePath))
            })
          })
          .catch(e => {
            console.error('error getting content types.', e)
            process.exit(1);
          })
        })
        .catch(e => {
          console.error('error getting Contentful space environment.', e)
          process.exit(1);
        })
    .catch(e => {
      console.error('error getting Contentful space.', e)
      process.exit(1);
    })
}

const createClientAndGenerate = (space, accessToken, outputFilePath = './contentfulTypes.d.ts', host = 'cdn.contentful.com', environment = 'master', prefix = '', ignoredFields) => {
  const client = contentful.createClient({
    host,
    accessToken,
    resolveLinks: true,
  })
  generateContentfulTypes(client, space, environment, outputFilePath, prefix, ignoredFields.split(','))
}


const relativePath = path.normalize(path.relative(process.cwd(), __dirname))
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
  .action((spaceId, accessToken, options) => createClientAndGenerate(spaceId, accessToken, options.output, options.host, options.environment, options.prefix, options.ignore))
  .parse(process.argv);

if (!program.args.length) {
  program.help()
}

module.exports = generateContentfulTypes
