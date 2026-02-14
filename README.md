# Forest - AI-Powered Desktop Feed Reader

A modern desktop feed reader built with Electron and TypeScript, featuring intelligent content discovery, AI-powered summarization, and automatic article categorization.

## Features

### Feed Management

- **Automatic Feed Discovery**: Detect RSS/Atom feeds from any website URL, including:
  - Medium.com publications and custom domains
  - Substack.com publications and custom domains
  - Standard RSS/Atom feeds
  - OPML import/export for bulk feed management

### Content Processing

- **Article Summarization**: Automatically generate concise summaries of article content using AI
- **Smart Categorization**: Leverage Google Gemini AI to automatically categorize and organize articles into meaningful topics
- **Full-Text Extraction**: Extract and display article content with HTML parsing and cleanup
- **OPML Support**: Import and export feed lists in standard OPML format
- **Google Gemini API**: Powered by Google's Gemini 3 Flash and Gemma models for intelligent operations

### Feed Discovery & Updates

- **Periodic Updates**: Automatic background feed updates (not yet configurable scheduling)
- **Content Parsing**: RssParser for reliable feed content extraction
- **Feed Validation**: Verify feed URLs and check content-type headers
- **YouTube Channel Support**: Subscribe to YouTube channels via their RSS feeds

## Development

Should follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

[![CI](https://github.com/jdichev/forest/actions/workflows/main.yml/badge.svg)](https://github.com/jdichev/forest/actions/workflows/main.yml)
