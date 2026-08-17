import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path);
}

export async function POST(request: Request, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path);
}

export async function PUT(request: Request, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path);
}

export async function PATCH(request: Request, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path);
}

export async function DELETE(request: Request, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path);
}

async function proxyRequest(request: Request, pathArray: string[]) {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const path = pathArray.join('/');
  
  // Extract token from cookie
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(/accessToken=([^;]+)/);
  const accessToken = match ? match[1] : null;

  const headers = new Headers();
  
  // Pass content-type if present
  const contentType = request.headers.get('content-type');
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Get query params
  const urlObj = new URL(request.url);
  const searchParams = urlObj.search;

  const targetUrl = `${API_URL}/${path}${searchParams}`;
  
  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? await request.text() : undefined,
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (error) {
    return NextResponse.json({ message: 'Proxy Error' }, { status: 500 });
  }
}
