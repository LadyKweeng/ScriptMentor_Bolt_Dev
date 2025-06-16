// src/utils/scriptFormatter.ts

/**
 * Screenplay Formatter that preserves original sequence
 * Fixes the issue where action and dialogue blocks get jumbled
 */

 export const processSceneText = (sceneText: string): string => {
  try {
    // Split into lines and process sequentially to maintain order
    const lines = sceneText.split('\n');
    const result: string[] = [];
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i].trim();
      
      // Skip empty lines but preserve spacing
      if (!line) {
        // Only add empty line if previous wasn't empty
        if (result.length > 0 && result[result.length - 1] !== '') {
          result.push('');
        }
        i++;
        continue;
      }
      
      // Scene headings (INT./EXT.)
      if (line.match(/^(INT\.|EXT\.|EST\.|I\/E\.)/i)) {
        // Add spacing before scene heading if needed
        if (result.length > 0 && result[result.length - 1] !== '') {
          result.push('');
        }
        result.push(line.toUpperCase());
        result.push(''); // Add spacing after scene heading
        i++;
        continue;
      }
      
      // Character names (ALL CAPS, not scene headings)
      if (isCharacterName(line)) {
        // Add spacing before character name if needed
        if (result.length > 0 && result[result.length - 1] !== '') {
          result.push('');
        }
        
        // Format character name properly
        result.push(formatCharacterName(line));
        i++;
        
        // Process all dialogue that follows this character
        while (i < lines.length) {
          const nextLine = lines[i].trim();
          
          // Stop if we hit an empty line or new character/scene
          if (!nextLine) {
            break;
          }
          
          // Stop if we hit a new character name or scene heading
          if (isCharacterName(nextLine) || nextLine.match(/^(INT\.|EXT\.|EST\.|I\/E\.)/i)) {
            break;
          }
          
          // Add dialogue/parenthetical line
          result.push(nextLine);
          i++;
        }
        
        // Add spacing after dialogue block
        result.push('');
        continue;
      }
      
      // Transitions (CUT TO:, FADE TO:, etc.)
      if (line.match(/TO:$/i) && line === line.toUpperCase()) {
        if (result.length > 0 && result[result.length - 1] !== '') {
          result.push('');
        }
        result.push(line.toUpperCase());
        result.push('');
        i++;
        continue;
      }
      
      // Everything else is action text
      // Add spacing before action if needed
      if (result.length > 0 && result[result.length - 1] !== '') {
        result.push('');
      }
      
      result.push(line);
      result.push(''); // Add spacing after action
      i++;
    }
    
    // Clean up trailing empty lines
    while (result.length > 0 && result[result.length - 1] === '') {
      result.pop();
    }
    
    return result.join('\n');
    
  } catch (error) {
    console.error('Error in script formatting:', error);
    return sceneText; // Return original on error
  }
};

// Helper function to identify character names
function isCharacterName(line: string): boolean {
  const trimmed = line.trim();
  
  // Must be uppercase
  if (trimmed !== trimmed.toUpperCase()) {
    return false;
  }
  
  // Must be reasonable length for a character name
  if (trimmed.length === 0 || trimmed.length > 30) {
    return false;
  }
  
  // Must not be a scene heading
  if (trimmed.match(/^(INT\.|EXT\.|EST\.|I\/E\.)/i)) {
    return false;
  }
  
  // Must not be a transition
  if (trimmed.match(/^(CUT TO:|FADE TO:|DISSOLVE TO:)/i)) {
    return false;
  }
  
  return true;
}

// Helper function to format character names consistently
function formatCharacterName(line: string): string {
  const trimmed = line.trim();
  
  // Handle parentheticals like (V.O.), (O.S.)
  if (trimmed.includes('(')) {
    const baseName = trimmed.substring(0, trimmed.indexOf('(')).trim();
    const extension = trimmed.substring(trimmed.indexOf('(')).trim();
    return baseName.toUpperCase() + ' ' + extension.toUpperCase();
  }
  
  return trimmed.toUpperCase();
}