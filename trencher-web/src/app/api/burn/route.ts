import { NextResponse } from 'next/server';

const CORE_URL = process.env.NEXT_PUBLIC_API_URL;
const API_KEY = process.env.SIGNAL_SERVER_KEY || '';

export async function GET() {
  try {
    const destUrl = `${CORE_URL}/api/burn`;

    const headers = new Headers();
    headers.set('x-api-key', API_KEY);
    headers.set('Content-Type', 'application/json');

    const coreRes = await fetch(destUrl, {
      method: 'GET',
      headers,
    });

    const responseText = await coreRes.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch {
      data = responseText;
    }

    return NextResponse.json(data, { status: coreRes.status });
  } catch (error: any) {
    console.error('[burn-proxy] Error forwarding request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
