import { NextRequest, NextResponse } from "next/server";

export interface SwaggerProxyRequest {
  url: string;
}

export interface SwaggerProxyResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

/**
 * API Route to fetch Swagger/OpenAPI specs from external URLs
 * This avoids CORS issues when loading specs from public APIs
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = (await request.json()) as SwaggerProxyRequest;

    // Validate URL
    if (!url) {
      return NextResponse.json(
        { success: false, error: "URL is required" } as SwaggerProxyResponse,
        { status: 400 }
      );
    }

    // Basic URL validation
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json(
        { success: false, error: "Invalid URL format" } as SwaggerProxyResponse,
        { status: 400 }
      );
    }

    // Only allow http and https protocols
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { success: false, error: "Only HTTP and HTTPS URLs are supported" } as SwaggerProxyResponse,
        { status: 400 }
      );
    }

    // Fetch the swagger spec with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Accept": "application/json, application/yaml, */*",
          "User-Agent": "Swagger-Extractor/1.0",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return NextResponse.json(
          {
            success: false,
            error: `HTTP ${response.status}: ${response.statusText}`
          } as SwaggerProxyResponse,
          { status: response.status }
        );
      }

      // Try to parse as JSON
      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();

      // Try to parse as JSON
      try {
        const data = JSON.parse(text);
        return NextResponse.json({ success: true, data } as SwaggerProxyResponse);
      } catch {
        // If it's not JSON, check if it might be YAML
        if (contentType.includes("yaml") || text.trim().startsWith("openapi:") || text.trim().startsWith("swagger:")) {
          return NextResponse.json(
            {
              success: false,
              error: "YAML format detected. Please provide a JSON URL or convert to JSON first."
            } as SwaggerProxyResponse,
            { status: 400 }
          );
        }
        return NextResponse.json(
          { success: false, error: "Response is not valid JSON" } as SwaggerProxyResponse,
          { status: 400 }
        );
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        return NextResponse.json(
          { success: false, error: "Request timeout (30s)" } as SwaggerProxyResponse,
          { status: 408 }
        );
      }
      throw fetchError;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: `Failed to fetch: ${errorMessage}` } as SwaggerProxyResponse,
      { status: 500 }
    );
  }
}
