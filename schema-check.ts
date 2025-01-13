import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://askohprtymqqizfpuqnu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFza29ocHJ0eW1xcWl6ZnB1cW51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5ODUyOTIsImV4cCI6MjA1MTU2MTI5Mn0.NxST0D05kjylIGZP4heonTHW6nP5rDBV013yY30yJ9I'
);

async function checkTables() {
  // Try some common table names
  const tables = ['artist', 'artists', 'track', 'tracks', 'event', 'events', 'slatan_artist', 'slatan_track', 'slatan_event'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);
    
    if (!error) {
      console.log(`Found table "${table}":`);
      console.log('Sample data:', data);
    }
  }
}

checkTables(); 