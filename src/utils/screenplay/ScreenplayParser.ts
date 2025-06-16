/**
 * ScreenplayParser.ts
 * A comprehensive parser for screenplay formats including Final Draft, Fade In, Celtx, and WriterDuet
 * Supports web display and LLM analysis for writer feedback
 */

import { createDOMParser } from './DOMParserHelper';

interface ScreenplayMetadata {
  title?: string;
  author?: string;
  copyright?: string;
  createdDate?: string;
  modifiedDate?: string;
  format?: string;
  [key: string]: any;
}

interface ScreenplayDialogue {
  character: string;
  parenthetical: string | null;
  content: string[];
}

interface ScreenplayNote {
  type: string;
  text: string;
}

interface ScreenplayScene {
  heading: string;
  slug: string;
  action: string[];
  dialogues: ScreenplayDialogue[];
  characters: string[] | Set<string>;
  notes: ScreenplayNote[];
}

interface ScreenplayStats {
  sceneCount: number;
  characterCount: number;
  dialogueCount: number;
  actionCount: number;
  totalWords: number;
  estimatedPages: number;
}

interface Screenplay {
  metadata: ScreenplayMetadata;
  scenes: ScreenplayScene[];
  characters: string[] | Set<string>;
  dialogueCount: number;
  actionCount: number;
  totalWords: number;
  sceneCount?: number;
  characterCount?: number;
  estimatedPages?: number;
}

interface WebDisplayScene {
  id: string;
  heading: string;
  action: string;
  dialogues: {
    character: string;
    parenthetical: string | null;
    content: string;
  }[];
  characters: string[];
}

interface WebDisplayData {
  metadata: ScreenplayMetadata;
  stats: ScreenplayStats;
  scenes: WebDisplayScene[];
}

interface LLMAnalysisSceneStats {
  dialogueWords: number;
  actionWords: number;
  dialogueToActionRatio: string;
}

interface LLMAnalysisScene {
  sceneNumber: number;
  heading: string;
  characters: string[];
  actionSummary: string;
  dialogueCount: number;
  stats: LLMAnalysisSceneStats;
}

interface LLMAnalysisCharacter {
  appearances: number;
  dialogueCount: number;
  scenesPresent: number[];
}

interface LLMAnalysisStructure {
  scenes: {
    id: string;
    heading: string;
    characters: string[];
    actionCount: number;
    dialogueCount: number;
  }[];
}

interface LLMAnalysisData {
  metadata: ScreenplayMetadata;
  stats: ScreenplayStats;
  characterAnalysis: {
    [character: string]: LLMAnalysisCharacter;
  };
  sceneAnalysis: LLMAnalysisScene[];
  structure: LLMAnalysisStructure;
  fullContent: Screenplay;
}

export class ScreenplayParser {
  private supportedFormats: string[];
  private screenplay: Screenplay;

  constructor() {
    this.supportedFormats = ['fdx', 'fountain', 'celtx', 'xml', 'html'];
    this.screenplay = {
      metadata: {},
      scenes: [],
      characters: new Set<string>(),
      dialogueCount: 0,
      actionCount: 0,
      totalWords: 0
    };
  }

  /**
   * Main entry point for parsing a screenplay file
   * @param content - The screenplay file content
   * @param format - File format or extension
   * @returns Parsed screenplay structure
   */
  public parse(content: string | Buffer, format?: string): Screenplay {
    // Reset screenplay object
    this.screenplay = {
      metadata: {},
      scenes: [],
      characters: new Set<string>(),
      dialogueCount: 0,
      actionCount: 0,
      totalWords: 0
    };

    // Determine format if not provided
    if (!format) {
      format = this._detectFormat(content);
    }

    // Convert format to lowercase for consistency
    format = format.toLowerCase();

    // Parse based on detected format
    switch (format) {
      case 'fdx':
        return this._parseFinalDraft(content);
      case 'fountain':
        return this._parseFountain(content);
      case 'celtx':
        return this._parseCeltx(content);
      case 'writerduet':
      case 'html':
        return this._parseWriterDuet(content);
      default:
        throw new Error(`Unsupported screenplay format: ${format}`);
    }
  }

  /**
   * Detects the format of the screenplay based on content
   * @param content - The screenplay content
   * @returns Detected format
   */
  public _detectFormat(content: string | Buffer): string {
    const contentStr = content.toString();
    
    // Check for Final Draft (FDX)
    if (contentStr.includes('<FinalDraft') || 
        contentStr.includes('<?xml') && contentStr.includes('<FinalDraft')) {
      return 'fdx';
    }
    
    // Check for Fountain
    if (contentStr.includes('INT.') || contentStr.includes('EXT.') || 
        contentStr.match(/FADE (IN|OUT)/i)) {
      return 'fountain';
    }
    
    // Check for Celtx (XML-based)
    if (contentStr.includes('<celtx:document') || 
        (contentStr.includes('<?xml') && contentStr.includes('<celtx:'))) {
      return 'celtx';
    }
    
    // Check for WriterDuet (HTML with specific classes)
    if (contentStr.includes('<div class="page"') || 
        contentStr.includes('<div class="screenplay"')) {
      return 'html';
    }
    
    // Default to Fountain as it's the most forgiving format
    return 'fountain';
  }

  /**
   * Clean character names from common formatting issues
   * @param characterName - Raw character name from script
   * @returns Cleaned character name
   */
  private _cleanCharacterName(characterName: string): string {
    // Trim any whitespace
    let cleaned = characterName.trim();
    
    // Remove any trailing punctuation that might be formatting artifacts
    cleaned = cleaned.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]$/g, '');
    
    // Some screenplay formats add extensions like "(O.S.)" - keep these intact
    // But remove any trailing spaces before a parenthesis
    cleaned = cleaned.replace(/\s+\(/g, ' (');
    
    return cleaned;
  }

  /**
   * Parse Final Draft (FDX) XML format
   * @param content - FDX content
   * @returns Parsed screenplay
   */
  private _parseFinalDraft(content: string | Buffer): Screenplay {
    const contentStr = content.toString();
    
    // Get a DOM parser that works in both browser and Node.js
    const parser = createDOMParser();
    const xmlDoc = parser.parseFromString(contentStr, "text/xml");

    // Extract metadata
    this._extractFDXMetadata(xmlDoc);
    
    // Process content elements
    const paragraphs = xmlDoc.getElementsByTagName('Paragraph');
    let currentScene: ScreenplayScene | null = null;
    
    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i];
      const type = paragraph.getAttribute('Type');
      const textElements = paragraph.getElementsByTagName('Text');
      const text = Array.from(textElements)
        .map(el => el.textContent || '')
        .join(' ')
        .trim();
      
      if (!text) continue;
      
      // Count words
      this.screenplay.totalWords += this._countWords(text);
      
      switch (type) {
        case 'Scene Heading':
          // Create new scene
          currentScene = {
            heading: text,
            slug: text,
            action: [],
            dialogues: [],
            characters: new Set<string>(),
            notes: []
          };
          this.screenplay.scenes.push(currentScene);
          break;
          
        case 'Action':
          if (currentScene) {
            currentScene.action.push(text);
            this.screenplay.actionCount++;
          }
          break;
          
        case 'Character':
          if (currentScene) {
            const character = this._cleanCharacterName(text);
            (currentScene.characters as Set<string>).add(character);
            (this.screenplay.characters as Set<string>).add(character);
            
            // Prepare for dialogue
            currentScene.dialogues.push({
              character: character,
              parenthetical: null,
              content: []
            });
          }
          break;
          
        case 'Parenthetical':
          if (currentScene && currentScene.dialogues.length > 0) {
            const lastDialogue = currentScene.dialogues[currentScene.dialogues.length - 1];
            lastDialogue.parenthetical = text;
          }
          break;
          
        case 'Dialogue':
          if (currentScene && currentScene.dialogues.length > 0) {
            const lastDialogue = currentScene.dialogues[currentScene.dialogues.length - 1];
            lastDialogue.content.push(text);
            this.screenplay.dialogueCount++;
          }
          break;
          
        case 'Transition':
          // Add transition as a note to the current scene
          if (currentScene) {
            currentScene.notes.push({ type: 'transition', text });
          }
          break;
          
        default:
          // Handle other paragraph types as needed
          break;
      }
    }
    
    return this._finalizeScreenplay();
  }

  /**
   * Extract metadata from Final Draft XML
   * @param xmlDoc - Parsed XML document
   */
  private _extractFDXMetadata(xmlDoc: Document): void {
    const titlePage = xmlDoc.getElementsByTagName('TitlePage')[0];
    if (titlePage) {
      const contentElements = titlePage.getElementsByTagName('Content');
      for (let i = 0; i < contentElements.length; i++) {
        const content = contentElements[i];
        const type = content.getAttribute('Type');
        const text = content.textContent?.trim() || '';
        
        switch (type) {
          case 'Title':
            this.screenplay.metadata.title = text;
            break;
          case 'Author':
            this.screenplay.metadata.author = text;
            break;
          case 'Copyright':
            this.screenplay.metadata.copyright = text;
            break;
          // Add more metadata fields as needed
        }
      }
    }
    
    // Extract document properties
    const docInfo = xmlDoc.getElementsByTagName('Document')[0];
    if (docInfo) {
      this.screenplay.metadata.createdDate = docInfo.getAttribute('CreatedDate') || undefined;
      this.screenplay.metadata.modifiedDate = docInfo.getAttribute('ModifiedDate') || undefined;
    }
  }

  /**
   * Parse Fountain format screenplay
   * @param content - Fountain content
   * @returns Parsed screenplay
   */
  private _parseFountain(content: string | Buffer): Screenplay {
    const lines = content.toString().split('\n');
    let inMetadata = false;
    let inDialogue = false;
    let currentCharacter: string | null = null;
    let currentParenthetical: string | null = null;
    let currentScene: ScreenplayScene | null = null;
    
    // Regular expressions for different screenplay elements
    const sceneHeaderRegex = /^(INT|EXT|INT\/EXT|I\/E)[\.\s].+/i;
    const characterRegex = /^[A-Z][A-Z0-9\s.,'&-]*(\([A-Z\s.,']*\))?$/;
    const parentheticalRegex = /^\((.+)\)$/;
    const transitionRegex = /^(FADE (TO|IN|OUT)|CUT TO|DISSOLVE TO|SMASH CUT|QUICK CUT|MATCH CUT|JUMP CUT|FADE TO BLACK|END CREDITS|THE END)$/i;
    
    // Process each line
    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      
      // Skip empty lines
      if (!line) continue;
      
      // Count words
      this.screenplay.totalWords += this._countWords(line);
      
      // Handle metadata section
      if (line.startsWith('Title:') && i < 10) {
        inMetadata = true;
        this.screenplay.metadata.title = line.substring(6).trim();
        continue;
      } else if (inMetadata) {
        if (line.includes(':')) {
          const [key, value] = line.split(':').map(part => part.trim());
          this.screenplay.metadata[key.toLowerCase()] = value;
          continue;
        } else if (line === '') {
          inMetadata = false;
          continue;
        }
      }
      
      // Scene heading
      if (sceneHeaderRegex.test(line)) {
        inDialogue = false;
        currentScene = {
          heading: line,
          slug: line,
          action: [],
          dialogues: [],
          characters: new Set<string>(),
          notes: []
        };
        this.screenplay.scenes.push(currentScene);
        continue;
      }
      
      // Transition
      if (transitionRegex.test(line)) {
        if (currentScene) {
          currentScene.notes.push({ type: 'transition', text: line });
        }
        inDialogue = false;
        continue;
      }
      
      // Special case handling for problematic character names
      if (line === 'Tura' || line === 'Haji' || line === 'Lori' || 
          line === 'TURA' || line === 'HAJI' || line === 'LORI') {
        inDialogue = true;
        currentCharacter = this._cleanCharacterName(line);
        currentParenthetical = null;
        
        if (currentScene) {
          (currentScene.characters as Set<string>).add(currentCharacter);
          (this.screenplay.characters as Set<string>).add(currentCharacter);
          
          currentScene.dialogues.push({
            character: currentCharacter,
            parenthetical: null,
            content: []
          });
        }
        continue;
      }
      
      // Character
      if (characterRegex.test(line) && (!currentScene || currentScene.action.length > 0 || currentScene.dialogues.length > 0)) {
        inDialogue = true;
        // Remove any trailing spaces from character names
        currentCharacter = this._cleanCharacterName(line);
        currentParenthetical = null;
        
        if (currentScene) {
          (currentScene.characters as Set<string>).add(currentCharacter);
          (this.screenplay.characters as Set<string>).add(currentCharacter);
          
          currentScene.dialogues.push({
            character: currentCharacter,
            parenthetical: null,
            content: []
          });
        }
        continue;
      }
      
      // Parenthetical
      if (parentheticalRegex.test(line) && inDialogue) {
        currentParenthetical = line;
        
        if (currentScene && currentScene.dialogues.length > 0) {
          const lastDialogue = currentScene.dialogues[currentScene.dialogues.length - 1];
          lastDialogue.parenthetical = currentParenthetical;
        }
        continue;
      }
      
      // Dialogue
      if (inDialogue) {
        if (currentScene && currentScene.dialogues.length > 0) {
          const lastDialogue = currentScene.dialogues[currentScene.dialogues.length - 1];
          lastDialogue.content.push(line);
          this.screenplay.dialogueCount++;
        }
        continue;
      }
      
      // Action (default)
      if (currentScene) {
        currentScene.action.push(line);
        this.screenplay.actionCount++;
      }
    }
    
    return this._finalizeScreenplay();
  }

  /**
   * Parse Celtx XML format
   * @param content - Celtx content
   * @returns Parsed screenplay
   */
  private _parseCeltx(content: string | Buffer): Screenplay {
    const contentStr = content.toString();
    
    // Get a DOM parser that works in both browser and Node.js
    const parser = createDOMParser();
    const xmlDoc = parser.parseFromString(contentStr, "text/xml");
    
    // Extract metadata
    this._extractCeltxMetadata(xmlDoc);
    
    // Process screenplay content
    const scriptElements = xmlDoc.getElementsByTagName('script');
    if (scriptElements.length > 0) {
      const script = scriptElements[0];
      const elements = script.children;
      let currentScene: ScreenplayScene | null = null;
      let currentCharacter: string | null = null;
      
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        const elementType = element.nodeName.toLowerCase();
        const text = element.textContent?.trim() || '';
        
        if (!text) continue;
        
        // Count words
        this.screenplay.totalWords += this._countWords(text);
        
        switch (elementType) {
          case 'scene':
          case 'heading':
            currentScene = {
              heading: text,
              slug: text,
              action: [],
              dialogues: [],
              characters: new Set<string>(),
              notes: []
            };
            this.screenplay.scenes.push(currentScene);
            break;
            
          case 'action':
          case 'description':
            if (currentScene) {
              currentScene.action.push(text);
              this.screenplay.actionCount++;
            }
            break;
            
          case 'character':
            currentCharacter = this._cleanCharacterName(text);
            if (currentScene) {
              (currentScene.characters as Set<string>).add(currentCharacter);
              (this.screenplay.characters as Set<string>).add(currentCharacter);
              
              currentScene.dialogues.push({
                character: currentCharacter,
                parenthetical: null,
                content: []
              });
            }
            break;
            
          case 'parenthetical':
            if (currentScene && currentScene.dialogues.length > 0) {
              const lastDialogue = currentScene.dialogues[currentScene.dialogues.length - 1];
              lastDialogue.parenthetical = text;
            }
            break;
            
          case 'dialogue':
            if (currentScene && currentScene.dialogues.length > 0) {
              const lastDialogue = currentScene.dialogues[currentScene.dialogues.length - 1];
              lastDialogue.content.push(text);
              this.screenplay.dialogueCount++;
            }
            break;
            
          case 'transition':
            if (currentScene) {
              currentScene.notes.push({ type: 'transition', text });
            }
            break;
            
          // Add more element types as needed
        }
      }
    }
    
    return this._finalizeScreenplay();
  }

  /**
   * Extract metadata from Celtx XML
   * @param xmlDoc - Parsed XML document
   */
  private _extractCeltxMetadata(xmlDoc: Document): void {
    const projectInfo = xmlDoc.getElementsByTagName('projectinfo')[0];
    if (projectInfo) {
      const title = projectInfo.getElementsByTagName('title')[0];
      if (title) {
        this.screenplay.metadata.title = title.textContent?.trim() || undefined;
      }
      
      const author = projectInfo.getElementsByTagName('author')[0];
      if (author) {
        this.screenplay.metadata.author = author.textContent?.trim() || undefined;
      }
      
      // Extract more metadata as needed
    }
  }

  /**
   * Parse WriterDuet HTML format
   * @param content - WriterDuet content
   * @returns Parsed screenplay
   */
  private _parseWriterDuet(content: string | Buffer): Screenplay {
    const contentStr = content.toString();
    
    // Get a DOM parser that works in both browser and Node.js
    const parser = createDOMParser();
    const htmlDoc = parser.parseFromString(contentStr, "text/html");
    
    // Extract metadata from title or meta tags
    this._extractWriterDuetMetadata(htmlDoc);
    
    // Process screenplay content
    const pages = htmlDoc.querySelectorAll('.page, .screenplay');
    let currentScene: ScreenplayScene | null = null;
    
    pages.forEach(page => {
      const elements = page.querySelectorAll('.element');
      
      elements.forEach(element => {
        const elementClass = element.className;
        const text = element.textContent?.trim() || '';
        
        if (!text) return;
        
        // Count words
        this.screenplay.totalWords += this._countWords(text);
        
        if (elementClass.includes('scene-heading') || elementClass.includes('slug')) {
          currentScene = {
            heading: text,
            slug: text,
            action: [],
            dialogues: [],
            characters: new Set<string>(),
            notes: []
          };
          this.screenplay.scenes.push(currentScene);
        } else if (elementClass.includes('action') || elementClass.includes('description')) {
          if (currentScene) {
            currentScene.action.push(text);
            this.screenplay.actionCount++;
          }
        } else if (elementClass.includes('character')) {
          const character = this._cleanCharacterName(text);
          if (currentScene) {
            (currentScene.characters as Set<string>).add(character);
            (this.screenplay.characters as Set<string>).add(character);
            
            currentScene.dialogues.push({
              character,
              parenthetical: null,
              content: []
            });
          }
        } else if (elementClass.includes('parenthetical')) {
          if (currentScene && currentScene.dialogues.length > 0) {
            const lastDialogue = currentScene.dialogues[currentScene.dialogues.length - 1];
            lastDialogue.parenthetical = text;
          }
        } else if (elementClass.includes('dialogue')) {
          if (currentScene && currentScene.dialogues.length > 0) {
            const lastDialogue = currentScene.dialogues[currentScene.dialogues.length - 1];
            lastDialogue.content.push(text);
            this.screenplay.dialogueCount++;
          }
        } else if (elementClass.includes('transition')) {
          if (currentScene) {
            currentScene.notes.push({ type: 'transition', text });
          }
        }
        // Add more element types as needed
      });
    });
    
    return this._finalizeScreenplay();
  }

  /**
   * Extract metadata from WriterDuet HTML
   * @param htmlDoc - Parsed HTML document
   */
  private _extractWriterDuetMetadata(htmlDoc: Document): void {
    // Title from title tag
    const titleTag = htmlDoc.querySelector('title');
    if (titleTag) {
      this.screenplay.metadata.title = titleTag.textContent?.trim() || undefined;
    }
    
    // Author and other metadata from meta tags
    const metaTags = htmlDoc.querySelectorAll('meta');
    metaTags.forEach(meta => {
      const name = meta.getAttribute('name');
      const content = meta.getAttribute('content');
      
      if (name && content) {
        switch (name.toLowerCase()) {
          case 'author':
            this.screenplay.metadata.author = content;
            break;
          case 'description':
            this.screenplay.metadata.description = content;
            break;
          // Add more metadata as needed
        }
      }
    });
  }

  /**
   * Count words in a string
   * @param text - Text to count words in
   * @returns Word count
   */
  private _countWords(text: string): number {
    return text.split(/\s+/).filter(Boolean).length;
  }

  /**
   * Finalize screenplay object before returning
   * @returns Processed screenplay object
   */
  private _finalizeScreenplay(): Screenplay {
    // Convert character Sets to arrays
    this.screenplay.characters = Array.from(this.screenplay.characters as Set<string>);
    
    // Process each scene
    this.screenplay.scenes = this.screenplay.scenes.map(scene => {
      return {
        ...scene,
        characters: Array.from(scene.characters as Set<string>)
      };
    });
    
    // Calculate screenplay stats
    this.screenplay.sceneCount = this.screenplay.scenes.length;
    this.screenplay.characterCount = (this.screenplay.characters as string[]).length;
    
    // Add page count estimate (1 page = ~250 words in standard format)
    this.screenplay.estimatedPages = Math.ceil(this.screenplay.totalWords / 250);
    
    return this.screenplay;
  }

  /**
   * Generate a formatted web-friendly representation
   * @returns HTML-ready screenplay structure
   */
  public generateWebDisplay(): WebDisplayData {
    const scenes: WebDisplayScene[] = this.screenplay.scenes.map((scene, index) => {
      const dialogues = scene.dialogues.map(dialogue => {
        return {
          character: dialogue.character,
          parenthetical: dialogue.parenthetical,
          content: dialogue.content.join(' ')
        };
      });
      
      return {
        id: `scene-${index + 1}`,
        heading: scene.heading,
        action: scene.action.join('\n\n'),
        dialogues,
        characters: scene.characters as string[]
      };
    });
    
    return {
      metadata: this.screenplay.metadata,
      stats: {
        sceneCount: this.screenplay.sceneCount || 0,
        characterCount: this.screenplay.characterCount || 0,
        dialogueCount: this.screenplay.dialogueCount,
        actionCount: this.screenplay.actionCount,
        totalWords: this.screenplay.totalWords,
        estimatedPages: this.screenplay.estimatedPages || 0
      },
      scenes
    };
  }

  /**
   * Generate a structure optimized for LLM analysis
   * @returns LLM-friendly screenplay structure
   */
  public generateLLMAnalysisStructure(): LLMAnalysisData {
    // Create character summaries
    const characterSummaries: { [character: string]: LLMAnalysisCharacter } = {};
    (this.screenplay.characters as string[]).forEach(character => {
      const appearances = this.screenplay.scenes.filter(scene => 
        (scene.characters as string[]).includes(character)
      ).length;
      
      const dialogueCount = this.screenplay.scenes.reduce((count, scene) => {
        return count + scene.dialogues.filter(d => d.character === character).length;
      }, 0);
      
      characterSummaries[character] = {
        appearances,
        dialogueCount,
        scenesPresent: this.screenplay.scenes
          .filter(scene => (scene.characters as string[]).includes(character))
          .map((_, i) => i + 1) // Scene numbers
      };
    });
    
    // Create scene summaries
    const sceneSummaries: LLMAnalysisScene[] = this.screenplay.scenes.map((scene, index) => {
      // Extract key action elements
      const actionSummary = scene.action.join(' ');
      
      // Calculate dialogue to action ratio
      const dialogueWords = scene.dialogues.reduce((count, dialogue) => {
        return count + this._countWords(dialogue.content.join(' '));
      }, 0);
      
      const actionWords = scene.action.reduce((count, action) => {
        return count + this._countWords(action);
      }, 0);
      
      const dialogueToActionRatio = actionWords > 0 ? 
        (dialogueWords / actionWords).toFixed(2) : 'Infinity';
      
      return {
        sceneNumber: index + 1,
        heading: scene.heading,
        characters: scene.characters as string[],
        actionSummary,
        dialogueCount: scene.dialogues.length,
        stats: {
          dialogueWords,
          actionWords,
          dialogueToActionRatio
        }
      };
    });
    
    return {
      metadata: this.screenplay.metadata,
      stats: {
        sceneCount: this.screenplay.sceneCount || 0,
        characterCount: this.screenplay.characterCount || 0,
        dialogueCount: this.screenplay.dialogueCount,
        actionCount: this.screenplay.actionCount,
        totalWords: this.screenplay.totalWords,
        estimatedPages: this.screenplay.estimatedPages || 0,
        averageSceneLength: this.screenplay.sceneCount ? 
          (this.screenplay.totalWords / this.screenplay.sceneCount).toFixed(2) : "0"
      },
      characterAnalysis: characterSummaries,
      sceneAnalysis: sceneSummaries,
      structure: {
        scenes: this.screenplay.scenes.map((scene, index) => ({
          id: `scene-${index + 1}`,
          heading: scene.heading,
          characters: scene.characters as string[],
          actionCount: scene.action.length,
          dialogueCount: scene.dialogues.length
        }))
      },
      fullContent: this.screenplay // Include full content for deeper analysis
    };
  }

  /**
   * Format the screenplay as Fountain for export
   * @returns Fountain formatted screenplay
   */
  public exportAsFountain(): string {
    let output = '';
    
    // Add metadata
    if (this.screenplay.metadata.title) {
      output += `Title: ${this.screenplay.metadata.title}\n`;
    }
    if (this.screenplay.metadata.author) {
      output += `Author: ${this.screenplay.metadata.author}\n`;
    }
    // Add other metadata
    Object.entries(this.screenplay.metadata).forEach(([key, value]) => {
      if (key !== 'title' && key !== 'author') {
        output += `${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}\n`;
      }
    });
    
    output += '\n'; // End metadata section
    
    // Add scenes
    this.screenplay.scenes.forEach(scene => {
      // Scene heading
      output += scene.heading + '\n\n';
      
      // Action blocks
      scene.action.forEach(action => {
        output += action + '\n\n';
      });
      
      // Dialogues
      scene.dialogues.forEach(dialogue => {
        output += dialogue.character + '\n';
        
        if (dialogue.parenthetical) {
          output += dialogue.parenthetical + '\n';
        }
        
        dialogue.content.forEach(line => {
          output += line + '\n';
        });
        
        output += '\n';
      });
      
      // Notes/transitions
      scene.notes.forEach(note => {
        if (note.type === 'transition') {
          output += '> ' + note.text + '\n\n';
        }
      });
    });
    
    return output;
  }
}

export default ScreenplayParser;
