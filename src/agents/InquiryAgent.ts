import { IInquiryAgent, IDatabaseAgent, Project, Show, CatalogTrack, ProjectTrack } from '../types';
import { PersonalityService } from '../services/PersonalityService';

export class InquiryAgent implements IInquiryAgent {
  private databaseAgent: IDatabaseAgent;
  private personalityService: PersonalityService;
  private merchKeywords = {
    words: ['merch', 'merchandise', 'baju', 'tshirt', 't-shirt', 'tee', 'hoodie', 'cap', 'snapback', 'bundle', 'store', 'shop', 'kedai', 'beli', 'buy', 'cop'],
    regex: /\b(merch|merchandise|baju|tshirt|t-shirt|tee|hoodie|cap|snapback|bundle|store|shop|kedai|beli|buy|cop)\b/i
  };

  private socialKeywords = {
    words: ['ig', 'instagram', 'insta', 'social', 'socmed', 'media', 'follow'],
    regex: /\b(ig|instagram|insta|social|socmed|media|follow)\b/i
  };

  constructor(databaseAgent: IDatabaseAgent) {
    console.log('🔍 InquiryAgent: Initializing...');
    this.databaseAgent = databaseAgent;
    this.personalityService = new PersonalityService();
  }

  public async initialize(): Promise<void> {
    console.log('🔍 InquiryAgent: Ready to handle inquiries');
  }

  public async shutdown(): Promise<void> {
    console.log('🔍 InquiryAgent: Shutting down');
  }

  public isMerchInquiry(text: string): boolean {
    console.log('🔍 InquiryAgent: Checking for merch inquiry');
    return this.merchKeywords.regex.test(text);
  }

  public isSocialInquiry(text: string): boolean {
    console.log('🔍 InquiryAgent: Checking for social media inquiry');
    return this.socialKeywords.regex.test(text);
  }

  public handleMerchInquiry(): string {
    const baseResponses = [
      "SLATAN merch available at @dataran.online (IG) and dataran.online!",
      "Get your SLATAN drip at @dataran.online on IG or dataran.online!",
      "SLATAN merch dropping at @dataran.online (IG) and dataran.online!",
      "Need that SLATAN drip? @dataran.online on IG or dataran.online!"
    ];

    const baseResponse = baseResponses[Math.floor(Math.random() * baseResponses.length)];
    const enhancedResponse = this.personalityService.addPersonalityParticles(baseResponse, 'hype');
    
    // Add catchphrase for extra personality
    if (Math.random() < 0.3) {
      return `${this.personalityService.getCatchPhrase()} ${enhancedResponse}`;
    }

    return enhancedResponse;
  }

  public handleSocialInquiry(): string {
    const baseResponses = [
      "Follow SLATAN on Instagram @lebuhrayaselatan for all the latest updates!",
      "Stay updated with SLATAN! Follow our IG @lebuhrayaselatan!",
      "Follow @lebuhrayaselatan on IG to stay in the loop!",
      "@lebuhrayaselatan on Instagram is where all the action's at!"
    ];

    const baseResponse = baseResponses[Math.floor(Math.random() * baseResponses.length)];
    const enhancedResponse = this.personalityService.addPersonalityParticles(baseResponse, 'hype');
    
    // Add catchphrase for extra personality
    if (Math.random() < 0.3) {
      return `${this.personalityService.getCatchPhrase()} ${enhancedResponse}`;
    }

    return enhancedResponse;
  }

  public async handleArtistInquiry(query: string): Promise<string> {
    try {
      const { catalogs, shows, projects } = await this.databaseAgent.searchArtistInfo(query);
      const personalityInfo = this.personalityService.getPersonalityInfo();

      if (query.toLowerCase() === 'slatan' && projects.length > 0) {
        return this.handleProjectResponse(projects[0]);
      }

      let response = `${this.personalityService.getResponseStarter('excitement')} Let me tell you about ${query}!\n\n`;
      
      if (catalogs?.length) {
        const releaseSection = this.formatReleaseSection(catalogs);
        response += this.personalityService.addPersonalityParticles(releaseSection, 'hype') + '\n\n';
      }

      if (shows?.length) {
        const showSection = this.formatShowSection(shows);
        response += this.personalityService.addPersonalityParticles(showSection, 'hype') + '\n\n';
      }

      if (projects?.length) {
        const projectSection = this.formatProjectSection(projects, query);
        response += this.personalityService.addPersonalityParticles(projectSection, 'hype') + '\n\n';
      }

      if (!catalogs?.length && !shows?.length && !projects?.length) {
        return this.personalityService.addPersonalityParticles(
          `Eh sori, tak jumpa nothing bout ${query} rn! But stay tuned, confirm ada something coming! 🔥`,
          'sympathy'
        );
      }

      // Add a random catchphrase as closing
      response += this.personalityService.getCatchPhrase();
      
      return response;

    } catch (error) {
      console.error('Error in artist inquiry:', error);
      return this.personalityService.addPersonalityParticles(
        'YO GANG my brain stopped working fr fr! Try again later bestieee!',
        'confusion'
      );
    }
  }

  private formatReleaseSection(catalogs: CatalogTrack[]): string {
    let section = `🎵 RELEASES (${catalogs.length} TRACKS)!\n`;
    catalogs.slice(0, 5).forEach((track: CatalogTrack) => {
      section += `- "${track.title}" DROPPED ON ${track.release_date || ''} (${track.duration || ''})!\n`;
    });
    if (catalogs.length > 5) {
      section += `+ ${catalogs.length - 5} MORE TRACKS OTW!\n`;
    }
    return section;
  }

  private formatShowSection(shows: Show[]): string {
    let section = `🎪 SHOWS (${shows.length})!\n`;
    shows.slice(0, 3).forEach((show: Show) => {
      section += `- "${show.title}" at ${show.venue} on ${show.date}!\n`;
    });
    if (shows.length > 3) {
      section += `+ ${shows.length - 3} MORE SHOWS COMING UP!\n`;
    }
    return section;
  }

  private formatProjectSection(projects: Project[], artistName: string): string {
    let section = `🎹 PROJECTS (${projects.length})!\n`;
    projects.slice(0, 3).forEach((project: Project) => {
      const status = project.status === 'IN_PROGRESS' ? '🔄' : '✅';
      
      const featuredTracks = project.tracks
        .filter((track: ProjectTrack) => 
          track.features?.some((f: string) => f.toLowerCase() === artistName.toLowerCase())
        )
        .map((track: ProjectTrack) => ({
          title: track.title,
          status: track.status,
          features: track.features
        }));
      
      section += `${status} "${project.title}" (${project.genre})\n`;
      if (featuredTracks.length) {
        featuredTracks.forEach(track => {
          const features = track.features
            .filter(f => f.toLowerCase() !== artistName.toLowerCase())
            .join(', ');
          
          const streetStatus = this.getStreetStatus(track.status);
          section += `  • "${track.title}" (${streetStatus}) with ${features}!\n`;
        });
      }
    });
    if (projects.length > 3) {
      section += `+ ${projects.length - 3} MORE PROJECTS IN THE WORKS!\n`;
    }
    return section;
  }

  private getStreetStatus(status: string): string {
    const statusMap: { [key: string]: string } = {
      'MIXING': 'GETTING THAT CRAZY MIX RN',
      'RECORDING': 'IN THE BOOTH NO CAP',
      'MASTERING': 'GETTING THAT MASTER TOUCH FR',
      'WRITING': 'WRITING SOME HEAT'
    };
    return statusMap[status.toUpperCase()] || 'COOKING UP';
  }

  public async handleProjectResponse(project: Project): Promise<string> {
    try {
      let response = `YOOO GANG! 🔥 BROO check out this INSANE project from ${project.artist} called ${project.title}! 🤪 `;
      
      if (project.status === 'IN_PROGRESS') {
        response += `They still COOKING THIS ONE UP fr fr and dropping on ${project.deadline} LESGOOO! 💀\n\n`;
      } else {
        response += `IT'S OUT NOW AND IT'S ABSOLUTE FIRE SHEEESH! 🔥\n\n`;
      }

      response += `CHECK OUT these CRAZY tracks from ${project.title} fr fr:\n\n`;

      project.tracks.forEach((track, index) => {
        const trackNum = index + 1;
        const features = track.features.join(', ');

        response += `${trackNum}. ${track.title} - (${track.status.toLowerCase()}) with the GOATS: ${features} SHEEESH! 🔥\n`;
      });

      const closings = [
        "\n\nNAH FR THIS PROJECT GONNA BE DIFFERENT! 🔥 Stay locked in gang NO CAP!",
        "\n\nIM TELLING U RN this one's gonna be CRAZY! 💫 SUPPORT LOCAL SCENE FR FR!",
        "\n\nTHE LINEUP IS ACTUALLY INSANE BRO! 🎵 More heat otw SHEEESH!",
        "\n\nCANT EVEN HANDLE HOW FIRE THIS IS! 🔥 TGGU JE GANG!"
      ];
      response += closings[Math.floor(Math.random() * closings.length)];

      return response;
    } catch (error) {
      console.error('Error formatting project response:', error);
      return 'YO GANG my brain stopped working fr fr! 💀 Try again later bestieee!';
    }
  }
} 