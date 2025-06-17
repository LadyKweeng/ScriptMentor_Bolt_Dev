// src/utils/feedbackGenerator.ts
import { ScriptScene, Mentor, Feedback, MentorWeights } from '../types';
import { CharacterMemoryManager } from './characterMemory';
import { aiFeedbackService } from '../services/aiFeedbackService';

export class FeedbackGenerator {
  private characterMemory: CharacterMemoryManager;

  constructor(characterMemory: CharacterMemoryManager) {
    this.characterMemory = characterMemory;
  }

  /**
   * Generate dual feedback using the AI feedback service (which now uses backend API)
   */
  async generateDualFeedback(scene: ScriptScene, mentor: Mentor): Promise<Feedback> {
    console.log('🎯 FeedbackGenerator: Generating dual feedback via AI service');
    
    const characters = this.characterMemory.getAllCharacters();
    
    try {
      const response = await aiFeedbackService.generateDualFeedback({
        scene,
        mentor,
        characters
      });
      
      return response.feedback;
    } catch (error) {
      console.error('❌ FeedbackGenerator: Dual feedback generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate blended feedback from multiple mentors using AI service
   */
  async blendFeedback(
    scene: ScriptScene,
    mentors: Mentor[],
    mentorWeights: MentorWeights
  ): Promise<Feedback> {
    console.log('🎭 FeedbackGenerator: Generating blended feedback via AI service');
    
    const characters = this.characterMemory.getAllCharacters();
    
    try {
      const response = await aiFeedbackService.generateBlendedFeedback(
        scene,
        mentors,
        mentorWeights,
        characters
      );
      
      return response.feedback;
    } catch (error) {
      console.error('❌ FeedbackGenerator: Blended feedback generation failed:', error);
      throw error;
    }
  }

  /**
   * Legacy single feedback method (redirects to dual feedback)
   */
  async generateFeedback(scene: ScriptScene, mentor: Mentor): Promise<Feedback> {
    console.log('🔄 FeedbackGenerator: Legacy single feedback redirecting to dual feedback');
    return this.generateDualFeedback(scene, mentor);
  }

  /**
   * Update character memory with new information
   */
  updateCharacterMemory(character: string, note: string): void {
    this.characterMemory.updateMemory(character, note);
  }

  /**
   * Get character information
   */
  getCharacterMemory(character: string) {
    return this.characterMemory.getMemory(character);
  }

  /**
   * Analyze character consistency across scenes
   */
  analyzeCharacterConsistency(character: string, sceneContent: string): string[] {
    return this.characterMemory.analyzeCharacterConsistency(character, sceneContent);
  }
}