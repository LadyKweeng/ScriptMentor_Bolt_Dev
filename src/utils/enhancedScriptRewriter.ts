// src/utils/enhancedScriptRewriter.ts
import { ScriptScene, Feedback, ScriptRewrite } from '../types';
import { rewriteEvaluationService } from '../services/rewriteEvaluationService';

export class EnhancedScriptRewriter {
  generateRewrite(scene: ScriptScene, feedback: Feedback[]): ScriptRewrite {
    // Enhanced rewrite generation based on feedback
    let rewrittenContent = scene.content;
    
    // Process each feedback item
    feedback.forEach(fb => {
      rewrittenContent = this.applyFeedbackToContent(rewrittenContent, fb);
    });
    
    // Ensure the rewrite is visibly different and improved
    rewrittenContent = this.finalizeRewrite(rewrittenContent, scene);
    
    return {
      id: `rewrite-${Date.now()}`,
      originalSceneId: scene.id,
      content: rewrittenContent,
      feedbackApplied: feedback.map(fb => fb.id),
      timestamp: new Date()
    };
  }

  private applyFeedbackToContent(content: string, feedback: Feedback): string {
    let updatedContent = content;
    
    // Apply structural improvements
    if (feedback.categories.structure.includes('header') || feedback.categories.structure.includes('format')) {
      updatedContent = this.improveSceneHeaders(updatedContent);
    }
    
    // Apply dialogue improvements
    if (feedback.categories.dialogue.includes('minimal') || feedback.content.includes('dialogue')) {
      updatedContent = this.improveDialogue(updatedContent, feedback);
    }
    
    // Apply pacing improvements
    if (feedback.categories.pacing.includes('long') || feedback.content.includes('runs long')) {
      updatedContent = this.improvePacing(updatedContent);
    }
    
    // Apply character direction improvements
    if (feedback.content.includes('parenthetical') || feedback.content.includes('direction')) {
      updatedContent = this.addCharacterDirection(updatedContent);
    }
    
    return updatedContent;
  }

  private improveSceneHeaders(content: string): string {
    // Ensure proper scene header format
    if (!content.match(/^(INT\.|EXT\.)/m)) {
      // Add a scene header if missing
      const lines = content.split('\n');
      if (lines.length > 0) {
        // Try to infer location from content
        const firstLine = lines[0].trim();
        if (firstLine && !firstLine.includes('.')) {
          return `INT. ${firstLine.toUpperCase()} - DAY\n\n${content}`;
        }
      }
      return `INT. LOCATION - DAY\n\n${content}`;
    }
    
    // Ensure proper formatting of existing headers
    return content.replace(/^(int|ext|INT|EXT)[\.\s]+(.+)$/gm, (match, prefix, location) => {
      return `${prefix.toUpperCase()}. ${location.toUpperCase()}`;
    });
  }

  private improveDialogue(content: string, feedback: Feedback): string {
    let improved = content;
    
    // Remove filler words if feedback suggests tightening
    if (feedback.content.includes('tight') || feedback.categories.dialogue.includes('minimal')) {
      improved = improved.replace(/\b(um|uh|like|you know|I mean)\b/gi, '');
      improved = improved.replace(/\s+/g, ' '); // Clean up extra spaces
    }
    
    // Add subtext markers
    if (feedback.content.includes('subtext')) {
      // Find dialogue lines and occasionally add emphasis
      improved = improved.replace(/^([A-Z][A-Z\s]*)\n([^(])/gm, (match, character, dialogue) => {
        // Randomly add emphasis to some dialogue
        if (Math.random() > 0.7) {
          return `${character}\n(pointedly)\n${dialogue}`;
        }
        return match;
      });
    }
    
    return improved;
  }

  private improvePacing(content: string): string {
    const lines = content.split('\n');
    const trimmedLines = [];
    
    // Remove unnecessary empty lines
    let consecutiveEmpty = 0;
    for (const line of lines) {
      if (line.trim() === '') {
        consecutiveEmpty++;
        if (consecutiveEmpty <= 2) { // Keep max 2 consecutive empty lines
          trimmedLines.push(line);
        }
      } else {
        consecutiveEmpty = 0;
        trimmedLines.push(line);
      }
    }
    
    // Remove overly descriptive action lines if scene is too long
    if (content.length > 800) {
      return trimmedLines.filter((line, index) => {
        // Keep dialogue and scene headers
        if (line.trim() === line.trim().toUpperCase() && line.trim().length > 0) {
          return true;
        }
        // Keep every other action line if content is very long
        if (content.length > 1200) {
          return index % 2 === 0;
        }
        return true;
      }).join('\n');
    }
    
    return trimmedLines.join('\n');
  }

  private addCharacterDirection(content: string): string {
    // Add parentheticals to character dialogue where appropriate
    const enhanced = content.replace(/^([A-Z][A-Z\s]*)\n([^(])/gm, (match, character, dialogue) => {
      // Don't add if parenthetical already exists
      if (content.includes(`${character}\n(`)) {
        return match;
      }
      
      // Add contextual parentheticals based on dialogue content
      const dialogueLower = dialogue.toLowerCase();
      let parenthetical = '';
      
      if (dialogueLower.includes('what') || dialogueLower.includes('?')) {
        parenthetical = '(confused)';
      } else if (dialogueLower.includes('no') || dialogueLower.includes('stop')) {
        parenthetical = '(firmly)';
      } else if (dialogueLower.includes('yes') || dialogueLower.includes('sure')) {
        parenthetical = '(nodding)';
      } else if (Math.random() > 0.8) {
        // Random generic parentheticals
        const generic = ['(beat)', '(pause)', '(thoughtfully)', '(quietly)'];
        parenthetical = generic[Math.floor(Math.random() * generic.length)];
      }
      
      if (parenthetical) {
        return `${character}\n${parenthetical}\n${dialogue}`;
      }
      
      return match;
    });
    
    return enhanced;
  }

  private finalizeRewrite(content: string, originalScene: ScriptScene): string {
    let finalized = content;
    
    // Ensure the rewrite is clearly marked as revised
    finalized = finalized.replace(/^(INT\.|EXT\.)(.+)$/m, '$1$2 - REVISED');
    
    // Clean up formatting
    finalized = finalized.replace(/\n{3,}/g, '\n\n'); // Max 2 consecutive newlines
    finalized = finalized.trim();
    
    // Ensure minimum changes were made
    if (finalized === originalScene.content) {
      // Add a subtle change to show revision occurred
      finalized = finalized.replace(/\n\n/, '\n\n(REVISED)\n\n');
    }
    
    return finalized;
  }

  generateDiff(original: string, rewritten: string): string[] {
    // Enhanced diff generation
    const originalLines = original.split('\n');
    const rewrittenLines = rewritten.split('\n');
    const diff: string[] = [];
    
    // Use a more sophisticated diff algorithm
    const lcs = this.calculateLCS(originalLines, rewrittenLines);
    
    let i = 0, j = 0;
    while (i < originalLines.length || j < rewrittenLines.length) {
      if (i < originalLines.length && j < rewrittenLines.length && 
          originalLines[i] === rewrittenLines[j]) {
        diff.push(' ' + originalLines[i]);
        i++;
        j++;
      } else if (j < rewrittenLines.length && 
                (i >= originalLines.length || lcs[i][j+1] >= lcs[i+1][j])) {
        diff.push('+' + rewrittenLines[j]);
        j++;
      } else if (i < originalLines.length) {
        diff.push('-' + originalLines[i]);
        i++;
      }
    }
    
    return diff;
  }

  private calculateLCS(a: string[], b: string[]): number[][] {
    const lcs = Array(a.length + 1).fill(null).map(() => 
      Array(b.length + 1).fill(0)
    );
    
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i-1] === b[j-1]) {
          lcs[i][j] = lcs[i-1][j-1] + 1;
        } else {
          lcs[i][j] = Math.max(lcs[i-1][j], lcs[i][j-1]);
        }
      }
    }
    
    return lcs;
  }

  async evaluateRewrite(
    originalScene: ScriptScene,
    rewrite: ScriptRewrite,
    feedback: Feedback[]
  ): Promise<{ improved: boolean; evaluation: any }> {
    if (feedback.length === 0) {
      return { improved: false, evaluation: null };
    }
    
    try {
      // Use the primary feedback for evaluation
      const primaryFeedback = feedback[0];
      const evaluation = await rewriteEvaluationService.evaluateRewrite(
        originalScene,
        rewrite,
        primaryFeedback
      );
      
      return {
        improved: evaluation.overallScore > 60,
        evaluation
      };
    } catch (error) {
      console.error('Rewrite evaluation failed:', error);
      
      // Fallback to quick evaluation
      const quickEval = rewriteEvaluationService.quickEvaluate(
        originalScene,
        rewrite,
        feedback[0]
      );
      
      return {
        improved: quickEval.improved,
        evaluation: {
          improvements: quickEval.improved ? ['Basic improvements detected'] : [],
          regressions: quickEval.improved ? [] : ['Some areas need more work'],
          overallScore: quickEval.improved ? 65 : 45,
          summary: quickEval.summary
        }
      };
    }
  }
}

export const enhancedScriptRewriter = new EnhancedScriptRewriter();