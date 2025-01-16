import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IDatabaseAgent, Show, Project, ProjectTrack } from '../types';

export class DatabaseAgent implements IDatabaseAgent {
  private supabase: SupabaseClient;

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

  public async searchArtistInfo(query: string): Promise<any> {
    try {
      console.log(`🔍 DatabaseAgent: Searching for artist "${query}"...`);
      const normalizedQuery = query.toLowerCase().trim();
      
      // Search catalogs - using case-insensitive array contains
      console.log('📚 DatabaseAgent: Searching catalogs...');
      const { data: catalogs, error: catalogError } = await this.supabase
        .from('catalogs')
        .select()
        .filter('artist', 'cs', `{${normalizedQuery}}`)  // Case-sensitive array contains
        .order('release_date', { ascending: false });

      if (catalogError) {
        console.error('❌ DatabaseAgent: Error searching catalogs:', catalogError);
      } else {
        console.log(`✅ DatabaseAgent: Found ${catalogs?.length || 0} catalogs`);
      }

      // Search shows - using case-insensitive array contains
      console.log('🎫 DatabaseAgent: Searching shows...');
      const { data: shows, error: showError } = await this.supabase
        .from('shows')
        .select()
        .filter('artists', 'cs', `{${normalizedQuery}}`)  // Case-sensitive array contains
        .eq('status', 'upcoming')
        .order('date', { ascending: true });

      if (showError) {
        console.error('❌ DatabaseAgent: Error searching shows:', showError);
      } else {
        console.log(`✅ DatabaseAgent: Found ${shows?.length || 0} shows`);
      }

      // Search projects - check artist, collaborators, and track features
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