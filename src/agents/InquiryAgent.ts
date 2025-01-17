import { IInquiryAgent, IDatabaseAgent, Project, Show, CatalogTrack, ProjectTrack } from '../types';

export class InquiryAgent implements IInquiryAgent {
  private databaseAgent: IDatabaseAgent;
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
    const modernMerchResponses = [
      "Yo check it! 🔥 SLATAN merch available at @dataran.online (IG) and dataran.online! Support local fr fr! 💯",
      "The drip you've been waiting for! @dataran.online on IG or dataran.online! 🛍️ No cap, these go hard! 🔥",
      "Demo demo! SLATAN merch dropping at @dataran.online (IG) and dataran.online! Better cop quick before sold out! 🔥",
      "Need that SLATAN drip? @dataran.online on IG or dataran.online is where it's at! Let's get it! 💯"
    ];
    
    return modernMerchResponses[Math.floor(Math.random() * modernMerchResponses.length)];
  }

  public handleSocialInquiry(): string {
    const modernSocialResponses = [
      "YO CHECK! 🔥 Follow SLATAN on Instagram @lebuhrayaselatan for all the latest updates! Real content only! 📱",
      "Stay updated fr fr! Follow our IG @lebuhrayaselatan! We be posting heat! 🔥",
      "Demo! Follow @lebuhrayaselatan on IG to stay in the loop! No cap! 💯",
      "Don't miss out! @lebuhrayaselatan on Instagram is where all the action's at! 🔥"
    ];
    
    return modernSocialResponses[Math.floor(Math.random() * modernSocialResponses.length)];
  }

  public async handleArtistInquiry(query: string): Promise<string> {
    try {
      const { catalogs, shows, projects } = await this.databaseAgent.searchArtistInfo(query);

      if (query.toLowerCase() === 'slatan' && projects.length > 0) {
        return this.handleProjectResponse(projects[0]);
      }

      let response = `YOOO GANG! 🔥 Let me put u on about ${query} FR FR! 🤪\n\n`;
      
      if (catalogs?.length) {
        response += `🎵 RELEASES SHEEESH (${catalogs.length} TRACKS)! 💀\n`;
        catalogs.slice(0, 5).forEach((track: CatalogTrack) => {
          response += `- ${track.title} DROPPED ON ${track.release_date || ''} and its ${track.duration || ''} of PURE HEAT! 🔥\n`;
        });
        if (catalogs.length > 5) response += `NAH FR we got ${catalogs.length - 5} MORE TRACKS but my brain cant handle it rn fr fr\n`;
        response += '\n';
      }

      if (shows?.length) {
        response += `🎪 SHOWS LESGOOO (${shows.length})! 🤪\n`;
        shows.slice(0, 3).forEach((show: Show) => {
          response += `- ${show.title} at ${show.venue} on ${show.date} ITS GONNA BE CRAZY! 💫\n`;
        });
        if (shows.length > 3) response += `BROO we got ${shows.length - 3} MORE SHOWS but im too hyped rn fr fr\n`;
        response += '\n';
      }

      if (projects?.length) {
        response += `🎹 PROJECTS FR FR (${projects.length} BANGERS OTW)! 🔥\n`;
        projects.slice(0, 3).forEach((project: Project) => {
          const status = project.status === 'IN_PROGRESS' ? '🔄' : '✅';
          
          const featuredTracks = project.tracks
            .filter((track: ProjectTrack) => 
              track.features?.some((f: string) => f.toLowerCase() === query.toLowerCase())
            )
            .map((track: ProjectTrack) => ({
              title: track.title,
              status: track.status,
              features: track.features
            }));
          
          response += `- ${status} ${project.title} (${project.genre}) THIS ONE GONNA BE INSANE! 🤯\n`;
          if (featuredTracks.length) {
            featuredTracks.forEach((track: { title: string; status: string; features: string[] }) => {
              const features = track.features
                .filter((f: string) => f.toLowerCase() !== query.toLowerCase())
                .join(', ');
              
              const streetStatus = track.status.toLowerCase() === 'mixing' ? 'GETTING THAT CRAZY MIX RN' : 
                                 track.status.toLowerCase() === 'recording' ? 'IN THE BOOTH NO CAP' :
                                 track.status.toLowerCase() === 'mastering' ? 'GETTING THAT MASTER TOUCH FR' : 
                                 'WRITING SOME HEAT';
              
              response += `  • ${track.title} (${streetStatus}) with the GOATS: ${features} SHEEESH!\n`;
            });
          }
        });
        if (projects.length > 3) response += `NAH FR we got ${projects.length - 3} MORE PROJECTS but im too gassed rn fr fr\n`;
      }

      if (!catalogs?.length && !shows?.length && !projects?.length) {
        return `YO GANG I looked EVERYWHERE but cant find nothing bout ${query} rn fr fr! 😭 BUT WHEN THEY DROP SOMETHING IMMA BE THE FIRST TO TELL U NO CAP! 💯`;
      }

      const closings = [
        "\n\nIM ACTUALLY SHAKING RN FR FR! 🔥 STAY TUNED FOR MORE GANG!",
        "\n\nNAH THIS TOO MUCH HEAT FR! 🤪 MORE BANGERS OTW NO CAP!",
        "\n\nCANT EVEN HANDLE ALL THIS HEAT RN! 💀 LESGOOO!",
        "\n\nSUPPORT LOCAL SCENE OR UR NOT VALID FR FR! 🔥 NO CAP NO CAP!"
      ];
      response += closings[Math.floor(Math.random() * closings.length)];
      
      return response;
    } catch (error) {
      console.error('Error in artist inquiry:', error);
      return 'YO GANG my brain stopped working fr fr! 💀 Try again later bestieee!';
    }
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