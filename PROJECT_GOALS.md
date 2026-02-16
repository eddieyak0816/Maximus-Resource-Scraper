# Maximus Resource Scraper - Project Goals

## Overall Project Goals
- Build a desktop application for aggregating content from multiple sources (YouTube, articles, podcasts, social media, industry forums)
- Generate AI-powered summaries with key points and timestamps
- Transform summaries into podcasts (text-to-speech), videos (AI-generated), and interactive documents
- Support multiple research projects with intelligent source suggestions and cross-project insights
- Ensure privacy-first design with local data storage
- Enable future sharing capabilities for VA team access
- Use low-cost/free approaches with OpenRouter API and free-tier services

## Subprojects
### 1. Core Application Setup
- Set up Electron framework for cross-platform desktop app
- Implement basic React UI for project management
- Establish SQLite database for local data storage
- Create modular code structure for maintainability

### 2. Content Aggregation Module
- Implement content fetching from various sources (YouTube API, web scraping for articles, etc.)
- Add source type detection and metadata extraction
- Build intelligent source suggestion system
- Ensure multi-threading for parallel processing

### 3. AI Processing Engine
- Integrate OpenRouter API for content summarization
- Implement key point extraction and timestamp generation
- Add cross-project insight analysis
- Optimize for low-cost API usage

### 4. Output Generation System
- Develop text-to-speech functionality for podcasts
- Implement AI video generation capabilities
- Create interactive document formatting
- Add export options for different formats

### 5. User Interface and Experience
- Design intuitive project management interface
- Build content browsing and organization tools
- Add progress tracking and status indicators
- Implement search and filtering capabilities

### 6. Privacy and Security
- Ensure all data storage is local
- Implement data encryption where needed
- Add optional cloud sync features (user-controlled)
- Design for future sharing capabilities

### 7. Deployment and Distribution
- Package app for Windows, Mac, and Linux
- Set up auto-updates if needed
- Prepare for VA team access features
- Optimize for offline operation

## Small Steps Breakdown
*(To be detailed as development progresses)*

## Progress Tracking
- [x] Phase 1: Core setup and basic UI (Week 1-2) - COMPLETED
- [x] Phase 2: Content fetching implementation (Week 3-6) - COMPLETED (YouTube, articles with transcripts)
- [x] Phase 3: AI integration and summarization (Week 7-10) - COMPLETED (OpenRouter with multiple models, educational summaries)
- [x] Phase 4: Output generation features (Week 11-14) - PARTIALLY COMPLETED (Podcast TTS implemented with ElevenLabs)
- [ ] Phase 5: UI polish and advanced features (Week 15-18)
- [ ] Phase 6: Testing, deployment, and launch (Week 19-24)

## Updates
*Last updated: February 15, 2026*
- Initial goal document created
- Core application setup completed with Electron, React, SQLite
- Database switched to SQLite for easier local deployment
- Content aggregation implemented for YouTube (with transcripts) and articles
- AI summarization integrated using OpenRouter API with multiple LLM options
- Educational summary format developed with comprehensive details and actionable key points
- UI includes project management, source CRUD, and summary display
- Podcast generation implemented using Windows Speech API (free, unlimited)