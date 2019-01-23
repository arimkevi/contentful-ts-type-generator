## Usage

1. Get management api token and spaceId from Contentful. 

2. Run the script to get help options
```
node generateContentfulTypes
```

3. Base usage

```
node generateContentfulTypes <SPACE_ID> <MANAGEMENT_TOKEN>
```

This will generate contentfulTypes.d.ts file that will contain all of the space model as interfaces and inheritance. Export contains also model sys.id.


4. Once the types are generated you can use the contentful.js calling the following function:

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
