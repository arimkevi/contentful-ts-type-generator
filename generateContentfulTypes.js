#!/usr/bin/env node
/*jshint esversion: 6 */

const program = require('commander');
const contentful = require('contentful-management')
const fs = require('fs')
const path = require('path')

const capitalize = (str) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function getTypes(space) {
  return space
    .getContentTypes({ limit: 1000 })
    .then(entries => {
      return entries
    })
    .catch(e => console.log(e))
}

function formatType(field, prefix = '') {
  var type = field.type
  if (type === 'Text' || type === 'Symbol') return 'string'
  if (type === 'Number' || type === 'Integer') return 'number'
  if (type === 'Boolean') return 'boolean'
  if (type === 'Link' && field.linkType === 'Asset') {
    return 'Asset'
  }
  if (type === 'Link' && field.linkType === 'Entry') {
    if(field.validations && field.validations[0] && field.validations[0].linkContentType) {
      if(field.validations[0].linkContentType.length === 1) {
        return `Entry <${prefix}${capitalize(field.validations[0].linkContentType[0])}>`
      } else {
        let typeString = ''
        field.validations && field.validations[0].linkContentType.forEach(type => {
          typeString = `${typeString} | ${prefix}${capitalize(type)}`
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
        typeString = `${typeString}${capitalize(item)} ${validations.linkContentType.length === 1  ? '' : '|'} `
      })
      typeString = `${typeString}>  []`
      return typeString.indexOf('| >') > 0 ? typeString.slice(0,typeString.indexOf('| >')) + typeString.slice(typeString.indexOf('| >')+1): typeString
    }
    return 'Entry<any>[]'
  }
  return 'any'
}

const generateContentfulTypes = (contentfulManagementClient, space, environment, outputFilePath = './contentfulTypes.d.ts', prefix = '' ) => {
  contentfulManagementClient.getSpace(space)
    .then((space) => space.getEnvironment(environment))
      .then((environment) => {
        environment.getContentTypes({limit:1000})
          .then(result => {
            console.log(result)
            const items = result.items
            var stream = fs.createWriteStream(outputFilePath)
            stream.once('open', () => {
              stream.write(`import { Entry, Asset } from 'contentful' \n`)
              items.forEach(item => {
                stream.write(`export const ${prefix}${capitalize(item.sys.id)} = '${item.sys.id}'\n`)
                stream.write(`export interface prefix${capitalize(item.sys.id)} { \n`)
                stream.write(`  //${item.name}\n`)
                stream.write(`  //${item.description}\n`)
                item.fields.forEach(field => {
                  var type = formatType(field, prefix)
                  var nullable = field.required === 'true' ? '' : '?'
                  stream.write(`  ${prefix}${field.id}${nullable}: ${type}  \n`)
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

const createClientAndGenerate = (space, accessToken, outputFilePath = './contentfulTypes.d.ts', host = 'cdn.contentful.com', environment = 'master', prefix = '') => {
  const client = contentful.createClient({
    host,
    accessToken,
    resolveLinks: true,
  })
  generateContentfulTypes(client, space, environment, outputFilePath, prefix)
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
  .action((spaceId, accessToken, options) => createClientAndGenerate(spaceId, accessToken, options.output, options.host, options.environment, options.prefix))
  .parse(process.argv);

if (!program.args.length) {
  program.help()
}

module.exports = generateContentfulTypes
