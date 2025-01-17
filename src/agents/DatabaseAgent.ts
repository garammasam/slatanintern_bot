import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IDatabaseAgent, Show, Project, ProjectTrack, ArtistInfo } from '../types';

interface SearchQuery {
  type: 'ARTIST' | 'SONG' | 'SHOW';
  query: string;
}

export class DatabaseAgent implements IDatabaseAgent {
  private supabase: SupabaseClient;
  private readonly COMMON_PREFIXES = ['apa', 'mana', 'bila', 'kenapa', 'siapa'];
  private readonly MUSIC_KEYWORDS = ['lagu', 'song', 'release', 'album', 'single', 'track'];
  private readonly SHOW_KEYWORDS = ['show', 'gig', 'concert', 'perform'];

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
    // Convert to lowercase and remove common prefixes
    let normalizedText = text.toLowerCase();
    this.COMMON_PREFIXES.forEach(prefix => {
      normalizedText = normalizedText.replace(new RegExp(`^${prefix}\\s+`), '');
    });

    // Extract the main query and determine type
    const words = normalizedText.split(' ');
    let type: SearchQuery['type'] = 'ARTIST';
    let queryWords: string[] = [];

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      
      // Check for music-related keywords
      if (this.MUSIC_KEYWORDS.includes(word)) {
        type = 'SONG';
        // Take the words after the keyword
        queryWords = words.slice(i + 1);
        break;
      }
      
      // Check for show-related keywords
      if (this.SHOW_KEYWORDS.includes(word)) {
        type = 'SHOW';
        // Take the words after the keyword
        queryWords = words.slice(i + 1);
        break;
      }

      queryWords.push(word);
    }

    return {
      type,
      query: queryWords.join(' ').trim()
    };
  }

  private formatCatalogResponse(catalogs: any[]): string {
    if (catalogs.length === 0) return '';

    return catalogs
      .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
      .map(catalog => {
        const date = new Date(catalog.release_date).toLocaleDateString('en-MY');
        return `${catalog.title} (${date})`;
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
    const { data: catalogs, error: catalogError } = await this.supabase
      .from('catalogs')
      .select()
      .textSearch('artist', query, {
        type: 'websearch',
        config: 'english'
      })
      .order('release_date', { ascending: false });

    if (catalogError) {
      console.error('❌ DatabaseAgent: Error searching catalogs:', catalogError);
      return null;
    }

    return catalogs;
  }

  private async searchSong(query: string): Promise<any> {
    const { data: catalogs, error: catalogError } = await this.supabase
      .from('catalogs')
      .select()
      .textSearch('title', query, {
        type: 'websearch',
        config: 'english'
      })
      .order('release_date', { ascending: false });

    if (catalogError) {
      console.error('❌ DatabaseAgent: Error searching songs:', catalogError);
      return null;
    }

    return catalogs;
  }

  public async processArtistQuery(text: string): Promise<string> {
    try {
      console.log(`🔍 DatabaseAgent: Processing query: "${text}"`);
      const parsedQuery = this.parseQuery(text);
      console.log('Parsed Query:', parsedQuery);

      let response = '';

      switch (parsedQuery.type) {
        case 'SONG': {
          const results = await this.searchSong(parsedQuery.query);
          if (results && results.length > 0) {
            response = `Songs found:\n${this.formatCatalogResponse(results)}`;
          } else {
            response = 'Eh sori, tak jumpa lagu tu 😅';
          }
          break;
        }
        
        case 'SHOW': {
          const { data: shows } = await this.supabase
            .from('shows')
            .select()
            .filter('artists', 'cs', `{${parsedQuery.query}}`)
            .eq('status', 'upcoming');

          if (shows && shows.length > 0) {
            response = `Upcoming shows:\n${this.formatShowResponse(shows)}`;
          } else {
            response = 'Takde show coming up la 😅';
          }
          break;
        }
        
        default: {
          // Search for artist info
          const results = await this.searchArtist(parsedQuery.query);
          if (results && results.length > 0) {
            response = `Latest releases:\n${this.formatCatalogResponse(results)}`;
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