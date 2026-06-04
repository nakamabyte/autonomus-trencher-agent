import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

const CORE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001';
const API_KEY = process.env.SIGNAL_SERVER_KEY || '';

async function handleProxy(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await params;
    const session = await getServerSession(authOptions);
    const clientKey = req.headers.get('x-client-key') || req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
    const serverSecret = process.env.CLIENT_SECRET_KEY;

    const subPath = path.join('/');
    const isAgentModeRoute = subPath.match(/^agent\/[^\/]+\/(set-mode|can-go-live|trades)$/);

    let isAuthorized = !!session || (!!serverSecret && !!clientKey && clientKey === serverSecret);

    if (isAgentModeRoute) {
      isAuthorized = true; // Let the core backend validate the agent secret key
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'Unauthorized: Please sign in with GitHub or enter a valid Secret Key.' }, { status: 401 });
    }


    const searchParams = new URL(req.url).searchParams.toString();
    const destUrl = `${CORE_URL}/api/${subPath}${searchParams ? '?' + searchParams : ''}`;

    const headers = new Headers();
    headers.set('x-api-key', API_KEY);
    headers.set('Content-Type', 'application/json');

    if (isAgentModeRoute && clientKey) {
      headers.set('x-agent-key', clientKey);
    }

    const method = req.method;
    let body = undefined;

    if (method !== 'GET' && method !== 'HEAD') {
      body = await req.text();
    }

    const coreRes = await fetch(destUrl, {
      method,
      headers,
      body,
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
    console.error('[core-proxy] Error forwarding request:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export { handleProxy as GET, handleProxy as POST };
