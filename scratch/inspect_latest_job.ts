import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function main() {
  const { data, error } = await supabase
    .from('wordpress_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);
    
  if (error) {
    console.error(error);
  } else {
    for (const job of data) {
        console.log("Job ID:", job.id, "| Status:", job.status, "| Type:", job.job_type);
        if (job.error_message) console.log("Error:", job.error_message);
        if (job.payload?.content) {
            console.log("Content preview:", job.payload.content.substring(0, 300));
        }
        console.log("----------------------");
    }
  }
}
main();
