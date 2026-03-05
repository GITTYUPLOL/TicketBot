import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://127.0.0.1:3001/api';

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiPath = '/' + path.join('/');
  const url = new URL(req.url);
  const qs = url.search;

  const headers: Record<string, string> = {};
  // Forward relevant headers
  const env = req.headers.get('x-ticketbot-env');
  if (env) headers['x-ticketbot-env'] = env;
  const contentType = req.headers.get('content-type');
  if (contentType) headers['content-type'] = contentType;

  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      fetchOptions.body = await req.text();
    } catch {
      // no body
    }
  }

  try {
    const res = await fetch(`${BACKEND_URL}${apiPath}${qs}`, fetchOptions);
    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') || 'application/json' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Backend unreachable', detail: String(err) },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const PUT = proxyRequest;
