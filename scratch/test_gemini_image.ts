import { ImageRouter } from '../src/lib/ai/imageRouter';

async function testImageRouter() {
  console.log('Testing ImageRouter.generate...');
  try {
    const res = await ImageRouter.generate({
      topic: 'Clay.com review and comparison',
      target_keyword: 'clay review',
      purpose: 'Featured hero visual',
      style: 'Modern high-tech illustration',
    });
    console.log('ImageRouter success! Provider:', res.provider, 'URL prefix:', res.url.slice(0, 50), 'length:', res.url.length);
  } catch (e: any) {
    console.error('ImageRouter error:', e.message);
  }
}

testImageRouter();
