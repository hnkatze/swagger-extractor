import { NextRequest, NextResponse } from "next/server";

export interface ProxyResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
  error?: string;
}

/**
 * Proxy endpoint for file uploads
 * Handles multipart/form-data and binary uploads
 */
export async function POST(request: NextRequest): Promise<NextResponse<ProxyResponse>> {
  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const url = formData.get("url") as string;
    const method = formData.get("method") as string;
    const authHeadersStr = formData.get("authHeaders") as string;
    const file = formData.get("file") as File;
    const contentType = formData.get("contentType") as string | null;

    if (!url || !method) {
      return NextResponse.json({
        status: 0,
        statusText: "Bad Request",
        headers: {},
        body: "",
        duration: 0,
        error: "Missing required fields: url and method",
      });
    }

    // Parse auth headers
    let authHeaders: Record<string, string> = {};
    if (authHeadersStr) {
      try {
        authHeaders = JSON.parse(authHeadersStr);
      } catch {
        // Ignore parse errors
      }
    }

    // Prepare request body and headers
    let requestBody: BodyInit;
    const headers: Record<string, string> = { ...authHeaders };

    if (contentType === "application/octet-stream" || contentType?.startsWith("image/") || contentType?.startsWith("audio/") || contentType?.startsWith("video/")) {
      // Send as binary
      const arrayBuffer = await file.arrayBuffer();
      requestBody = arrayBuffer;
      headers["Content-Type"] = contentType || file.type || "application/octet-stream";
    } else {
      // Send as multipart/form-data
      const targetFormData = new FormData();
      targetFormData.append("file", file, file.name);
      requestBody = targetFormData;
      // Don't set Content-Type for FormData - browser will set it with boundary
    }

    // Make the actual request
    const response = await fetch(url, {
      method,
      headers,
      body: requestBody,
    });

    const duration = Date.now() - startTime;

    // Get response body as text
    const responseBody = await response.text();

    // Convert headers to plain object
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    return NextResponse.json({
      status: 0,
      statusText: "Network Error",
      headers: {},
      body: "",
      duration,
      error: error instanceof Error ? error.message : "Failed to execute request",
    });
  }
}
