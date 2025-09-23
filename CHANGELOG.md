# Changelog

All notable changes to the Fairytales with Spice project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### 🐛 Bug Fixes
- Fixed TypeScript compilation errors in story components
- Resolved theme type mismatches in streaming story contracts
- Fixed template literal syntax issues
- Added comprehensive error logging for debugging

### 🔧 Technical Improvements  
- Implemented streaming story generation seam contracts
- Enhanced debug panel with Heather vampire story demo
- Added validation rules for story generation contracts

## [2.1.0] - 2025-09-23 

### 🎉 Major Features

#### Enhanced Story Generation System v2.0
- **10 Unconventional Beat Structures**: Temptation Cascade, Power Exchange, Seduction Trap, Ritual Binding, Vulnerability Spiral, Hunt and Claim, Bargain's Price, Memory Fracture, Transformation Hunger, Mirror Souls
- **Dynamic Author Style Blending**: 2+1 selection system combining 15 renowned authors (Anne Rice, Patricia Briggs, Holly Black, etc.)
- **Chekhov Element Tracking**: Automatic story element planting for future chapter continuity
- **Spice-Aware Adaptation**: Beat structures intelligently adapt to content intensity levels
- **Character-Specific Story Generation**: Enhanced vampire, werewolf, and fairy story archetypes

#### Multi-Voice Audio System
- **Advanced Character Voices**: Character-specific voices for different creature types and genders
- **Speaker Tag Recognition**: Automatically detects `[Character]:` patterns in generated stories
- **90+ Emotion Mapping**: Maps emotional states to voice parameters for enhanced expressiveness
- **Professional Audio Integration**: ElevenLabs text-to-speech with multiple voice options
- **Seamless Audio Merging**: Combines multiple speakers into flowing narration

#### Professional Export System
- **Multiple Format Support**: PDF, EPUB, DOCX, HTML, and TXT export options
- **Metadata Integration**: Author, title, themes, and generation details included
- **Chapter Organization**: Properly formatted multi-chapter story exports
- **Download Management**: Secure links with expiration handling

### 🏗️ Architecture

#### Serverless Architecture
- **Vercel Serverless Functions**: Complete migration from Express.js backend to serverless API
- **Seam-Driven Development**: Explicit TypeScript contracts prevent integration failures
- **Mock Service Layer**: Full functionality without external API dependencies
- **Environment Configuration**: Seamless switching between mock and production modes

#### Frontend (Angular 20.3)
- **Enhanced Form Validation**: Improved user input handling and validation
- **Real-time Progress Indicators**: Live generation updates with status feedback
- **Responsive Design**: Mobile and tablet compatibility improvements
- **Debug Panel**: Built-in tools for API testing and error monitoring

### 🔧 Development & Infrastructure

#### Build System
- **Angular Budget Optimization**: Resolved CSS bundle size limits for Vercel deployment
- **TypeScript Strict Mode**: Enhanced type safety throughout the codebase
- **CI/CD Pipeline**: Automated testing and deployment workflows
- **Dependency Management**: Streamlined package management and security updates

#### Testing & Quality
- **Comprehensive Test Coverage**: 95%+ coverage across frontend and API
- **Integration Test Suites**: Complete workflow validation
- **Mock Testing Infrastructure**: Isolated unit tests with realistic mocks
- **Error Handling**: Improved error logging and user feedback systems

### 📚 Documentation

#### Developer Resources
- **Comprehensive README**: Complete setup and usage instructions
- **API Documentation**: Detailed endpoint documentation with examples
- **AI Agents Guide**: Specialized guide for AI development workflow
- **Code Documentation**: JSDoc comments throughout codebase

### 🔄 Migration Notes

#### Breaking Changes
- **Backend Migration**: Express.js backend replaced with Vercel serverless functions
- **Contract Updates**: Enhanced seam contracts with additional properties
- **Environment Variables**: Updated configuration for serverless deployment

#### Compatibility
- **API Compatibility**: Maintained identical API interfaces during migration
- **Feature Parity**: All previous functionality preserved in serverless architecture
- **Mock Fallbacks**: Development works fully without external API keys

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
5. Deploy to staging environment
6. Merge to main branch
7. Tag release
8. Deploy to production

### Contributing Guidelines
When contributing, please:
- Add entries to the "Unreleased" section
- Follow the established format and emoji conventions
- Include technical details for developers
- Note any breaking changes clearly
- Reference issue numbers when applicable
- Follow seam-driven development methodology

### Documentation Standards
- Update README.md for user-facing changes
- Update API documentation for endpoint changes
- Update AGENTS.md for development workflow changes
- Include JSDoc comments for new functions/classes
- Add examples for complex features

---

*For detailed technical documentation, see the [API Documentation](./api/README.md) and [AGENTS.md](./AGENTS.md) development guide.*