import { NextRequest, NextResponse } from "next/server";

export interface ProxyRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

/**
 * API Route to proxy HTTP requests
 * This avoids CORS issues when testing APIs from the browser
 */
export async function POST(request: NextRequest) {
  try {
    const { url, method, headers, body } = (await request.json()) as ProxyRequest;

    // Validate URL
    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // Validate method
    const validMethods = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
    if (!validMethods.includes(method.toUpperCase())) {
      return NextResponse.json(
        { error: "Invalid HTTP method" },
        { status: 400 }
      );
    }

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: headers || {},
    };

    // Add body for methods that support it
    if (body && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
      fetchOptions.body = body;
    }

    // Execute request and measure duration
    const startTime = Date.now();
    const response = await fetch(url, fetchOptions);
    const duration = Date.now() - startTime;

    // Get response body as text
    const responseBody = await response.text();

    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const proxyResponse: ProxyResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration,
    };

    return NextResponse.json(proxyResponse);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Request failed: ${errorMessage}`,
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: "",
        duration: 0,
      } as ProxyResponse & { error: string },
      { status: 500 }
    );
  }
}
