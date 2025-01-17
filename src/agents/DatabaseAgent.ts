import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IDatabaseAgent, Show, Project, ProjectTrack, ArtistInfo } from '../types';

interface SearchQuery {
  type: 'ARTIST' | 'SONG' | 'SHOW' | 'PROJECT';
  query: string;
  isUpcoming: boolean;
}

export class DatabaseAgent implements IDatabaseAgent {
  private supabase: SupabaseClient;
  private readonly COMMON_PREFIXES = ['apa', 'mana', 'bila', 'kenapa', 'siapa'];
  private readonly MUSIC_KEYWORDS = ['lagu', 'song', 'release', 'album', 'single', 'track'];
  private readonly SHOW_KEYWORDS = ['show', 'gig', 'concert', 'perform'];
  private readonly PROJECT_KEYWORDS = ['project', 'upcoming project', 'collab'];
  private readonly UPCOMING_KEYWORDS = ['upcoming', 'coming', 'next'];

  constructor() {
    console.log('💾 DatabaseAgent: Initializing...');
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
  }

  public async initialize(): Promise<void> {
    try {
      console.log('🔌 DatabaseAgent: Testing database connection...');
      const { data, error } = await this.supabase.from('shows').select('count');
      if (error) throw error;
      console.log('✅ DatabaseAgent: Database connection successful');
    } catch (error) {
      console.error('❌ DatabaseAgent: Database connection failed:', error);
      throw error;
    }
  }

  public async shutdown(): Promise<void> {
    console.log('💾 DatabaseAgent: Shutting down');
  }

  private parseQuery(text: string): SearchQuery {
    let normalizedText = text.toLowerCase()
      .replace(/@\w+/g, '')  // Remove bot mentions
      .trim();
    
    // Remove common prefixes
    this.COMMON_PREFIXES.forEach(prefix => {
      normalizedText = normalizedText.replace(new RegExp(`^${prefix}\\s+`), '');
    });

    // Check for upcoming shows/projects first
    const isUpcoming = this.UPCOMING_KEYWORDS.some(keyword => normalizedText.includes(keyword));
    
    // Extract the main query and determine type
    const words = normalizedText.split(' ');
    let type: SearchQuery['type'] = 'ARTIST';
    let queryWords: string[] = [];
    let foundKeyword = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Check for project keywords
      if (this.PROJECT_KEYWORDS.some(keyword => normalizedText.includes(keyword))) {
        type = 'PROJECT';
        // Take the remaining words as the query
        queryWords = words.slice(i + 1);
        foundKeyword = true;
        break;
      }
      
      // Check for show keywords
      if (this.SHOW_KEYWORDS.some(keyword => word.includes(keyword))) {
        type = 'SHOW';
        // Take the remaining words as the query
        queryWords = words.slice(i + 1);
        foundKeyword = true;
        break;
      }
      
      // Check for music keywords
      if (this.MUSIC_KEYWORDS.some(keyword => word.includes(keyword))) {
        type = 'SONG';
        // Take the remaining words as the query
        queryWords = words.slice(i + 1);
        foundKeyword = true;
        break;
      }

      if (!foundKeyword) {
        queryWords.push(word);
      }
    }

    // Clean up query
    const query = queryWords.join(' ')
      .replace(/[?!.,]/g, '')  // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();

    return {
      type,
      query: query,
      isUpcoming
    };
  }

  private formatCatalogResponse(catalogs: any[]): string {
    if (catalogs.length === 0) return '';

    return catalogs
      .map(catalog => {
        const date = new Date(catalog.release_date).toLocaleDateString('en-MY');
        const artists = Array.isArray(catalog.artist) ? catalog.artist.join(', ') : catalog.artist;
        return `${catalog.title} - ${artists} (${date})`;
      })
      .join('\n');
  }

  private formatShowResponse(shows: Show[]): string {
    if (shows.length === 0) return '';

    return shows
      .filter(show => show.status === 'upcoming')
      .map(show => {
        const date = new Date(show.date).toLocaleDateString('en-MY');
        return `${show.title} at ${show.venue} (${date})`;
      })
      .join('\n');
  }

  private formatProjectResponse(projects: Project[]): string {
    if (projects.length === 0) return '';

    return projects
      .sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime())
      .map(project => `${project.title} (${project.status})`).join('\n');
  }

  private async searchArtist(query: string): Promise<any> {
    // Try all possible case variations
    const queries = [
      query.toLowerCase(),  // all lowercase
      query.toUpperCase(),  // all uppercase
      query,               // original case
      query.charAt(0).toUpperCase() + query.slice(1).toLowerCase(), // Proper case
      ...query.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Handle multi-word names
    ];

    let allMatches: any[] = [];
    
    for (const q of queries) {
      const { data, error } = await this.supabase
        .from('catalogs')
        .select()
        .filter('artist', 'cs', `{"${q}"}`);

      if (error) {
        console.error(`❌ DatabaseAgent: Error searching catalogs for "${q}":`, error);
        continue;
      }

      if (data) {
        allMatches = [...allMatches, ...data];
      }
    }

    // Remove duplicates and sort by date
    return Array.from(new Set(allMatches.map(m => JSON.stringify(m))))
      .map(s => JSON.parse(s))
      .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime());
  }

  private async searchShows(query: string, upcomingOnly: boolean = true): Promise<any> {
    // Try all possible case variations
    const queries = [
      query.toLowerCase(),  // all lowercase
      query.toUpperCase(),  // all uppercase
      query,               // original case
      query.charAt(0).toUpperCase() + query.slice(1).toLowerCase(), // Proper case
      ...query.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Handle multi-word names
    ];

    let allShows: any[] = [];
    
    for (const q of queries) {
      const { data, error } = await this.supabase
        .from('shows')
        .select()
        .filter('artists', 'cs', `{"${q}"}`);

      if (error) {
        console.error(`❌ DatabaseAgent: Error searching shows for "${q}":`, error);
        continue;
      }

      if (data) {
        allShows = [...allShows, ...data];
      }
    }

    // Filter upcoming shows if requested
    if (upcomingOnly) {
      allShows = allShows.filter(show => 
        new Date(show.date).getTime() > new Date().getTime()
      );
    }

    // Remove duplicates and sort by date
    return Array.from(new Set(allShows.map(s => JSON.stringify(s))))
      .map(s => JSON.parse(s))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private async searchProjects(query: string, upcomingOnly: boolean = true): Promise<any> {
    const { data: allProjects, error } = await this.supabase
      .from('projects')
      .select('*');

    if (error) {
      console.error('❌ DatabaseAgent: Error searching projects:', error);
      return [];
    }

    // Try all possible case variations for comparison
    const queries = [
      query.toLowerCase(),  // all lowercase
      query.toUpperCase(),  // all uppercase
      query,               // original case
      query.charAt(0).toUpperCase() + query.slice(1).toLowerCase(), // Proper case
      ...query.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Handle multi-word names
    ];

    // Filter projects where artist appears in any capacity
    let projects = allProjects.filter(project => {
      return queries.some(q => {
        const isMainArtist = project.artist === q;
        const isCollaborator = project.collaborators.some((c: string) => c === q);
        const isFeatureArtist = project.tracks.some((track: ProjectTrack) => 
          track.features?.some((f: string) => f === q)
        );
        return isMainArtist || isCollaborator || isFeatureArtist;
      });
    });

    // Filter for upcoming projects if requested
    if (upcomingOnly) {
      projects = projects.filter(project => 
        project.status === 'upcoming' || project.status === 'in_progress'
      );
    }

    return projects.sort((a, b) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
  }

  public async processArtistQuery(text: string): Promise<string> {
    try {
      console.log(`🔍 DatabaseAgent: Processing query: "${text}"`);
      const parsedQuery = this.parseQuery(text);
      console.log('Parsed Query:', parsedQuery);

      let response = '';

      switch (parsedQuery.type) {
        case 'SONG': {
          const results = await this.searchArtist(parsedQuery.query);
          if (results && results.length > 0) {
            response = `Songs by ${parsedQuery.query}:\n${this.formatCatalogResponse(results)}`;
          } else {
            response = 'Eh sori, tak jumpa lagu tu 😅';
          }
          break;
        }
        
        case 'SHOW': {
          const shows = await this.searchShows(parsedQuery.query, parsedQuery.isUpcoming);
          if (shows && shows.length > 0) {
            response = `${parsedQuery.isUpcoming ? 'Upcoming' : 'All'} shows for ${parsedQuery.query}:\n${this.formatShowResponse(shows)}`;
          } else {
            response = parsedQuery.isUpcoming ? 
              'Takde show coming up la 😅' : 
              'Takde show dalam database 😅';
          }
          break;
        }

        case 'PROJECT': {
          const projects = await this.searchProjects(parsedQuery.query, parsedQuery.isUpcoming);
          if (projects && projects.length > 0) {
            response = `${parsedQuery.isUpcoming ? 'Upcoming' : 'All'} projects for ${parsedQuery.query}:\n${this.formatProjectResponse(projects)}`;
          } else {
            response = parsedQuery.isUpcoming ?
              'Takde upcoming project la 😅' :
              'Takde project dalam database 😅';
          }
          break;
        }
        
        default: {
          // Search for artist info
          const results = await this.searchArtist(parsedQuery.query);
          if (results && results.length > 0) {
            response = `Latest releases by ${parsedQuery.query}:\n${this.formatCatalogResponse(results)}`;
          } else {
            response = 'Eh sori, tak jumpa artist tu 😅';
          }
        }
      }

      return response;

    } catch (error) {
      console.error('❌ DatabaseAgent: Error processing artist query:', error);
      return 'Alamak error la pulak. Try again later k? 😅';
    }
  }

  public async searchArtistInfo(query: string): Promise<ArtistInfo> {
    try {
      console.log(`🔍 DatabaseAgent: Searching for artist "${query}"...`);
      const normalizedQuery = query.toLowerCase().trim();
      
      // Search catalogs
      console.log('📚 DatabaseAgent: Searching catalogs...');
      const { data: catalogs, error: catalogError } = await this.supabase
        .from('catalogs')
        .select()
        .filter('artist', 'cs', `{${normalizedQuery}}`)
        .order('release_date', { ascending: false });

      if (catalogError) {
        console.error('❌ DatabaseAgent: Error searching catalogs:', catalogError);
      }

      // Search shows
      console.log('🎫 DatabaseAgent: Searching shows...');
      const { data: shows, error: showError } = await this.supabase
        .from('shows')
        .select()
        .filter('artists', 'cs', `{${normalizedQuery}}`)
        .eq('status', 'upcoming')
        .order('date', { ascending: true });

      if (showError) {
        console.error('❌ DatabaseAgent: Error searching shows:', showError);
      }

      // Search projects
      console.log('📋 DatabaseAgent: Searching projects...');
      const { data: allProjects, error: projectError } = await this.supabase
        .from('projects')
        .select('*');

      if (projectError) {
        console.error('❌ DatabaseAgent: Error searching projects:', projectError);
        return {
          catalogs: catalogs || [],
          shows: shows || [],
          projects: []
        };
      }

      // Filter projects where artist appears in any capacity
      const projects = allProjects.filter(project => {
        const isMainArtist = project.artist.toLowerCase() === normalizedQuery;
        const isCollaborator = project.collaborators.some((c: string) => c.toLowerCase() === normalizedQuery);
        const isFeatureArtist = project.tracks.some((track: ProjectTrack) => 
          track.features?.some((f: string) => f.toLowerCase() === normalizedQuery)
        );
        return isMainArtist || isCollaborator || isFeatureArtist;
      });

      console.log('📊 DatabaseAgent: Search Results Summary:');
      console.log(`- Catalogs: ${catalogs?.length || 0}`);
      console.log(`- Shows: ${shows?.length || 0}`);
      console.log(`- Projects: ${projects?.length || 0}`);

      return {
        catalogs: catalogs || [],
        shows: shows || [],
        projects: projects
      };
    } catch (error) {
      console.error('❌ DatabaseAgent: Error in searchArtistInfo:', error);
      return {
        catalogs: [],
        shows: [],
        projects: []
      };
    }
  }

  public async getUpcomingShows(): Promise<Show[]> {
    try {
      const { data, error } = await this.supabase
        .from('shows')
        .select('*')
        .eq('status', 'upcoming')
        .order('date', { ascending: true });
      
      if (error) {
        console.error('Error fetching shows:', error);
        return [];
      }
      return data;
    } catch (error) {
      console.error('Error in getUpcomingShows:', error);
      return [];
    }
  }

  public async getProjects(status?: 'IN_PROGRESS' | 'COMPLETED'): Promise<Project[]> {
    try {
      let query = this.supabase
        .from('projects')
        .select('*')
        .order('deadline', { ascending: true });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching projects:', error);
        return [];
      }
      return data;
    } catch (error) {
      console.error('Error in getProjects:', error);
      return [];
    }
  }
} 