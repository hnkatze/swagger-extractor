import { SwaggerExtractor } from "@/components/swagger-extractor";

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            Swagger Extractor
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Load your OpenAPI/Swagger file, select the tags you need, and export
            in JSON or TOON format for LLM prompts.
          </p>
        </header>

        {/* Main content */}
        <SwaggerExtractor />
      </div>
    </main>
  );
}
