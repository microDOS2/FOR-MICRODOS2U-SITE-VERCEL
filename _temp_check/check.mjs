
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://fildaxejimuvfrcqmoba.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbGRheGVqaW11dmZyY3Ftb2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDg2OTUsImV4cCI6MjA5MTY4NDY5NX0.Pe3HHtbo1_OiUTSgnq0qGSgzkkcTxRJ01kfOxsv2Gig');

async function main() {
  // Try to query information_schema.triggers
  const { data, error } = await supabase
    .from('information_schema.triggers')
    .select('trigger_name, event_object_table, action_timing, event_manipulation, action_statement')
    .eq('event_object_table', 'orders')
    .ilike('trigger_name', '%invoice%');

  if (error) {
    console.error('Error querying triggers:', JSON.stringify(error));
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

main();
