import { type NextRequest, NextResponse } from "next/server";

import { getLocalApiBaseUrl } from "@/lib/api-server/local-server";

type RouteParams = Record<string, string | string[] | undefined>;
type MethodHandler = (request: NextRequest, context: { params?: Promise<RouteParams> | RouteParams }) => Promise<NextResponse>;
type RouteHandlerMap = Partial<Record<"GET" | "POST" | "PUT" | "PATCH" | "DELETE", MethodHandler>>;

function normalizeSegmentValue(value: string | string[]): string {
  if (Array.isArray(value)) return value.map((part) => encodeURIComponent(part)).join("/");
  return encodeURIComponent(value);
}

export function buildApiPath(template: string, params: RouteParams = {}): string {
  const withBracketParams = template.replace(/\[([^\]]+)\]/g, (_, key: string) => {
    const value = params[key];
    if (typeof value === "undefined") {
      throw new Error(`Missing route param: ${key}`);
    }
    return normalizeSegmentValue(value);
  });

  return withBracketParams.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = params[key];
    if (typeof value === "undefined") {
      throw new Error(`Missing route param: ${key}`);
    }
    return normalizeSegmentValue(value);
  });
}

export async function proxyApiRequest(request: NextRequest, apiPath: string): Promise<NextResponse> {
  try {
    const query = request.nextUrl.search ?? "";
    const base = await getLocalApiBaseUrl();
    const targetUrl = `${base}/api${apiPath}${query}`;

    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("content-length");

    const init: RequestInit = {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
      redirect: "manual",
    };

    const upstream = await fetch(targetUrl, init);
    const body = await upstream.arrayBuffer();
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete("content-encoding");
    responseHeaders.delete("transfer-encoding");

    return new NextResponse(body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        message: "API route proxy failed before reaching backend handler.",
        detail,
        hint:
          "Ensure server env vars are set (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET). If deployed on Vercel, set them in the frontend project Environment Variables and redeploy.",
      },
      { status: 500 }
    );
  }
}

export function createRouteHandlers(template: string, methods: Array<keyof RouteHandlerMap>): RouteHandlerMap {
  const map: RouteHandlerMap = {};
  const handle: MethodHandler = async (request, context) => {
    try {
      const paramsInput = context.params ? await context.params : {};
      const apiPath = buildApiPath(template, paramsInput ?? {});
      return proxyApiRequest(request, apiPath);
    } catch (e) {
      const detail = e instanceof Error ? e.message : String(e);
      return NextResponse.json(
        {
          message: "API route handler failed before proxying request.",
          detail,
          hint:
            "If this happens on Vercel, make sure the latest commit is deployed and server env vars are set for the frontend project.",
        },
        { status: 500 }
      );
    }
  };

  for (const method of methods) {
    map[method] = handle;
  }
  return map;
}
