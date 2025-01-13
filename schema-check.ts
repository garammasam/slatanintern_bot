import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://askohprtymqqizfpuqnu.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFza29ocHJ0eW1xcWl6ZnB1cW51Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU5ODUyOTIsImV4cCI6MjA1MTU2MTI5Mn0.NxST0D05kjylIGZP4heonTHW6nP5rDBV013yY30yJ9I'
);

async function validateSearchQueries() {
  console.log('\nValidating search queries...\n');
  
  // Test artist search
  const testArtist = 'Akkimwaru';
  console.log(`Testing search for artist: ${testArtist}`);
  
  // Test catalog search
  const { data: catalogData, error: catalogError } = await supabase
    .from('catalogs')
    .select('*')
    .contains('artist', [testArtist]);
    
  console.log('\nCatalog search results:');
  if (catalogError) {
    console.error('Error:', catalogError);
  } else {
    console.log(`Found ${catalogData?.length || 0} catalog entries`);
    if (catalogData?.length) {
      console.log('Sample entry:', JSON.stringify(catalogData[0], null, 2));
    }
  }
  
  // Test shows search
  const { data: showData, error: showError } = await supabase
    .from('shows')
    .select('*')
    .contains('artists', [testArtist]);
    
  console.log('\nShows search results:');
  if (showError) {
    console.error('Error:', showError);
  } else {
    console.log(`Found ${showData?.length || 0} show entries`);
    if (showData?.length) {
      console.log('Sample entry:', JSON.stringify(showData[0], null, 2));
    }
  }
  
  // Test projects search - using both direct artist match and collaborators
  const { data: projectsArtist, error: projectError1 } = await supabase
    .from('projects')
    .select('*')
    .ilike('artist', `%${testArtist}%`);

  const { data: projectsCollab, error: projectError2 } = await supabase
    .from('projects')
    .select('*')
    .contains('collaborators', [testArtist]);
    
  console.log('\nProjects search results:');
  if (projectError1 || projectError2) {
    console.error('Error:', projectError1 || projectError2);
  } else {
    const projects = [...new Set([...(projectsArtist || []), ...(projectsCollab || [])])];
    console.log(`Found ${projects.length} project entries`);
    if (projects.length) {
      console.log('Sample entry:', JSON.stringify(projects[0], null, 2));
    }
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
  
  console.log(`Total projects in database: ${projects.length}`);
  if (projects.length > 0) {
    console.log('\nSample Project Data:');
    console.log(JSON.stringify(projects[0], null, 2));
    
    console.log('\nUnique artists in projects:');
    const uniqueArtists = new Set(projects.map(p => p.artist));
    console.log(Array.from(uniqueArtists));
    
    console.log('\nUnique collaborators:');
    const uniqueCollaborators = new Set(projects.flatMap(p => p.collaborators || []));
    console.log(Array.from(uniqueCollaborators));
  }
}

async function checkTables() {
  console.log('Checking Supabase tables structure...\n');

  // Check catalogs table
  const { data: catalogData, error: catalogError } = await supabase
    .from('catalogs')
    .select('*')
    .limit(1);

  console.log('CATALOGS table:');
  if (catalogError) {
    console.error('Error accessing catalogs:', catalogError);
  } else {
    console.log('Structure:', catalogData && catalogData[0] ? Object.keys(catalogData[0]) : 'No data');
    if (catalogData?.[0]) {
      console.log('\nColumn types:');
      Object.entries(catalogData[0]).forEach(([key, value]) => {
        console.log(`${key}: ${Array.isArray(value) ? 'array' : typeof value}`);
      });
    }
  }

  // Check shows table
  const { data: showData, error: showError } = await supabase
    .from('shows')
    .select('*')
    .limit(1);

  console.log('\nSHOWS table:');
  if (showError) {
    console.error('Error accessing shows:', showError);
  } else {
    console.log('Structure:', showData && showData[0] ? Object.keys(showData[0]) : 'No data');
    if (showData?.[0]) {
      console.log('\nColumn types:');
      Object.entries(showData[0]).forEach(([key, value]) => {
        console.log(`${key}: ${Array.isArray(value) ? 'array' : typeof value}`);
      });
    }
  }

  // Check projects table
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .limit(1);

  console.log('\nPROJECTS table:');
  if (projectError) {
    console.error('Error accessing projects:', projectError);
  } else {
    console.log('Structure:', projectData && projectData[0] ? Object.keys(projectData[0]) : 'No data');
    if (projectData?.[0]) {
      console.log('\nColumn types:');
      Object.entries(projectData[0]).forEach(([key, value]) => {
        console.log(`${key}: ${Array.isArray(value) ? 'array' : typeof value}`);
      });
    }
  }
  
  await validateSearchQueries();
  await checkProjectsTable();
}

checkTables(); 