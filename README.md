## Usage

1. In generateContentfulTypes.js fill management api token and spaceId. Define also the place where the generated types file will go.
```
const YOUR_MANAGEMENT_TOKEN = ''
const PATH_TO_WRITE = './contentfulTypes.ts'
const SPACE_ID = ''
const CONTENTFUL_HOST = 'api.contentful.com'
```

2. Run the script
```
node generateContentfulTypes.js
```
The script generates all the interfaces based on the types that it finds in your contentful. It also generates const variables with the same name containing the content id that is used to call the getContent function. After generating the type file check that there are no ghost types. For some reason Contentful sometimes returns deleted content models.

3. Once the types are generated you can use the contentful.js calling the following function:

```

const client = contentful.createClient({
  host: 'contentfulHost',
  accessToken: 'accessToken',
  space: 'spaceId'e,
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
