# AI Translation

Professional translation application with AI-powered insights. Supports Japanese, English, Russian, Chinese, Korean, and Spanish with multiple LLM providers.

## Features

- **Multiple Language Support**: Japanese, English, Russian, Chinese, Korean, Spanish
- **Multiple LLM Providers**: Groq, Google Gemini, Cerebras, OpenAI, Grok (xAI)
- **AI-Powered Features**:
  - Word-by-word translation with meanings
  - Detailed explanations (grammar notes, cultural context)
  - Nuance explanations (tone, connotations, subtle meanings)
- **Translation History**: Save, view, and delete translation history
- **Customizable Settings**: Adjust temperature, model, and output options
- **Dark/Light Mode**: Easy theme switching
- **Responsive Design**: Works on desktop and mobile
- **Offline-First**: Settings and history saved locally in browser

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **UI Components**: shadcn/ui
- **Animations**: Framer Motion
- **State Management**: Zustand (with persistence)
- **Icons**: Lucide React

## Getting Started

### Prerequisites

- Node.js 18+ installed
- An API key from one of the supported LLM providers

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Build for Production

```bash
npm run build
npm start
```

## Configuration

### API Keys

This application uses client-side API calls, so you need to provide your own API keys. These are stored locally in your browser and never sent to our servers.

**Supported Providers**:

1. **Groq** - Get API key at [console.groq.com](https://console.groq.com/)
   - Default models: `llama-3.3-70b-versatile`, `llama-3.1-8b-instant`, `meta-llama/llama-4-scout-17b-16e-instruct`

2. **Google Gemini** - Get API key at [ai.google.dev](https://ai.google.dev/)
   - Default models: `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-3-flash-preview`

3. **Cerebras** - Get API key at [inference.cerebras.ai](https://inference.cerebras.ai/)
   - Default models: `llama-3.3-70b`, `llama3.1-8b`, `qwen-3-32b`, `gpt-oss-120b`

4. **OpenAI** - Get API key at [platform.openai.com](https://platform.openai.com/)
   - Default models: `gpt-4.1-mini`, `gpt-4o`, `gpt-4.1`

5. **Grok (xAI)** - Get API key at [x.ai](https://x.ai/)
   - Default models: `grok-4`, `grok-3`, `grok-3-mini`

### Setting Up

1. Click on the "Settings" tab in the application
2. Select your preferred LLM provider
3. Enter your API key (click the eye icon to toggle visibility)
4. Optionally configure:
   - Custom model name
   - Custom API endpoint
   - Temperature (0-2, lower = more focused, higher = more creative)
5. Configure display options:
   - Show word list
   - Show detailed explanation
   - Show nuance explanation
6. Click "Save Settings"

## Usage

### Translating Text

1. Select source and target languages in Settings
2. Enter text in the input area
3. Click "Translate" or press Ctrl+Enter
4. View translation in the output area
5. Switch between "Word List" and "Explanations" tabs for detailed insights

### Using History

1. Click on the "History" tab
2. View all past translations sorted by date
3. Click on any item to see full details
4. Delete individual items or clear all history
5. Copy translations with one click

### Theme Toggle

Click the sun/moon icon in the header to switch between light and dark modes.

## Deployment

### Cloudflare Pages

This project is configured for Cloudflare Pages deployment:

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy the `out` directory to Cloudflare Pages

3. Or use the Cloudflare Pages CLI:
   ```bash
   npx wrangler pages deploy out
   ```

### Other Platforms

This is a static site and can be deployed to any static hosting service:
- Vercel
- Netlify
- GitHub Pages
- AWS Amplify

## Project Structure

```
llm-translator/
|-- src/
|   |-- app/
|   |   |-- layout.tsx       # Root layout
|   |   |-- page.tsx         # Main page
|   |   `-- globals.css      # Global styles and theme
|   |-- components/
|   |   |-- ui/              # shadcn/ui components
|   |   |-- TranslationInterface.tsx
|   |   |-- SettingsPanel.tsx
|   |   `-- HistoryPanel.tsx
|   |-- store/
|   |   |-- settingsStore.ts  # Settings state management
|   |   `-- historyStore.ts   # Translation history
|   `-- lib/
|       |-- llm/
|       |   `-- providers.ts  # LLM API integration
|       `-- utils.ts         # Utility functions
|-- public/                # Static assets
`-- package.json
```

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Privacy & Security

- All API keys are stored locally in your browser using localStorage
- No data is sent to any third-party servers except the selected LLM provider
- Translation history is stored locally in your browser
- We do not collect any personal data or usage analytics

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
- Animations by [Framer Motion](https://www.framer.com/motion/)

