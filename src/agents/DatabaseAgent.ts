import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { IDatabaseAgent, Show, Project, ProjectTrack, ArtistInfo } from '../types';
import { OpenAI } from 'openai';

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
  private readonly LABEL_KEYWORDS = ['label', 'record label', 'roster', 'collective', 'group', 'camp'];
  private readonly SLATAN_ARTISTS = [
    'jaystation', 'maatjet', 'offgrid', 'gard', 'gard wuzgut', 'wuzgut', 
    'johnasa', 'shilky', 'nobi', 'quai', 'ameeusement', 'akkimwaru'
  ];
  private openai: OpenAI;

  constructor() {
    console.log('💾 DatabaseAgent: Initializing...');
    this.supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_KEY || ''
    );
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
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
        // Take all remaining words after "project" as the query
        const projectIndex = words.findIndex(w => w === 'project');
        if (projectIndex !== -1) {
          queryWords = words.slice(projectIndex + 1);
        }
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
    const totalSongs = catalogs.length;
    const formattedCatalogs = catalogs.map(catalog => {
      const title = catalog.title;
      const artist = Array.isArray(catalog.artist) ? catalog.artist.join(', ') : catalog.artist;
      const date = new Date(catalog.release_date).toLocaleDateString('en-MY');
      return `"${title}" by ${artist} (${date})`;
    }).join('\n');

    return `Found ${totalSongs} songs:\n${formattedCatalogs}`;
  }

  private formatShowResponse(shows: Show[]): string {
    const totalShows = shows.length;
    const formattedShows = shows.map(show => {
      const title = show.title;
      const venue = show.venue;
      const date = new Date(show.date).toLocaleDateString('en-MY');
      const artists = Array.isArray(show.artists) ? show.artists.join(', ') : show.artists;
      return `"${title}" at ${venue} on ${date}\nFeaturing: ${artists}`;
    }).join('\n\n');

    return `Found ${totalShows} shows:\n${formattedShows}`;
  }

  private formatProjectResponse(projects: Project[]): string {
    const totalProjects = projects.length;
    const formattedProjects = projects.map(project => {
      const title = project.title;
      const artist = project.artist;
      const status = project.status;
      const genre = project.genre;
      const collaborators = project.collaborators?.join(', ') || 'None';
      
      const trackList = project.tracks.map(track => {
        const features = track.features?.join(', ') || 'None';
        return `- "${track.title}" (${track.status}) ft. ${features}`;
      }).join('\n');

      return `"${title}" by ${artist}\nStatus: ${status}\nGenre: ${genre}\nCollaborators: ${collaborators}\n\nTracks:\n${trackList}`;
    }).join('\n\n');

    return `Found ${totalProjects} projects:\n${formattedProjects}`;
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
        const isMainArtist = project.artist.toLowerCase() === q.toLowerCase();
        const isCollaborator = project.collaborators.some((c: string) => 
          c.toLowerCase() === q.toLowerCase()
        );
        const isFeatureArtist = project.tracks.some((track: ProjectTrack) => 
          track.features?.some((f: string) => f.toLowerCase() === q.toLowerCase())
        );
        return isMainArtist || isCollaborator || isFeatureArtist;
      });
    });

    // Filter for upcoming projects if requested
    if (upcomingOnly) {
      projects = projects.filter(project => 
        project.status === 'IN_PROGRESS' || project.status === 'UPCOMING'
      );
    }

    return projects.sort((a, b) => 
      new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
    );
  }

  private async formatCatalogResponseWithAI(catalogs: any[], query: string): Promise<string> {
    try {
      const catalogInfo = catalogs.map(catalog => ({
        title: catalog.title,
        artist: Array.isArray(catalog.artist) ? catalog.artist.join(', ') : catalog.artist,
        release_date: new Date(catalog.release_date).toLocaleDateString('en-MY')
      }));

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `You are a KL youth who loves the local music scene. Format this catalog info in a fun, engaging way.
            Rules:
            1. Use natural KL Manglish (mix of English/Malay)
            2. Keep it casual but informative
            3. Show excitement about the music
            4. Use appropriate emojis
            5. Keep the total response under 200 words
            6. Include the total number of songs
            7. Use quotes around song titles
            8. Include release dates`
          },
          {
            role: "user",
            content: `Here are ${catalogInfo.length} songs by ${query}:\n${JSON.stringify(catalogInfo, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 250
      });

      const response = completion.choices[0].message.content || this.formatCatalogResponse(catalogs);
      return this.formatTextWithHTML(response);
    } catch (error) {
      console.error('Error formatting catalog with AI:', error);
      return this.formatTextWithHTML(this.formatCatalogResponse(catalogs));
    }
  }

  private async formatShowResponseWithAI(shows: Show[], query: string, isUpcoming: boolean): Promise<string> {
    try {
      const showInfo = shows.map(show => ({
        title: show.title,
        venue: show.venue,
        date: new Date(show.date).toLocaleDateString('en-MY'),
        artists: show.artists,
        status: show.status
      }));

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `You are a KL youth who loves the local music scene. Format this show info in a fun, engaging way.
            Rules:
            1. Use natural KL Manglish (mix of English/Malay)
            2. Keep it casual but informative
            3. Show excitement about the shows
            4. Use appropriate emojis
            5. Keep the total response under 200 words
            6. Include the total number of shows
            7. Highlight venue and date clearly
            8. If it's upcoming shows, create more hype
            9. Use quotes around show titles`
          },
          {
            role: "user",
            content: `Here are ${showInfo.length} ${isUpcoming ? 'upcoming' : ''} shows ${isUpcoming ? 'featuring' : 'by'} ${query}:\n${JSON.stringify(showInfo, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 250
      });

      const response = completion.choices[0].message.content || this.formatShowResponse(shows);
      return this.formatTextWithHTML(response);
    } catch (error) {
      console.error('Error formatting shows with AI:', error);
      return this.formatTextWithHTML(this.formatShowResponse(shows));
    }
  }

  private async formatProjectResponseWithAI(projects: Project[], query: string, isUpcoming: boolean): Promise<string> {
    try {
      const projectInfo = projects.map(project => ({
        title: project.title,
        artist: project.artist,
        status: project.status,
        genre: project.genre,
        collaborators: project.collaborators,
        tracks: project.tracks.map(track => ({
          title: track.title,
          status: track.status,
          features: track.features
        }))
      }));

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `You are a KL youth who loves the local music scene. Format this project info in a fun, engaging way.
            Rules:
            1. Use natural KL Manglish (mix of English/Malay)
            2. Keep it casual but informative
            3. Show excitement about the projects
            4. Use appropriate emojis
            5. Keep the total response under 250 words
            6. Include the total number of projects
            7. Highlight collaborations and features
            8. If tracks are in progress, create hype about them
            9. Use street/modern language for project status
            10. Use quotes around project and track titles`
          },
          {
            role: "user",
            content: `Here are ${projectInfo.length} ${isUpcoming ? 'upcoming' : ''} projects ${isUpcoming ? 'featuring' : 'by'} ${query}:\n${JSON.stringify(projectInfo, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 300
      });

      const response = completion.choices[0].message.content || this.formatProjectResponse(projects);
      return this.formatTextWithHTML(response);
    } catch (error) {
      console.error('Error formatting projects with AI:', error);
      return this.formatTextWithHTML(this.formatProjectResponse(projects));
    }
  }

  private async getLabelInfo(query: string): Promise<any> {
    if (query.toLowerCase() !== 'slatan') return null;

    try {
      // Get all catalogs for SLATAN artists with proper case handling
      const allCatalogs = [];
      const artistCounts = new Map<string, number>();
      
      for (const artist of this.SLATAN_ARTISTS) {
        // Try different case variations
        const variations = [
          artist,
          artist.toUpperCase(),
          artist.toLowerCase(),
          artist.charAt(0).toUpperCase() + artist.slice(1).toLowerCase()
        ];

        for (const variation of variations) {
          const { data, error } = await this.supabase
            .from('catalogs')
            .select('*')
            .filter('artist', 'cs', `{"${variation}"}`);
          
          if (!error && data && data.length > 0) {
            allCatalogs.push(...data);
            artistCounts.set(artist, (artistCounts.get(artist) || 0) + data.length);
            break; // Found matches, no need to try other variations
          }
        }
      }

      // Get all shows
      const { data: shows, error: showError } = await this.supabase
        .from('shows')
        .select('*')
        .filter('status', 'eq', 'upcoming');

      // Get all projects
      const { data: projects, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .filter('status', 'in', '("IN_PROGRESS","UPCOMING")');

      // Get active artists (those with releases)
      const activeArtists = Array.from(artistCounts.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by number of releases
        .map(([artist, count]) => ({ name: artist, releases: count }));

      return {
        catalogs: allCatalogs,
        shows: shows || [],
        projects: projects || [],
        artistCount: this.SLATAN_ARTISTS.length,
        activeArtists: activeArtists,
        totalReleases: allCatalogs.length,
        artistStats: Object.fromEntries(artistCounts)
      };
    } catch (error) {
      console.error('Error getting label info:', error);
      return null;
    }
  }

  public formatTextWithHTML(text: string): string {
    // First, escape all special characters except those used for formatting
    text = text.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');

    // Format numbers with bold (single *)
    text = text.replace(/\\b(\\d+)\\b/g, '*$1*');

    // Format artist names with bold
    const artists = [
      'Akkimwaru', 'Gard Wuzgut', 'Jaystation', 'Maatjet', 
      'Nobi', 'Offgrid', 'Quai', 'Shilky', 'SLATAN'
    ];
    artists.forEach(artist => {
      // Escape special characters in artist name
      const escapedArtist = artist.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
      const regex = new RegExp(`\\b${escapedArtist}\\b`, 'gi');
      text = text.replace(regex, `*${escapedArtist}*`);
    });

    // Handle dates
    const now = new Date();
    
    // Format DD/MM/YYYY dates
    text = text.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g, (match, d, m, y) => {
      const date = new Date(y, m - 1, d);
      if (date < now) {
        text = text.replace(/mark your calendars?|save the dates?|don't forget|remember/gi, 'was released on');
      }
      return `_${d}\\/${m}\\/${y}_`;
    });

    // Format written dates
    text = text.replace(/(\d{1,2})(?:st|nd|rd|th)? (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/gi,
      (match, d, m, y) => {
        const date = new Date(`${m} ${d}, ${y}`);
        if (date < now) {
          text = text.replace(/mark your calendars?|save the dates?|don't forget|remember/gi, 'was released on');
        }
        return `_${d} ${m} ${y}_`;
      }
    );

    // Format song/show titles with quotes and bold
    text = text.replace(/"([^"]+)"/g, (match, title) => {
      const escapedTitle = title.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
      return `*"${escapedTitle}"*`;
    });

    // Format emphasis phrases with italic
    const emphasisPhrases = [
      'upcoming', 'just dropped', 'new release', 'coming soon',
      'in progress', 'completed', 'featured', 'dropping', 'releases',
      'was released', 'has dropped'
    ];
    emphasisPhrases.forEach(phrase => {
      const escapedPhrase = phrase.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
      const regex = new RegExp(`\\b${escapedPhrase}\\b`, 'gi');
      text = text.replace(regex, `_${escapedPhrase}_`);
    });

    // Format section headers with bold
    const headers = [
      'SLATAN Label Stats:', 'Active Artists:', 'Top releases:', 
      'Recent releases:', 'Upcoming shows:', 'Projects:', 'Past releases:'
    ];
    headers.forEach(header => {
      const escapedHeader = header.replace(/([_*[\]()~`>#+=|{}.!-])/g, '\\$1');
      text = text.replace(escapedHeader, `*${escapedHeader}*`);
    });

    // Clean up any nested or malformed markdown
    text = text
      .replace(/\*{3,}/g, '**')  // Fix multiple asterisks
      .replace(/_{3,}/g, '__')    // Fix multiple underscores
      .replace(/([*_])\\s*\1/g, '') // Remove empty formatting
      .replace(/\\\*/g, '*')      // Fix escaped asterisks inside formatting
      .replace(/\\_/g, '_');      // Fix escaped underscores inside formatting

    return text;
  }

  private async formatLabelResponseWithAI(labelInfo: any): Promise<string> {
    try {
      const info = {
        artistCount: labelInfo.artistCount,
        totalReleases: labelInfo.totalReleases,
        upcomingShows: labelInfo.shows.length,
        activeProjects: labelInfo.projects.length,
        artistStats: labelInfo.artistStats,
        activeArtists: labelInfo.activeArtists,
        recentReleases: labelInfo.catalogs
          .sort((a: any, b: any) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())
          .slice(0, 5)
          .map((cat: any) => ({
            title: cat.title,
            artist: Array.isArray(cat.artist) ? cat.artist.join(', ') : cat.artist,
            release_date: new Date(cat.release_date).toLocaleDateString('en-MY')
          }))
      };

      const completion = await this.openai.chat.completions.create({
        model: "gpt-4o-mini-2024-07-18",
        messages: [
          {
            role: "system",
            content: `You are a KL youth who loves the local music scene, especially SLATAN. Format this label info in a fun, engaging way.
            Rules:
            1. Use natural KL Manglish (mix of English/Malay)
            2. Show pride and excitement about the label
            3. Highlight the scale and diversity of the roster
            4. Use appropriate emojis
            5. Keep it informative but casual
            6. Include accurate stats (artist count, total releases)
            7. Mention top artists by release count
            8. Create hype about upcoming releases/shows
            9. Be precise with numbers
            10. If unsure about any stats, say so
            11. Use quotes around song titles and project names`
          },
          {
            role: "user",
            content: `SLATAN Label Info:\n${JSON.stringify(info, null, 2)}`
          }
        ],
        temperature: 0.7,
        max_tokens: 800
      });

      const response = completion.choices[0].message.content || this.formatDefaultLabelResponse(labelInfo);
      return this.formatTextWithHTML(response);
    } catch (error) {
      console.error('Error formatting label info with AI:', error);
      return this.formatDefaultLabelResponse(labelInfo);
    }
  }

  private formatDefaultLabelResponse(labelInfo: any): string {
    const artistsList = labelInfo.activeArtists
      .map((artist: { name: string; releases: number }) => `${artist.name} (${artist.releases} releases)`)
      .join('\n- ');

    const response = `SLATAN Label Stats:
- ${labelInfo.artistCount} Artists in roster
- ${labelInfo.totalReleases} Total Releases
- ${labelInfo.shows.length} Upcoming Shows
- ${labelInfo.projects.length} Active Projects

Active Artists:
- ${artistsList}`;

    return this.formatTextWithHTML(response);
  }

  private isLabelQuery(text: string): boolean {
    const normalizedText = text.toLowerCase();
    return normalizedText.includes('slatan') && 
           (this.LABEL_KEYWORDS.some(keyword => normalizedText.includes(keyword)) ||
            /^(?:apa|berapa|total).*(?:lagu|song|artist|release).*slatan/.test(normalizedText));
  }

  public async processArtistQuery(text: string): Promise<string> {
    try {
      console.log(`🔍 DatabaseAgent: Processing query: "${text}"`);
      
      // Check if it's a label query first
      if (this.isLabelQuery(text)) {
        const labelInfo = await this.getLabelInfo('slatan');
        if (labelInfo) {
          return await this.formatLabelResponseWithAI(labelInfo);
        }
      }

      const parsedQuery = this.parseQuery(text);
      console.log('Parsed Query:', parsedQuery);

      let response = '';

      switch (parsedQuery.type) {
        case 'SONG': {
          const results = await this.searchArtist(parsedQuery.query);
          if (results && results.length > 0) {
            response = await this.formatCatalogResponseWithAI(results, parsedQuery.query);
          } else {
            response = 'Eh sori, tak jumpa lagu tu 😅';
          }
          break;
        }
        
        case 'SHOW': {
          const shows = await this.searchShows(parsedQuery.query, parsedQuery.isUpcoming);
          if (shows && shows.length > 0) {
            response = await this.formatShowResponseWithAI(shows, parsedQuery.query, parsedQuery.isUpcoming);
          } else {
            response = parsedQuery.isUpcoming ? 
              'Takde show coming up la 😅 Nanti kalau ada I update you first k!' : 
              'Takde show dalam database 😅 Check balik later!';
          }
          break;
        }

        case 'PROJECT': {
          const projects = await this.searchProjects(parsedQuery.query, parsedQuery.isUpcoming);
          if (projects && projects.length > 0) {
            response = await this.formatProjectResponseWithAI(projects, parsedQuery.query, parsedQuery.isUpcoming);
          } else {
            response = parsedQuery.isUpcoming ?
              'Takde upcoming project la 😅 But stay tuned, confirm ada something cooking! 🔥' :
              'Takde project dalam database 😅 Check balik later k!';
          }
          break;
        }
        
        default: {
          // Search for artist info
          const results = await this.searchArtist(parsedQuery.query);
          if (results && results.length > 0) {
            response = await this.formatCatalogResponseWithAI(results, parsedQuery.query);
          } else {
            response = 'Eh sori, tak jumpa artist tu 😅 Check ejaan ke? 🤔';
          }
        }
      }

      return this.formatTextWithHTML(response);

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