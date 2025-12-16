# Swagger Extractor

A web-based tool to extract and export sections from Swagger/OpenAPI JSON files. Select specific API tags and export endpoints with their schemas in JSON or TOON format (optimized for LLM prompts).

## Features

- **File Upload**: Drag & drop or click to upload Swagger/OpenAPI JSON files
- **Tag Selection**: Interactive table to select specific API tags
- **Endpoint Preview**: View selected endpoints with methods, paths, and descriptions
- **Multiple Export Formats**:
  - **JSON**: Standard JSON output with resolved schemas
  - **TOON**: Text-optimized format for LLM context (reduced token usage)
- **Dark Mode**: System-aware theme with manual toggle
- **Schema Resolution**: Automatically resolves `$ref` references

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **UI Components**: shadcn/ui
- **Theme**: next-themes

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, or pnpm

### Installation

```bash
# Clone the repository
git clone https://github.com/hnKatze/swagger-extractor.git
cd swagger-extractor

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Usage

1. **Upload** your Swagger/OpenAPI JSON file
2. **Select** the API tags you want to extract
3. **Preview** the endpoints that will be included
4. **Export** in your preferred format (JSON or TOON)

## Python CLI Tool

A standalone Python CLI tool is also available for command-line usage:

```bash
python swagger_extractor.py <swagger-file> [output-file]
```

**Dependencies**: `rich`, `InquirerPy`

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home page
│   └── globals.css         # Global styles & CSS variables
├── components/
│   ├── swagger-extractor/  # Main feature components
│   ├── providers/          # Context providers
│   ├── ui/                 # shadcn/ui components
│   └── mode-toggle.tsx     # Theme toggle
├── lib/
│   ├── swagger/            # Swagger parsing utilities
│   ├── formatters/         # Output formatters
│   └── types/              # TypeScript types
└── swagger_extractor.py    # Python CLI tool
```

## License

MIT License - see [LICENSE](LICENSE) for details.
