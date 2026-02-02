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

- **Article Summarization**: Automatically generate concise summaries of article content using AI, optimized for frequent use with efficient model selection
- **Smart Categorization**: Leverage Google Gemini AI to automatically categorize and organize articles into meaningful topics
- **Full-Text Extraction**: Extract and display article content with HTML parsing and cleanup
- **OPML Support**: Import and export feed lists in standard OPML format

### AI Integration

- **Google Gemini API**: Powered by Google's Gemini 3 Flash and Gemma models for intelligent operations
- **Rate Limiting**: Built-in rate limiting (2 requests/hour, 20 requests/day) with automatic fallback to efficient backup models
- **Graceful Degradation**: System continues to function even when rate limits are exceeded
- **Model Transparency**: All AI-generated summaries include attribution showing which model was used

### Feed Discovery & Updates

- **Periodic Updates**: Automatic background feed updates with configurable scheduling
- **Content Parsing**: RssParser for reliable feed content extraction
- **Feed Validation**: Verify feed URLs and check content-type headers
- **YouTube Channel Support**: Subscribe to YouTube channels via their RSS feeds

### Data Management

- **SQLite Database**: Local data persistence for feeds, articles, and settings
- **Settings Manager**: Persistent configuration storage for API keys and preferences
- **Usage Metrics**: Track API usage and token consumption
- **Rate Limit Tracking**: Persistent rate limit cache across sessions

### User Interface

- **Modern Desktop App**: Built with Electron for cross-platform compatibility
- **React Frontend**: Responsive UI for browsing feeds and reading articles
- **TypeScript**: Type-safe codebase for reliability

## Architecture

### Server (Node.js + TypeScript)

- **Feed Management**: FeedFinder, FeedUpdater modules
- **AI Services**: GoogleAiService for summarization and categorization
- **Feed Parsing**: OpmlParser, FeedUpdater with parallel processing
- **Item Categorization**: ItemCategorizer with AI-powered grouping
- **Article Processing**: ArticleToMarkdown converter

### Desktop Client (Electron)

- **React Frontend**: Material-UI components and custom styling
- **Settings Management**: User preferences and API configuration
- **Service Integration**: Communication with local Node.js server

## Development

Should follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

[![CI](https://github.com/jdichev/forest/actions/workflows/main.yml/badge.svg)](https://github.com/jdichev/forest/actions/workflows/main.yml)
