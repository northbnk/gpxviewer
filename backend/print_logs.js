const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '';

if (!url || !key) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data, error } = await supabase
    .from('log_operation')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch logs:', error.message || error);
    process.exit(1);
  }

  for (const row of data) {
    console.log(
      `[${row.created_at}] uid=${row.uid} operation=${row.operation} details=${row.details}`
    );
  }
}

main();
