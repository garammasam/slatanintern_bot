// Interfaces for SLATAN knowledge base
export interface SocialLinks {
  instagram?: string;
  twitter?: string;
  spotify?: string;
  soundcloud?: string;
  youtube?: string;
  bandcamp?: string;
  linktree?: string;
  facebook?: string;
  apple_music?: string;
}

export interface CollectiveInfo {
  name: string;
  description: string;
  founded: string;
  base: string;
  socials: SocialLinks;
  facts: string[];
}

export interface ArtistInfo {
  name: string;
  aliases?: string[];
  bio: string;
  role: string[];
  socials: SocialLinks;
  genres: string[];
  notableWorks?: string[];
  collaborations?: string[];
  facts: string[];
}

export interface SlatanKnowledgeBase {
  collective: CollectiveInfo;
  artists: {
    [key: string]: ArtistInfo;
  };
}

// SLATAN Knowledge Base Data
export const slatanKnowledgeBase: SlatanKnowledgeBase = {
  collective: {
    name: "0108 SLATAN",
    description: "A dynamic collective of talented songwriters and producers based in Kuala Lumpur, Malaysia. Known for blending hip-hop, R&B, and electronic music with innovative production approaches.",
    founded: "2018",
    base: "Kuala Lumpur, Malaysia",
    socials: {
      instagram: "@lebuhrayaselatan",
      twitter: "@slatan0108",
      youtube: "@0108SLATAN",
      spotify: "SLATAN",
      bandcamp: "0108slatan",
      facebook: "kronislatan",
      linktree: "linktr.ee/0108slatan"
    },
    facts: [
      "Founded in 2018 as a creative platform for Malaysian artists",
      "Known for innovative collaborative projects and genre-blending",
      "Released major collaborative album 'Kalau Begitu, Baiklah...' in January 2024",
      "Album features 19 artists including 12 singers/rappers and 7 composers",
      "Album is divided into three segments representing different life phases",
      "Hosts regular showcases and events at venues like Studio AB and REX KL",
      "Strong social media presence with 15K+ Instagram followers",
      "Known for their unique approach to music production and artist development"
    ]
  },
  artists: {
    gard: {
      name: "GARD",
      aliases: ["gard wuzgut", "gardwuzgut", "gard.wav"],
      bio: "Malaysian hip-hop artist and producer from Kepong, Kuala Lumpur. Started his journey through beatboxing, fascinated by creating instrumentals using just the mouth. His musical style blends R&B and Balada elements.",
      role: ["Producer", "Hip-hop Artist", "Sound Designer", "Beatboxer"],
      socials: {
        instagram: "@gard.wav",
        soundcloud: "gardqazz",
        spotify: "GARD",
        youtube: "@gard1046"
      },
      genres: ["Hip-Hop", "R&B", "Underground"],
      notableWorks: [
        "Wonderland (2019)",
        "Club Perenang Rohani EP (with WUZGUT, 2020)",
        "Berat ft. Ichu Exact",
        "Contributions to 'Kalau Begitu, Baiklah...'"
      ],
      facts: [
        "Has over 26,000 followers on Instagram",
        "Known for his work in the underground hip-hop scene",
        "Started his musical journey through beatboxing",
        "Part of the duo GARD WUZGUT with producer WUZGUT",
        "Released collaborative EP 'Club Perenang Rohani' in 2020"
      ]
    },
    offgrid: {
      name: "OFFGRID",
      aliases: ["ap.offgrid"],
      bio: "Musician within the 0108 SLATAN collective known for collaborative tracks and live performances.",
      role: ["Producer", "Artist"],
      socials: {
        instagram: "@ap.offgrid"
      },
      genres: ["Hip-Hop", "R&B", "Electronic"],
      notableWorks: [
        "Selalu Ada",
        "She Like (feat. Nobi)",
        "Contributions to 'Kalau Begitu, Baiklah...'"
      ],
      facts: [
        "Has over 14,000 followers on Instagram",
        "Regular performer at collective events",
        "Performed at Art of Speed event",
        "Known for collaborations with other SLATAN members",
        "Active performer in the local music scene"
      ]
    },
    jaystation: {
      name: "JAYSTATION",
      bio: "Modern hip-hop artist from Kuala Lumpur, Malaysia, known for collaborations and live performances.",
      role: ["Hip-hop Artist", "Performer"],
      socials: {
        instagram: "@jaystation"
      },
      genres: ["Hip-Hop", "R&B"],
      notableWorks: [
        "Mimpi Untuk Semalam (with Quai and dafreakinaz)",
        "Contributions to 'Kalau Begitu, Baiklah...'"
      ],
      facts: [
        "Often collaborates with fellow SLATAN member Quai",
        "Performed at Art of Speed 2024",
        "Performed at Anugerah Lagu Indie 2023",
        "Known for energetic live performances",
        "Regular contributor to SLATAN projects"
      ]
    },
    quai: {
      name: "QUAI",
      aliases: ["quai.wav", "KidQuai"],
      bio: "Versatile musician known for blending contemporary and traditional country music elements with modern genres. Notable for collaborations on tracks like 'Mesin Masa' and 'Tanya Tuhan'.",
      role: ["Producer", "Artist", "Composer"],
      socials: {
        instagram: "@itsquai",
        twitter: "@itsquai",
        soundcloud: "quai"
      },
      genres: ["Hip-Hop", "R&B", "Contemporary Country", "Electronic"],
      notableWorks: [
        "We Don't Talk About Rico (July 2022)",
        "Mesin Masa",
        "Tanya Tuhan",
        "Mimpi Untuk Semalam (with JAYSTATION and dafreakinaz)",
        "Contributions to 'Kalau Begitu, Baiklah...'"
      ],
      facts: [
        "Has over 22,000 followers on Instagram",
        "Known for fusion of contemporary country and modern genres",
        "Active collaborator with other SLATAN members",
        "Regular contributor to SLATAN projects",
        "Known for innovative sound production"
      ]
    },
    maatjet: {
      name: "MAATJET",
      bio: "Prominent SLATAN member known for tender lyrics and innovative production. Transitioned from corporate life to full-time music, releasing an 11-track solo album 'JIKA TAKDIR' in 2024.",
      role: ["Producer", "Composer", "Artist"],
      socials: {
        instagram: "@maatjet",
        spotify: "maatjet",
        linktree: "maatjet"
      },
      genres: ["Hip-Hop", "R&B", "Soul"],
      notableWorks: [
        "JIKA TAKDIR (11-track Solo Album, July 2024)",
        "Main composer for 'Kalau Begitu, Baiklah...'",
        "Various SLATAN compilations"
      ],
      facts: [
        "Released 11-track solo album 'JIKA TAKDIR' in July 2024",
        "Served as main composer for 'Kalau Begitu, Baiklah...'",
        "Known for tender and personal lyrics",
        "Transitioned from corporate career to music",
        "Has over 5,600 followers on Instagram",
        "Active on multiple streaming platforms"
      ]
    },
    wuzgut: {
      name: "WUZGUT",
      aliases: ["wuzgut"],
      bio: "Music producer and artist known for his atmospheric production style and heavy use of reverb. Collaborates frequently with GARD and uses FL Studio for production.",
      role: ["Producer", "Artist"],
      socials: {
        instagram: "@wuzgut01",
        soundcloud: "wuzgut"
      },
      genres: ["Hip-Hop", "R&B", "Electronic", "Bass"],
      notableWorks: [
        "Club Perenang Rohani EP (with GARD, 2020)",
        "Contributions to 'Kalau Begitu, Baiklah...'"
      ],
      facts: [
        "Part of the duo GARD WUZGUT",
        "Produces beats using FL Studio, Ableton Live",
        "Known for atmospheric production style and use of reverb",
        "Inspired by producers like Metro Boomin",
        "Key collaborator in SLATAN's productions"
      ]
    },
    nobi: {
      name: "NOBI",
      aliases: ["nobi"],
      bio: "Musician and content creator known for emotional R&B tracks and frequent collaborations. His work spans from introspective singles to collaborative pieces with artists like Off-Grid and Johnasa.",
      role: ["Producer", "Artist", "Content Creator"],
      socials: {
        instagram: "@nobi_i",
        apple_music: "music.apple.com/my/artist/nobi/1715312145"
      },
      genres: ["R&B", "Hip-Hop", "Soul"],
      notableWorks: [
        "Sepi Lepas Sayu (feat. Off-Grid) (2020)",
        "Rindu (2020)",
        "Benci-Ta (2020)",
        "PINTU (2021)",
        "RASA (2021)",
        "PELUKAN TENANG (2022)",
        "KATSANE (2022)",
        "Impian (2019)"
      ],
      collaborations: [
        "Sepi Lepas Sayu with Off-Grid",
        "Sakit Hati Je with Johnasa",
        "Various tracks with SLATAN collective"
      ],
      facts: [
        "Has over 4,300 followers on Instagram",
        "Facebook page with over 1,000 likes",
        "Regular collaborator with Off-Grid and Johnasa",
        "Released multiple singles between 2019-2022",
        "Known for emotional and introspective songwriting"
      ]
    },
    shilky: {
      name: "SHILKY",
      aliases: ["muhd_shilky"],
      bio: "Alternative hip-hop performer from Kuala Lumpur, known for blending hip-hop elements with alternative sounds.",
      role: ["Producer", "Artist"],
      socials: {
        instagram: "@muhd_shilky",
        spotify: "shilky"
      },
      genres: ["Alternative Hip-Hop", "R&B", "Electronic"],
      notableWorks: [
        "KAU M4NE",
        "125",
        "TG",
        "Contributions to 'Kalau Begitu, Baiklah...'"
      ],
      facts: [
        "Has over 1,600 followers on Instagram",
        "Known for unique alternative hip-hop style",
        "Active on Spotify as a musician",
        "Creates atmospheric compositions"
      ]
    },
    akkimwaru: {
      name: "AKKIMWARU",
      bio: "Rising Malay rapper known for his skills and collaborations within the scene, with tracks showcasing his versatile rap style.",
      role: ["Rapper", "Artist"],
      socials: {
        instagram: "@akkimwaru"
      },
      genres: ["Hip-Hop", "Rap"],
      notableWorks: [
        "ICE COLD CA$tLE (with Yung Kai and Nakalness)",
        "VRD",
        "HABIS SPM",
        "GARING",
        "Contributions to 'Kalau Begitu, Baiklah...'"
      ],
      facts: [
        "Has over 6,000 followers on Instagram",
        "Recognized for his skills as a Malay rapper",
        "Known for tracks like VRD and HABIS SPM",
        "Active collaborator with other artists",
        "Regular performer at collective events"
      ]
    }
  }
}; 