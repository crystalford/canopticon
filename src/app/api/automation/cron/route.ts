import { NextResponse } from 'next/server';

// Other existing imports and the rest of the code

export async function GET(req) {
    const response = await someFunction();
    return NextResponse.json(response);
}
