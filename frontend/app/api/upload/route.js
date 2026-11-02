import { NextResponse } from 'next/server';

export async function POST(request) {
  const form = await request.formData();
  try {
    const res = await fetch('http://localhost:5000/upload', { method: 'POST', body: form });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Backend not reachable' }, { status: 500 });
  }
}