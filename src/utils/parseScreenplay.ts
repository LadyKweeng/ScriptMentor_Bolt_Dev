import ScreenplayParser from './screenplay/ScreenplayParser';

// Interface for the character profiles
interface CharacterProfile {
  arc_phase?: string;
  emotional_state?: string;
  scenes_present?: string[];
  triggers?: string[];
  support?: string[];
  notes?: string;
  appearances?: number;
  dialogueCount?: number;
}

// Define the result structure to match your app's expectations
interface ScreenplayResult {
  metadata: {
    title: string | null;
    author: string | null;
    uploadType: string;
  };
  scenes: Array<{
    heading: string;
    content: string;
    characters: string[];
  }>;
  characters: Record<string, CharacterProfile>;
}

/**
 * Parse Final Draft XML directly to preserve sequence
 */
function parseFinalDraftXML(xmlContent: string): ScreenplayResult {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
  
  // Extract metadata
  const metadata = {
    title: null as string | null,
    author: null as string | null,
    uploadType: 'fdx'
  };
  
  // Get title from TitlePage
  const titlePage = xmlDoc.getElementsByTagName('TitlePage')[0];
  if (titlePage) {
    const contentElements = titlePage.getElementsByTagName('Content');
    for (let i = 0; i < contentElements.length; i++) {
      const content = contentElements[i];
      const type = content.getAttribute('Type');
      if (type === 'Title') {
        metadata.title = content.textContent?.trim() || null;
      } else if (type === 'Author') {
        metadata.author = content.textContent?.trim() || null;
      }
    }
  }
  
  // Process paragraphs in order to preserve sequence
  const paragraphs = xmlDoc.getElementsByTagName('Paragraph');
  const scenes: Array<{heading: string, content: string, characters: string[]}> = [];
  const characters = new Set<string>();
  
  let currentScene: {heading: string, content: string, characters: string[]} | null = null;
  let sceneContent: string[] = [];
  
  let lastElementType: string | null = null;
  
  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const type = paragraph.getAttribute('Type');
    const textElements = paragraph.getElementsByTagName('Text');
    const text = Array.from(textElements)
      .map(el => el.textContent || '')
      .join(' ')
      .trim();
    
    if (!text) continue;
    
    switch (type) {
      case 'Scene Heading':
        // Start new scene
        if (currentScene) {
          // Finish previous scene
          currentScene.content = sceneContent.join('\n');
          scenes.push(currentScene);
        }
        
        // Start new scene
        currentScene = {
          heading: text.toUpperCase(),
          content: '',
          characters: []
        };
        sceneContent = [];
        lastElementType = null;
        break;
        
      case 'Action':
        if (currentScene) {
          // Add blank line if previous element was dialogue
          if (lastElementType === 'Dialogue' || lastElementType === 'Parenthetical') {
            sceneContent.push('');
          }
          sceneContent.push(text);
          lastElementType = 'Action';
        }
        break;
        
      case 'Character':
        if (currentScene) {
          // Add blank line if previous element was action
          if (lastElementType === 'Action') {
            sceneContent.push('');
          }
          const characterName = text.toUpperCase();
          sceneContent.push(characterName);
          
          // Track character
          characters.add(characterName);
          if (!currentScene.characters.includes(characterName)) {
            currentScene.characters.push(characterName);
          }
          lastElementType = 'Character';
        }
        break;
        
      case 'Parenthetical':
        if (currentScene) {
          sceneContent.push(text);
          lastElementType = 'Parenthetical';
        }
        break;
        
      case 'Dialogue':
        if (currentScene) {
          sceneContent.push(text);
          lastElementType = 'Dialogue';
        }
        break;
        
      case 'Transition':
        if (currentScene) {
          sceneContent.push('');
          sceneContent.push(text.toUpperCase());
          lastElementType = 'Transition';
        }
        break;
    }
  }
  
  // Don't forget the last scene
  if (currentScene) {
    currentScene.content = sceneContent.join('\n');
    scenes.push(currentScene);
  }
  
  // Create character profiles
  const characterProfiles: Record<string, CharacterProfile> = {};
  characters.forEach(char => {
    characterProfiles[char] = {
      appearances: scenes.filter(scene => scene.characters.includes(char)).length,
      dialogueCount: 0, // Would need to count dialogue lines
      scenes_present: [],
      arc_phase: "",
      emotional_state: "",
      notes: `Character appears in screenplay`,
      triggers: [],
      support: []
    };
  });
  
  return {
    metadata,
    scenes,
    characters: characterProfiles
  };
}

/**
 * Main function to parse screenplay files
 * Uses direct XML parsing for Final Draft to preserve sequence
 */
export async function parseScreenplay(file: File): Promise<ScreenplayResult> {
  try {
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || '';
    const fileContent = await file.text();
    
    // For Final Draft files, use direct XML parsing to preserve sequence
    if (fileExtension === 'fdx') {
      return parseFinalDraftXML(fileContent);
    }
    
    // For other formats, use the existing ScreenplayParser
    const parser = new ScreenplayParser();
    const screenplay = parser.parse(fileContent, fileExtension);
    const analysisData = parser.generateLLMAnalysisStructure();
    
    // Convert to expected format
    const transformedScenes = screenplay.scenes.map((scene) => {
      let content = '';
      
      // For non-FDX files, combine action and dialogue in a simple way
      if (Array.isArray(scene.action)) {
        content = scene.action.join('\n\n');
      } else if (typeof scene.action === 'string') {
        content = scene.action;
      }
      
      // Add dialogues after action (this is the old way, but OK for non-FDX)
      if (scene.dialogues && scene.dialogues.length > 0) {
        const dialogueText = scene.dialogues.map(dialogue => {
          let text = '\n\n' + dialogue.character.toUpperCase();
          if (dialogue.parenthetical) {
            text += '\n' + dialogue.parenthetical;
          }
          if (Array.isArray(dialogue.content)) {
            text += '\n' + dialogue.content.join('\n');
          } else if (typeof dialogue.content === 'string') {
            text += '\n' + dialogue.content;
          }
          return text;
        }).join('');
        
        content += dialogueText;
      }
      
      return {
        heading: scene.heading,
        content: content.trim(),
        characters: Array.isArray(scene.characters) ? scene.characters : []
      };
    });
    
    // Transform character data
    const transformedCharacters: Record<string, CharacterProfile> = {};
    if (analysisData.characterAnalysis) {
      Object.entries(analysisData.characterAnalysis).forEach(([name, data]: [string, any]) => {
        transformedCharacters[name] = {
          appearances: data.appearances || 0,
          dialogueCount: data.dialogueCount || 0,
          scenes_present: data.scenesPresent || [],
          arc_phase: "",
          emotional_state: "",
          notes: `Appears in ${data.appearances || 0} scenes with ${data.dialogueCount || 0} lines of dialogue`,
          triggers: [],
          support: []
        };
      });
    }
    
    return {
      metadata: {
        title: screenplay.metadata.title || file.name.replace(/\.[^/.]+$/, ""),
        author: screenplay.metadata.author || null,
        uploadType: fileExtension || 'txt'
      },
      scenes: transformedScenes,
      characters: transformedCharacters
    };
    
  } catch (error) {
    console.error('Error parsing screenplay:', error);
    throw new Error(`Failed to parse screenplay: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract characters from scene content
 */
export function extractCharactersFromScene(sceneContent: string): string[] {
  const lines = sceneContent.split('\n');
  const characters = new Set<string>();
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === trimmed.toUpperCase() && 
        trimmed.length > 0 && 
        trimmed.length < 40 &&
        !trimmed.match(/^(INT\.|EXT\.|EST\.|INT\/EXT\.)/)) {
      characters.add(trimmed);
    }
  }
  
  return Array.from(characters);
}