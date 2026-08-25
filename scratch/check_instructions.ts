import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  console.log('=== Checking Project Memory & Instructions in Supabase ===\n');

  // 1. Check content_rules
  const { data: rules, error: rulesErr } = await supabase.from('content_rules').select('*');
  console.log('--- content_rules table ---');
  if (rulesErr) console.error('Rules error:', rulesErr);
  else console.log(JSON.stringify(rules, null, 2));

  // 2. Check project_memory
  const { data: memories, error: memErr } = await supabase.from('project_memory').select('*');
  console.log('\n--- project_memory table ---');
  if (memErr) console.error('Memory error:', memErr);
  else console.log(JSON.stringify(memories, null, 2));

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
