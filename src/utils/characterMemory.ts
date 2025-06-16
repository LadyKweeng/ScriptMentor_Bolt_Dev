import { Character } from '../types';

export class CharacterMemoryManager {
  private memory: Record<string, Character>;

  constructor(initialMemory: Record<string, Character> = {}) {
    this.memory = initialMemory;
  }

  updateMemory(character: string, note: string): void {
    if (!this.memory[character]) {
      this.memory[character] = {
        name: character,
        notes: []
      };
    }
    this.memory[character].notes.push(note);
  }

  getMemory(character: string): Character | undefined {
    return this.memory[character];
  }

  getAllCharacters(): Record<string, Character> {
    return this.memory;
  }

  extractCharactersFromScene(sceneContent: string): string[] {
    // Basic regex to find character names in screenplay format
    // This would be more sophisticated in a real implementation
    const characterRegex = /^([A-Z][A-Z\s]+)(?:\s*\(.*\))?\s*$/gm;
    const matches = sceneContent.match(characterRegex) || [];
    
    return [...new Set(matches.map(match => match.trim()))];
  }

  analyzeCharacterConsistency(character: string, sceneContent: string): string[] {
    const characterNotes = this.getMemory(character)?.notes || [];
    const inconsistencies: string[] = [];
    
    // This would use AI to analyze if character actions align with established traits
    // Simplified mock implementation for demonstration
    if (characterNotes.length > 0 && 
        characterNotes.some(note => note.includes('confident')) && 
        sceneContent.toLowerCase().includes(`${character.toLowerCase()} hesitates`)) {
      inconsistencies.push(`${character} is established as confident but shows hesitation in this scene`);
    }
    
    return inconsistencies;
  }
}