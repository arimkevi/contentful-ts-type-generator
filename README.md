## THIS IS AN ALAMY FORK OF THE ORIGINAL REPOSITORY

## Usage

1. Get preview api token and spaceId from Contentful. 

2. Install this repository into your node project

```
npm install @alamy-ops/contentful-ts-type-generator
```

3. Run the script to get help options
```
npx generateContentfulTypes
```

4. Base usage

```
npx generateContentfulTypes <SPACE_ID> <PREVIEW_API_TOKEN>
```

This will generate contentfulTypes.d.ts file that will contain all of the space model as interfaces and inheritance. Export contains also model sys.id.

If you use the `generateContentfulTypes` command in your package.json scripts, you can leave out the `npx` in front of it.

5. Options

```
  -o, --output <file>, Output file path. Default: './contentfulTypes.d.ts'
  -e, --environment [value], Contentful environment id to use. Default: 'master'
  -p, --prefix <value>, Name prefix for generated interfaces. Default: ''
  -h, --host [value], Default: 'api.contentful.com'
  -i, --ignore [value], Ignored field(s): a single field id or comma separated list of field ids. Default: ''
```

6. Once the types are generated you can use contentful.js calling the following function:

```ts

const client = contentful.createClient({
  host: 'contentfulHost',
  accessToken: 'accessToken',
  space: 'spaceId',
  resolveLinks: true,
})

export function getContent<T>(
  contentfulLocale: string, contentType: string
): Promise<contentful.Entry<T>> {
  return client
    .getEntries({ content_type: contentType, locale: contentfulLocale })
    .then((response: contentful.EntryCollection<T>) => response.items[0])
}

getContent<T>(locale, YourContentfulType)

```
