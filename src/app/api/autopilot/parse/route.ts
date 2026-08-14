import { NextResponse } from 'next/server';
import { TaskParser } from '@/lib/agent/taskParser';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const parser = new TaskParser();
    // In taskParser.ts we use the LLM to interpret the intent.
    const parsedTask = await parser.parseTaskRequest(prompt);

    return NextResponse.json({ task: parsedTask });
  } catch (error: any) {
    console.error('Error parsing task:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
