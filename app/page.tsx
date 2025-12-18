import { SwaggerExtractor } from "@/components/swagger-extractor";
import { FileJson, Tags, Download, Zap, TestTube, Shield } from "lucide-react";

const features = [
  {
    icon: FileJson,
    title: "OpenAPI 2.0 & 3.x",
    description: "Supports both Swagger 2.0 and OpenAPI 3.x specifications",
  },
  {
    icon: Tags,
    title: "Tag-based Selection",
    description: "Select specific API tags to extract only what you need",
  },
  {
    icon: Download,
    title: "Multiple Formats",
    description: "Export as JSON or TOON (optimized for LLM prompts)",
  },
  {
    icon: TestTube,
    title: "API Testing",
    description: "Test endpoints directly with configurable auth",
  },
  {
    icon: Shield,
    title: "Auto-detect Auth",
    description: "Automatically detects security schemes from your spec",
  },
  {
    icon: Zap,
    title: "File Uploads",
    description: "Supports multipart/form-data and binary endpoints",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Swagger Extractor
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Load your OpenAPI/Swagger file, select the tags you need, test endpoints,
            and export in JSON or TOON format optimized for LLM prompts.
          </p>
        </header>

        {/* Features grid - only show when no swagger is loaded */}
        <div className="mb-8" id="features-section">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="flex flex-col items-center text-center p-3 rounded-lg bg-muted/30 border border-transparent hover:border-border transition-colors"
              >
                <feature.icon className="h-5 w-5 mb-2 text-primary" />
                <h3 className="text-xs font-medium mb-1">{feature.title}</h3>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <SwaggerExtractor />

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t text-center text-xs text-muted-foreground">
          <p>
            Swagger Extractor helps you work with OpenAPI specifications efficiently.
            <br />
            Upload a swagger.json, select your tags, test endpoints, and export for your LLM workflows.
          </p>
        </footer>
      </div>
    </main>
  );
}
