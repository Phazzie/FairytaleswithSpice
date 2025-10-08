# Changelog

All notable changes to the Fairytales with Spice project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2025-01-XX

### 🚀 Digital Ocean Migration

#### Zero Technical Debt Migration
- **Express Server Integration**: Added API routes to existing SSR server (no adapter pattern, no abstraction layer)
- **Service Layer Preservation**: All seam contracts remain unchanged in `api/lib/services/` (seam-driven compliance)
- **Direct Route Implementation**: Copy-pasted serverless function logic into Express routes (5 endpoints: health, generate, continue, audio, export)
- **Buildpack Deployment**: Digital Ocean auto-detection (no Dockerfile needed)

#### Changed Files (3 total, ~180 lines)
- `story-generator/src/server.ts`: Added middleware (JSON, CORS) + 5 API routes (142 lines added)
- `story-generator/package.json`: Added `build:prod`, `start:prod` scripts + Node 20 engine requirement (3 lines added)
- `.do/app.yaml`: Digital Ocean App Platform configuration (buildpack, health checks, environment variables) (new file, 47 lines)

#### Deployment Details
- **Method**: Digital Ocean App Platform with Node.js buildpack
- **Build**: `cd story-generator && npm install && npm run build:prod`
- **Runtime**: `cd story-generator && npm run start:prod`
- **Port**: 8080 (configurable via PORT env var)
- **Cost**: $5/month (basic-xxs tier)
- **Region**: NYC (configurable to SFO, AMS, etc.)

#### Technical Approach
- **Seam-Driven Compliance**: Service layer untouched, only HTTP transport changed (Vercel functions → Express routes)
- **Mock Fallbacks**: Development mode works without API keys
- **Zero Refactoring**: Direct code copy-paste, no architectural changes
- **Simple Migration**: ~150 lines of actual code changes

### 🔧 Technical Debt Status
**Created**: 0 new items  
**Deferred**: Root package.json TypeScript dependency (non-critical, scale-only issue)  
**Maintained**: All existing seam contracts and service layer architecture

---

## [2.1.0] - 2025-09-21

### 🎉 Major Features Added

#### Multi-Voice Audio System
- **Advanced Character Voices**: Implemented character-specific voices for vampires, werewolves, fairies, and humans
- **Speaker Tag Recognition**: Automatically detects `[Character]:` patterns in generated stories
- **Gender Detection**: Intelligently assigns male/female voices based on character names
- **Seamless Audio Merging**: Combines multiple voice segments with proper timing and silence
- **90+ Emotion Mapping**: Maps emotional states to voice parameters for enhanced expressiveness

#### Enhanced Story Generation
- **TV-Quality Prompts**: Upgraded story generation with professional narrative structures
- **Real-Time Progress**: Added progress indicators with realistic status updates during generation
- **Character Development**: Enhanced character depth and interaction patterns
- **Chapter Continuity**: Improved chapter continuation with theme and tone consistency

#### Audio Player Integration
- **Built-in Audio Player**: Added native HTML5 audio player with controls
- **Download Functionality**: Direct download links for generated audio files
- **Duration Display**: Shows audio length and playback information
- **Format Support**: MP3, WAV, and AAC audio format options

### 🛠️ Technical Improvements

#### Deployment & Infrastructure
- **Angular Budget Fixes**: Resolved CSS bundle size limits for successful Vercel deployment
- **Serverless Optimization**: Enhanced API endpoints for better Vercel serverless function performance
- **Environment Configuration**: Improved environment variable handling across development and production
- **Build Optimization**: Streamlined build process with better dependency management

#### Code Quality & Documentation
- **Comprehensive Comments**: Added detailed JSDoc documentation throughout codebase
- **Type Safety**: Enhanced TypeScript strict mode compliance
- **Error Handling**: Improved error logging and user feedback systems
- **Debug Panel**: Enhanced debugging tools with API health checks and error monitoring

#### User Experience
- **Responsive Design**: Improved mobile and tablet compatibility
- **Loading States**: Added visual feedback for all async operations
- **Success Messages**: Clear confirmation for completed actions
- **Progress Visualization**: Real-time progress bars with percentage indicators

### 🔧 Technical Details

#### Frontend (Angular 20.3)
- Enhanced form validation and user input handling
- Improved component lifecycle management
- Better state management for complex UI operations
- Optimized bundle size and performance

#### Backend (Serverless Functions)
- Advanced audio processing with multi-voice support
- Enhanced story generation with improved prompts
- Better error handling and logging
- Optimized API response times

#### Infrastructure
- Vercel deployment configuration updates
- Environment variable management improvements
- Build process optimization
- Dependency management streamlining

### 🐛 Bug Fixes
- Fixed Angular CSS budget warnings during build
- Resolved TypeScript compilation errors in API services
- Fixed Vercel install command sequence
- Corrected audio player display issues
- Resolved theme selection state management

### 📚 Documentation Updates
- Comprehensive README.md with feature overview
- Detailed API documentation
- Code comments and JSDoc additions
- Development setup instructions
- Troubleshooting guide

### 🔄 Migration Notes
- No breaking changes for existing users
- Enhanced theme system (compatible with previous selections)
- Audio features are additive (backward compatible)
- Environment variables are optional (defaults to mock mode)

---

## [2.0.0] - 2025-09-15 (Previous Release)

### Major Features
- Initial seam-driven architecture implementation
- Basic story generation with creature selection
- Theme-based story customization
- Export functionality (PDF, EPUB, DOCX, etc.)
- Debug panel for development
- Comprehensive test coverage (95%+)
- Enterprise CI/CD pipeline
- Vercel deployment integration

### Technical Foundation
- Angular 20.3 frontend framework
- TypeScript strict mode compliance
- Serverless API architecture
- Mock service implementations
- Contract-based development approach

---

## Development Guidelines

### Version Numbering
- **Major (X.0.0)**: Breaking changes or significant architectural updates
- **Minor (X.Y.0)**: New features, enhancements, backward-compatible changes
- **Patch (X.Y.Z)**: Bug fixes, documentation updates, minor improvements

### Release Process
1. Update version in package.json files
2. Update this CHANGELOG.md
3. Create release branch
4. Run full test suite
5. Deploy to staging
6. Merge to main
7. Tag release
8. Deploy to production

### Contributing
When contributing, please:
- Add entries to the "Unreleased" section
- Follow the established format
- Include technical details for developers
- Note any breaking changes
- Reference issue numbers when applicable

---

*For detailed technical documentation, see the [API Documentation](./api/README.md) and [Development Guide](./DEVELOPMENT.md).*