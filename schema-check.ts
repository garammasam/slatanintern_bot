import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://askohprtymqqizfpuqnu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFza29ocHJ0eW1xcWl6ZnB1cW51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5ODUyOTIsImV4cCI6MjA1MTU2MTI5Mn0.NxST0D05kjylIGZP4heonTHW6nP5rDBV013yY30yJ9I'
);

async function validateSearchQueries() {
  console.log('\nValidating search queries...\n');
  
  // Test artist search with different cases
  const testArtists = ['Nobi', 'nobi', 'NOBI'];
  
  for (const artist of testArtists) {
    console.log(`\nTesting search for artist: "${artist}"`);
    
    // Test catalog search with different methods
    console.log('\nTesting catalog search with different methods:');
    
    // Method 1: Direct array contains
    const { data: catalogData1, error: catalogError1 } = await supabase
      .from('catalogs')
      .select('*')
      .contains('artist', [artist]);
      
    console.log('\n1. Direct array contains result:');
    if (catalogError1) {
      console.error('Error:', catalogError1);
    } else {
      console.log(`Found ${catalogData1?.length || 0} entries`);
      if (catalogData1?.length) {
        console.log('Sample entries:', catalogData1);
      }
    }

    // Method 2: Case-sensitive array contains
    const { data: catalogData2, error: catalogError2 } = await supabase
      .from('catalogs')
      .select('*')
      .filter('artist', 'cs', `{${artist}}`);
      
    console.log('\n2. Case-sensitive array contains result:');
    if (catalogError2) {
      console.error('Error:', catalogError2);
    } else {
      console.log(`Found ${catalogData2?.length || 0} entries`);
      if (catalogData2?.length) {
        console.log('Sample entries:', catalogData2);
      }
    }

    // Method 3: Case-insensitive array contains
    const { data: catalogData3, error: catalogError3 } = await supabase
      .from('catalogs')
      .select('*')
      .filter('artist', 'cd', `{${artist}}`);
      
    console.log('\n3. Case-insensitive array contains result:');
    if (catalogError3) {
      console.error('Error:', catalogError3);
    } else {
      console.log(`Found ${catalogData3?.length || 0} entries`);
      if (catalogData3?.length) {
        console.log('Sample entries:', catalogData3);
      }
    }
  }
}

async function checkCatalogTable() {
  console.log('\nChecking Catalog Table Content...');
  
  const { data: catalogs, error } = await supabase
    .from('catalogs')
    .select('*');
    
  if (error) {
    console.error('Error fetching catalogs:', error);
    return;
  }
  
  console.log(`\nTotal catalogs in database: ${catalogs.length}`);
  
  if (catalogs.length > 0) {
    console.log('\nAll unique artists in catalogs:');
    const uniqueArtists = new Set(catalogs.flatMap(c => c.artist || []));
    console.log(Array.from(uniqueArtists).sort());
    
    console.log('\nSample of catalog entries:');
    catalogs.slice(0, 5).forEach((catalog, index) => {
      console.log(`\n${index + 1}. Entry:`, {
        title: catalog.title,
        artist: catalog.artist,
        language: catalog.language,
        release_date: catalog.release_date
      });
    });
    
    // Check array structure
    console.log('\nChecking artist array structure in entries:');
    catalogs.forEach((catalog, index) => {
      if (!Array.isArray(catalog.artist)) {
        console.log(`Entry ${index + 1} has non-array artist:`, catalog.artist);
      }
    });
  }
}

async function checkShowsTable() {
  console.log('\nChecking Shows Table Content...');
  
  const { data: shows, error } = await supabase
    .from('shows')
    .select('*');
    
  if (error) {
    console.error('Error fetching shows:', error);
    return;
  }
  
  console.log(`\nTotal shows in database: ${shows.length}`);
  
  if (shows.length > 0) {
    console.log('\nAll unique artists in shows:');
    const uniqueArtists = new Set(shows.flatMap(s => s.artists || []));
    console.log(Array.from(uniqueArtists).sort());
    
    console.log('\nSample of show entries:');
    shows.slice(0, 5).forEach((show, index) => {
      console.log(`\n${index + 1}. Show:`, {
        title: show.title,
        artists: show.artists,
        venue: show.venue,
        date: show.date,
        status: show.status
      });
    });
  }
}

async function checkProjectsTable() {
  console.log('\nChecking Projects Table Content...');
  
  const { data: projects, error } = await supabase
    .from('projects')
    .select('*');
    
  if (error) {
    console.error('Error fetching projects:', error);
    return;
  }
  
  console.log(`\nTotal projects in database: ${projects.length}`);
  
  if (projects.length > 0) {
    console.log('\nAll unique main artists in projects:');
    const uniqueMainArtists = new Set(projects.map(p => p.artist));
    console.log(Array.from(uniqueMainArtists).sort());
    
    console.log('\nAll unique collaborators in projects:');
    const uniqueCollaborators = new Set(projects.flatMap(p => p.collaborators || []));
    console.log(Array.from(uniqueCollaborators).sort());
    
    console.log('\nSample of project entries:');
    projects.slice(0, 5).forEach((project, index) => {
      console.log(`\n${index + 1}. Project:`, {
        title: project.title,
        artist: project.artist,
        collaborators: project.collaborators,
        status: project.status,
        tracks: project.tracks?.length || 0
      });
    });
  }
}

async function runAllChecks() {
  console.log('Starting comprehensive database check...\n');
  
  await checkCatalogTable();
  await checkShowsTable();
  await checkProjectsTable();
  await validateSearchQueries();
  
  console.log('\nDatabase check complete.');
}

runAllChecks(); 