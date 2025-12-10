# Build System Documentation

## Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

## Setup

```bash
# Install dependencies
npm install
```

## Build Commands

### Development Build
```bash
# Build once in development mode
npm run build:dev

# Build and watch for changes
npm run build:watch
```

### Production Build
```bash
# Build for Chrome (optimized)
npm run build

# Build for Firefox
npm run build:firefox
```

### Type Checking
```bash
# Check types without emitting files
npm run type-check
```

### Testing
```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

### Linting
```bash
# Lint TypeScript files
npm run lint
```

### Clean
```bash
# Remove build artifacts
npm run clean
```

## Project Structure

```
browser-fingerprint-shuffler/
├── src/                    # TypeScript source files
│   ├── core/              # Core modules (config, crypto, etc.)
│   ├── content/           # Content scripts and hooks
│   └── types/             # TypeScript type definitions
├── dist/                  # Build output (generated)
├── images/                # Extension icons
├── manifest.json          # Chrome extension manifest
├── manifest.firefox.json  # Firefox extension manifest (if needed)
├── package.json           # npm configuration
├── tsconfig.json          # TypeScript configuration
├── webpack.config.js      # Webpack build configuration
└── README.md             # Main documentation
```

## Migration from JavaScript

The extension is being migrated from JavaScript to TypeScript. During the migration:

1. **Current state**: Both JS and TS files coexist
2. **Development**: New code should be written in TypeScript
3. **Build process**: Webpack bundles everything into `dist/`
4. **Testing**: Load the `dist/` folder as an unpacked extension

## Loading the Extension

### Chrome/Edge
1. Build the extension: `npm run build`
2. Open `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist/` folder

### Firefox
1. Build for Firefox: `npm run build:firefox`
2. Open `about:debugging#/runtime/this-firefox`
3. Click "Load Temporary Add-on"
4. Select `dist/manifest.json`

## TypeScript Configuration

See `tsconfig.json` for TypeScript compiler options. Key settings:

- **Target**: ES2020
- **Module**: ESNext
- **Strict mode**: Enabled
- **Source maps**: Generated for debugging

## Webpack Configuration

See `webpack.config.js` for build settings. Key features:

- **Entry points**: Each hook/module is a separate entry
- **Output**: Bundled to `dist/` directory
- **Loaders**: `ts-loader` for TypeScript compilation
- **Plugins**: Copy manifest and assets

## Type Definitions

All TypeScript interfaces are defined in `src/types/index.ts`:

- `FingerprintConfig` - Configuration options
- `FingerprintEnv` - Runtime environment
- `HookInstaller` - Hook function signature
- Plus utilities and global declarations

## Development Workflow

1. Make changes to TypeScript files in `src/`
2. Run `npm run build:watch` to auto-rebuild
3. Reload the extension in browser (click reload button in extensions page)
4. Test changes

## Troubleshooting

### Build fails with TypeScript errors
- Run `npm run type-check` to see detailed errors
- Check that all files have proper type annotations

### Extension doesn't load
- Ensure `dist/manifest.json` exists
- Check browser console for errors
- Verify all required files are in `dist/`

### Changes not reflecting
- Make sure you're building (`npm run build`)
- Reload the extension in browser
- Clear browser cache if needed
