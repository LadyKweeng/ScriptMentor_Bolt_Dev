// src/utils/scriptChunker.ts
import { ScriptChunk, FullScript, Character } from '../types';

export interface ChunkingOptions {
  strategy: 'pages' | 'acts' | 'sequences';
  pagesPerChunk?: number; // For page-based chunking (default: 15)
  approximateLinesPerPage?: number; // Industry standard: ~50-55 lines
}

export class ScriptChunker {
  private static readonly DEFAULT_LINES_PER_PAGE = 52;
  private static readonly DEFAULT_PAGES_PER_CHUNK = 15;

  /**
   * Main entry point - chunks a script based on strategy
   */
  static chunkScript(
    content: string, 
    title: string, 
    characters: Record<string, Character>,
    options: ChunkingOptions = { strategy: 'pages' }
  ): FullScript {
    console.log('📄 Chunking script:', {
      title,
      contentLength: content.length,
      strategy: options.strategy,
      characterCount: Object.keys(characters).length
    });

    const totalPages = this.estimatePageCount(content, options.approximateLinesPerPage);
    let chunks: ScriptChunk[] = [];

    switch (options.strategy) {
      case 'acts':
        chunks = this.chunkByActs(content, title);
        break;
      case 'sequences':
        chunks = this.chunkBySequences(content, title);
        break;
      case 'pages':
      default:
        chunks = this.chunkByPages(content, title, options.pagesPerChunk || this.DEFAULT_PAGES_PER_CHUNK);
        break;
    }

    // Add character analysis to each chunk
    chunks = chunks.map(chunk => ({
      ...chunk,
      characters: this.extractCharactersFromChunk(chunk.content, characters)
    }));

    console.log('✅ Script chunked successfully:', {
      totalChunks: chunks.length,
      averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length),
      strategy: options.strategy
    });

    return {
      id: `script_${title.replace(/\s+/g, '_')}_${Date.now()}`,
      title,
      originalContent: content,
      processedContent: content,
      chunks,
      characters,
      totalPages,
      chunkingStrategy: options.strategy
    };
  }

  /**
   * Chunk by page intervals (most reliable for feedback)
   */
  private static chunkByPages(content: string, title: string, pagesPerChunk: number): ScriptChunk[] {
    const lines = content.split('\n');
    const linesPerPage = this.DEFAULT_LINES_PER_PAGE;
    const linesPerChunk = pagesPerChunk * linesPerPage;
    const chunks: ScriptChunk[] = [];

    for (let i = 0; i < lines.length; i += linesPerChunk) {
      const chunkLines = lines.slice(i, Math.min(i + linesPerChunk, lines.length));
      const startPage = Math.floor(i / linesPerPage) + 1;
      const endPage = Math.floor((i + chunkLines.length - 1) / linesPerPage) + 1;
      const chunkIndex = Math.floor(i / linesPerChunk);

      chunks.push({
        id: `${title}_chunk_${chunkIndex}`,
        title: `Pages ${startPage}-${endPage}`,
        content: chunkLines.join('\n'),
        characters: [], // Will be populated later
        startPage,
        endPage,
        chunkType: 'pages',
        chunkIndex
      });
    }

    return chunks;
  }

  /**
   * Chunk by dramatic acts (more story-aware)
   */
  private static chunkByActs(content: string, title: string): ScriptChunk[] {
    const chunks: ScriptChunk[] = [];
    const lines = content.split('\n');
    
    // Look for common act break indicators
    const actBreakPatterns = [
      /FADE OUT/i,
      /END OF ACT/i,
      /ACT\s+(II|III|2|3)/i,
      /MIDPOINT/i,
      /CLIMAX/i
    ];

    const potentialBreaks: number[] = [0]; // Always start with beginning
    
    lines.forEach((line, index) => {
      actBreakPatterns.forEach(pattern => {
        if (pattern.test(line.trim())) {
          potentialBreaks.push(index);
        }
      });
    });

    potentialBreaks.push(lines.length - 1); // Always end with last line
    
    // Remove duplicates and sort
    const breakPoints = [...new Set(potentialBreaks)].sort((a, b) => a - b);

    // If we don't find clear act breaks, fall back to three equal parts
    if (breakPoints.length <= 2) {
      const third = Math.floor(lines.length / 3);
      return [
        {
          id: `${title}_act_1`,
          title: 'Act I',
          content: lines.slice(0, third).join('\n'),
          characters: [],
          chunkType: 'act',
          chunkIndex: 0
        },
        {
          id: `${title}_act_2`,
          title: 'Act II',
          content: lines.slice(third, third * 2).join('\n'),
          characters: [],
          chunkType: 'act',
          chunkIndex: 1
        },
        {
          id: `${title}_act_3`,
          title: 'Act III',
          content: lines.slice(third * 2).join('\n'),
          characters: [],
          chunkType: 'act',
          chunkIndex: 2
        }
      ];
    }

    // Create chunks based on detected breaks
    for (let i = 0; i < breakPoints.length - 1; i++) {
      const startLine = breakPoints[i];
      const endLine = breakPoints[i + 1];
      const chunkContent = lines.slice(startLine, endLine).join('\n');
      
      chunks.push({
        id: `${title}_act_${i + 1}`,
        title: `Act ${this.getRomanNumeral(i + 1)}`,
        content: chunkContent,
        characters: [],
        chunkType: 'act',
        chunkIndex: i
      });
    }

    return chunks;
  }

  /**
   * Chunk by sequences (scene groupings)
   */
  private static chunkBySequences(content: string, title: string): ScriptChunk[] {
    const lines = content.split('\n');
    const chunks: ScriptChunk[] = [];
    const sequenceSize = Math.max(Math.floor(lines.length / 8), 200); // Aim for ~8 sequences

    let currentSequence = 1;
    for (let i = 0; i < lines.length; i += sequenceSize) {
      const chunkLines = lines.slice(i, Math.min(i + sequenceSize, lines.length));
      
      chunks.push({
        id: `${title}_seq_${currentSequence}`,
        title: `Sequence ${currentSequence}`,
        content: chunkLines.join('\n'),
        characters: [],
        chunkType: 'sequence',
        chunkIndex: currentSequence - 1
      });

      currentSequence++;
    }

    return chunks;
  }

  /**
   * Extract characters that appear in this specific chunk
   */
  private static extractCharactersFromChunk(
    chunkContent: string, 
    allCharacters: Record<string, Character>
  ): string[] {
    const chunkCharacters = new Set<string>();
    const characterNames = Object.keys(allCharacters);
    
    characterNames.forEach(name => {
      // Look for character names in dialogue headers or action lines
      const namePattern = new RegExp(`\\b${name.toUpperCase()}\\b`, 'gi');
      if (namePattern.test(chunkContent)) {
        chunkCharacters.add(name);
      }
    });

    return Array.from(chunkCharacters);
  }

  /**
   * Estimate page count based on line count
   */
  private static estimatePageCount(content: string, linesPerPage = this.DEFAULT_LINES_PER_PAGE): number {
    const lines = content.split('\n').length;
    return Math.ceil(lines / linesPerPage);
  }

  /**
   * Convert numbers to Roman numerals for act titles
   */
  private static getRomanNumeral(num: number): string {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
    return romanNumerals[num - 1] || num.toString();
  }

  /**
   * Analyze script to recommend best chunking strategy
   */
  static recommendChunkingStrategy(content: string): ChunkingOptions {
    const lines = content.split('\n');
    const estimatedPages = this.estimatePageCount(content);
    
    // Count potential act breaks
    const actBreakCount = lines.filter(line => 
      /FADE OUT|END OF ACT|ACT\s+(II|III|2|3)|MIDPOINT|CLIMAX/i.test(line)
    ).length;

    // Count scene headers
    const sceneCount = lines.filter(line => 
      /^(INT\.|EXT\.)/i.test(line.trim())
    ).length;

    console.log('📊 Script analysis for chunking:', {
      estimatedPages,
      actBreakCount,
      sceneCount,
      contentLength: content.length
    });

    // Recommendation logic
    if (estimatedPages <= 30) {
      return { strategy: 'pages', pagesPerChunk: 15 };
    } else if (actBreakCount >= 2 && estimatedPages > 80) {
      return { strategy: 'acts' };
    } else if (sceneCount > 20 && estimatedPages > 60) {
      return { strategy: 'sequences' };
    } else {
      return { strategy: 'pages', pagesPerChunk: 12 };
    }
  }
}