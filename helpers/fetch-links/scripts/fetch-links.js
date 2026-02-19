#!/usr/bin/env node

const { fetchLinks } = require('..');

function usage() {
  console.error('Usage: node scripts/fetch-links.js <url>');
}

function validateUrl(input) {
  let parsed;
  try {
    parsed = new URL(input);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }
  return parsed;
}

async function main() {
  const input = process.argv[2];
  if (!input) {
    usage();
    process.exit(1);
  }

  const parsed = validateUrl(input);
  if (!parsed) {
    console.error('Invalid URL. Please provide a valid http or https URL.');
    usage();
    process.exit(1);
  }

  const links = await fetchLinks(parsed.toString());
  console.log(JSON.stringify(links, null, 2));
}

main().catch((err) => {
  console.error('Failed to fetch links:', err && err.message ? err.message : err);
  process.exit(1);
});
