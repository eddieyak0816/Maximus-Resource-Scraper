# Maximus Resource Scraper

A desktop application for aggregating content from multiple sources, generating AI-powered summaries, and transforming them into podcasts, videos, and interactive documents.

## Features

- Aggregate content from YouTube (with full transcripts), articles, podcasts, social media, and industry forums
- AI-powered educational summaries with key points, actionable takeaways, and implementation guidance
- Multi-format outputs: podcasts (text-to-speech via Windows Speech API), videos (AI-generated), interactive documents
- Support for multiple research projects with full CRUD operations
- Intelligent source suggestions and cross-project insights
- Multi-threading for parallel content processing
- Local deployment with Electron
- Privacy-first design with local data storage
- Low-cost approach using OpenRouter API (multiple LLM options) and free-tier services

## Tech Stack

- **Frontend**: React
- **Backend**: Node.js with Electron
- **Database**: SQLite (local file-based)
- **Multi-threading**: Node.js Worker Threads
- **APIs**: OpenRouter for AI, YouTube Data API, etc.

## Setup Instructions

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Database Setup**:
   - SQLite database is automatically created and initialized when the app starts
   - No additional setup required - the database file `maximus_scraper.db` will be created in the app directory

3. **Configure APIs**:
   - Get API keys for OpenRouter and YouTube Data API
   - Create a `.env` file in the root directory and add:
     ```
     OPENROUTER_API_KEY=your_openrouter_api_key_here
     YOUTUBE_API_KEY=your_youtube_api_key_here
     ```
   - Podcast generation uses Windows built-in Speech API (free, no API key required)

4. **Development**:
   ```bash
   npm run dev
   ```

5. **Build for Production**:
   ```bash
   npm run build
   npm run dist
   ```

## Project Structure

- `main.js`: Electron main process
- `preload.js`: Secure IPC communication
- `contentProcessor.js`: Worker thread for content processing
- `src/`: React frontend
- `public/`: Static assets
- `PROJECT_GOALS.md`: Detailed project goals, subprojects, and progress tracking
- `db-setup.sql`: Database schema

## Usage

1. Launch the application
2. Create a new research project
3. Add content sources (URLs)
4. Process content to generate summaries and outputs
5. View and manage generated content

## Future Enhancements

- Sharing capabilities for VA team access
- Web-based version
- Advanced AI integrations
- Cloud sync options (optional)

## Project Goal Documents
To ensure clear direction and progress tracking, maintain detailed documents that define the project's goals. These should be broken down into small steps and subprojects, and updated regularly as development progresses. This helps keep the team aligned, track milestones, and adapt to changes.

### Creating Goal Documents
1. **Overall Project Goals**: Define the high-level objectives (e.g., build content aggregation tool with AI summaries)
2. **Subprojects**: Break into major components (e.g., UI development, API integration, database design)
3. **Small Steps**: Detail specific tasks within each subproject (e.g., implement content fetching from YouTube)
4. **Milestones**: Set checkpoints for completion and review

### Maintenance
- Update documents after each completed phase
- Note any changes in requirements or scope
- Use for sprint planning and progress reports