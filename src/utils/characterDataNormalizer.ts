// src/utils/characterDataNormalizer.ts
import { Character } from '../types';

/**
 * Utility class to normalize character data and prevent type errors
 */
export class CharacterDataNormalizer {
  /**
   * Normalize a single character object to ensure it has the correct structure
   */
  static normalizeCharacter(character: any, characterName: string): Character {
    if (!character) {
      return {
        name: characterName,
        notes: [`Character: ${characterName}`]
      };
    }

    // Handle different possible character data formats
    const normalizedCharacter: Character = {
      name: character.name || characterName,
      notes: []
    };

    // Normalize the notes field
    if (Array.isArray(character.notes)) {
      // Already an array - filter out invalid entries
      normalizedCharacter.notes = character.notes.filter(note => 
        typeof note === 'string' && note.trim().length > 0
      );
    } else if (typeof character.notes === 'string' && character.notes.trim()) {
      // Single string - convert to array
      normalizedCharacter.notes = [character.notes.trim()];
    } else if (character.notes && typeof character.notes === 'object') {
      // Object - extract values that are strings
      const noteValues = Object.values(character.notes)
        .filter(note => typeof note === 'string' && note.trim().length > 0) as string[];
      normalizedCharacter.notes = noteValues;
    } else {
      // No valid notes - create a default
      normalizedCharacter.notes = [`Character: ${characterName}`];
    }

    // Add any additional character properties from the original data
    if (character.appearances) {
      normalizedCharacter.notes.push(`Appears in ${character.appearances} scenes`);
    }
    
    if (character.dialogueCount) {
      normalizedCharacter.notes.push(`Has ${character.dialogueCount} lines of dialogue`);
    }
    
    if (character.arc_phase) {
      normalizedCharacter.notes.push(`Arc Phase: ${character.arc_phase}`);
    }
    
    if (character.emotional_state) {
      normalizedCharacter.notes.push(`Emotional State: ${character.emotional_state}`);
    }

    // Ensure we always have at least one note
    if (normalizedCharacter.notes.length === 0) {
      normalizedCharacter.notes = [`Character: ${characterName}`];
    }

    return normalizedCharacter;
  }

  /**
   * Normalize a characters object to ensure all characters have correct structure
   */
  static normalizeCharacters(characters: Record<string, any>): Record<string, Character> {
    const normalizedCharacters: Record<string, Character> = {};

    try {
      if (!characters || typeof characters !== 'object') {
        console.warn('⚠️ Invalid characters object provided, returning empty object');
        return {};
      }

      Object.entries(characters).forEach(([name, character]) => {
        try {
          if (name && name.trim()) {
            normalizedCharacters[name] = this.normalizeCharacter(character, name);
          }
        } catch (error) {
          console.warn(`⚠️ Error normalizing character ${name}:`, error);
          // Fallback: create a basic character entry
          normalizedCharacters[name] = {
            name: name,
            notes: [`Character: ${name} (normalized after error)`]
          };
        }
      });

      console.log('✅ Character normalization complete:', {
        originalCount: Object.keys(characters).length,
        normalizedCount: Object.keys(normalizedCharacters).length,
        characters: Object.keys(normalizedCharacters)
      });

    } catch (error) {
      console.error('❌ Critical error in character normalization:', error);
      return {};
    }

    return normalizedCharacters;
  }

  /**
   * Validate that a characters object is properly formatted
   */
  static validateCharacters(characters: Record<string, any>): boolean {
    try {
      if (!characters || typeof characters !== 'object') {
        return false;
      }

      return Object.entries(characters).every(([name, character]) => {
        return name && 
               character && 
               typeof character === 'object' &&
               character.name &&
               Array.isArray(character.notes);
      });
    } catch {
      return false;
    }
  }

  /**
   * Create character context string safely
   */
  static createCharacterContext(characters: Record<string, any>): string {
    try {
      const normalizedCharacters = this.normalizeCharacters(characters);
      const contextBlocks: string[] = [];

      Object.entries(normalizedCharacters).forEach(([name, character]) => {
        if (character.notes && character.notes.length > 0) {
          const notesString = character.notes.join('. ');
          if (notesString.trim()) {
            contextBlocks.push(`${name}: ${notesString}`);
          }
        }
      });

      return contextBlocks.join('\n') || 'No character information available';
    } catch (error) {
      console.error('❌ Error creating character context:', error);
      return 'Character context unavailable due to processing error';
    }
  }

  /**
   * Debug log character data structure
   */
  static debugCharacterData(characters: Record<string, any>, context: string = 'Unknown'): void {
    console.log(`🔍 Character Data Debug [${context}]:`, {
      type: typeof characters,
      isNull: characters === null,
      isUndefined: characters === undefined,
      keys: characters ? Object.keys(characters) : 'N/A',
      sampleCharacter: characters && Object.keys(characters).length > 0 ? 
        characters[Object.keys(characters)[0]] : 'N/A',
      validation: this.validateCharacters(characters)
    });
  }
}