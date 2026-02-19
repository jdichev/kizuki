# fetch-links

Rust helper for extracting page links, exposed through Node.js bindings.

## Build

```bash
npm run build
```

## Test

```bash
npm test
```

## Usage

```js
const { fetchLinks } = require("./index");

async function main() {
  const links = await fetchLinks("https://example.com");
  console.log(links);
}

main().catch(console.error);
```
