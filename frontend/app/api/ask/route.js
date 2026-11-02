import { NextResponse } from 'next/server';

export async function POST(request) {
  const body = await request.json();
  try {
    const res = await fetch('http://localhost:5000/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ error: 'Failed to get answer' }, { status: 500 });
  }
}