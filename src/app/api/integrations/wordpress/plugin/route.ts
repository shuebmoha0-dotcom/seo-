import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    const zipPath = path.join(process.cwd(), 'public', 'downloads', 'seo-autopilot-connector.zip');

    if (!fs.existsSync(zipPath)) {
      return NextResponse.json({ error: 'Plugin archive not found.' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(zipPath);

    return new Response(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="seo-autopilot-connector.zip"',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to download plugin.' }, { status: 500 });
  }
}
