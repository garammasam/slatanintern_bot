import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

// Initialize Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL || '',
    process.env.SUPABASE_ANON_KEY || ''
);

async function checkDatabase() {
    console.log('Starting comprehensive database check...\n');

    // Check catalogs table
    console.log('Checking catalogs table...');
    const { data: catalogs, error: catalogError } = await supabase
        .from('catalogs')
        .select('*');

    if (catalogError) {
        console.error('Error fetching catalogs:', catalogError);
        return;
    }

    console.log(`Found ${catalogs.length} total catalog entries\n`);

    // Create a set of all unique artists
    const uniqueArtists = new Set<string>();
    catalogs.forEach(catalog => {
        if (Array.isArray(catalog.artist)) {
            catalog.artist.forEach((artist: string) => uniqueArtists.add(artist.toLowerCase()));
        }
    });

    console.log(`Found ${uniqueArtists.size} unique artists in catalogs:\n`);
    console.log(Array.from(uniqueArtists).sort().join(', '), '\n');

    // Test specific artist searches
    const testArtists = ['jaystation', 'JAYSTATION', 'offgrid', 'OFFGRID', 'maatjet', 'MAATJET'];
    
    console.log('Testing specific artist searches...\n');
    for (const artist of testArtists) {
        console.log(`\nSearching for artist: "${artist}"`);
        
        // Test exact match
        const { data: exactMatches, error: exactError } = await supabase
            .from('catalogs')
            .select('*')
            .filter('artist', 'cs', `{"${artist}"}`);

        if (exactError) {
            console.error(`Error in exact match search for ${artist}:`, exactError);
        } else {
            console.log(`Exact matches for "${artist}": ${exactMatches?.length || 0}`);
            if (exactMatches?.length) {
                exactMatches.forEach(match => {
                    console.log(`- Title: ${match.title}`);
                    console.log(`  Artist array: ${JSON.stringify(match.artist)}`);
                });
            }
        }

        // Test case-insensitive match
        const { data: partialMatches, error: partialError } = await supabase
            .from('catalogs')
            .select('*')
            .filter('artist', 'cs', `{"%${artist.toLowerCase()}%"}`);

        if (partialError) {
            console.error(`Error in partial match search for ${artist}:`, partialError);
        } else {
            console.log(`Partial matches for "${artist}": ${partialMatches?.length || 0}`);
            if (partialMatches?.length) {
                partialMatches.forEach(match => {
                    console.log(`- Title: ${match.title}`);
                    console.log(`  Artist array: ${JSON.stringify(match.artist)}`);
                });
            }
        }
    }

    // Check shows table
    console.log('\nChecking shows table...');
    const { data: shows, error: showsError } = await supabase
        .from('shows')
        .select('*');

    if (showsError) {
        console.error('Error fetching shows:', showsError);
    } else {
        console.log(`Found ${shows.length} total show entries`);
        const showArtists = new Set<string>();
        shows.forEach(show => {
            if (Array.isArray(show.artists)) {
                show.artists.forEach((artist: string) => showArtists.add(artist.toLowerCase()));
            }
        });
        console.log('Unique artists in shows:', Array.from(showArtists).sort().join(', '), '\n');
    }

    // Check projects table
    console.log('Checking projects table...');
    const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('*');

    if (projectsError) {
        console.error('Error fetching projects:', projectsError);
    } else {
        console.log(`Found ${projects.length} total project entries`);
        const projectArtists = new Set<string>();
        projects.forEach(project => {
            if (project.artist) projectArtists.add(project.artist.toLowerCase());
            if (Array.isArray(project.collaborators)) {
                project.collaborators.forEach((artist: string) => projectArtists.add(artist.toLowerCase()));
            }
        });
        console.log('Unique artists in projects:', Array.from(projectArtists).sort().join(', '), '\n');
    }
}

// Run the check
checkDatabase().catch(console.error); 