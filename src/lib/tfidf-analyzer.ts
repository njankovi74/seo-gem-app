import { getLanguageConfig, type SupportedLanguage } from './i18n';

// Backward-compatible export: Serbian stopwords for any code still using `serbianStopWords` directly
export const serbianStopWords = new Set(getLanguageConfig('sr').stopWords);

interface WordFrequency {
  [word: string]: number;
}

export interface TFIDFResult {
  word: string;
  tf: number;
  idf: number;
  tfidf: number;
}

interface SemanticAnalysisResult {
  semanticCore: TFIDFResult[];
  keyPhrases: string[];
  conceptCloud: string[];
  totalWords: number;
  uniqueWords: number;
  averageWordLength: number;
  readabilityScore: number;
}

export class TFIDFAnalyzer {
  private documents: string[] = [];
  private vocabulary: Set<string> = new Set();
  private documentFrequency: WordFrequency = {};
  private language: SupportedLanguage;
  private stopWords: Set<string>;
  private allowedChars: string;

  constructor(language: SupportedLanguage = 'sr') {
    this.language = language;
    const config = getLanguageConfig(language);
    this.stopWords = new Set(config.stopWords);
    this.allowedChars = config.tokenizer.allowedChars;
    this.initializeBasicCorpus();
  }

  private initializeBasicCorpus() {
    const config = getLanguageConfig(this.language);
    config.basicCorpus.forEach(doc => this.addDocument(doc));
  }

  addDocument(text: string) {
    const words = this.tokenize(text);
    this.documents.push(text);
    
    const uniqueWords = new Set(words);
    uniqueWords.forEach(word => {
      this.vocabulary.add(word);
      this.documentFrequency[word] = (this.documentFrequency[word] || 0) + 1;
    });
  }

  private tokenize(text: string): string[] {
    // Build regex with language-specific allowed characters
    const extraChars = this.allowedChars || 'čćžšđČĆŽŠĐ';
    const regex = new RegExp(`[^\\w\\s${extraChars.replace(/[-[\]{}()*+?.,\\^$|#]/g, '\\$&')}']`, 'g');
    return text
      .toLowerCase()
      .replace(regex, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !this.stopWords.has(word) &&
        !/^\d+$/.test(word)
      );
  }

  private calculateTF(word: string, document: string[]): number {
    const termFrequency = document.filter(w => w === word).length;
    return termFrequency / document.length;
  }

  private calculateIDF(word: string): number {
    const documentsWithTerm = this.documentFrequency[word] || 1;
    return Math.log(this.documents.length / documentsWithTerm);
  }

  analyze(text: string): SemanticAnalysisResult {
    // Add the document to corpus for analysis
    this.addDocument(text);
    
    const words = this.tokenize(text);
    const wordFrequency: WordFrequency = {};
    
    // Calculate word frequencies
    words.forEach(word => {
      wordFrequency[word] = (wordFrequency[word] || 0) + 1;
    });

    // Calculate TF-IDF for each unique word
    const tfidfResults: TFIDFResult[] = [];
    
    Object.keys(wordFrequency).forEach(word => {
      const tf = this.calculateTF(word, words);
      const idf = this.calculateIDF(word);
      const tfidf = tf * idf;
      
      tfidfResults.push({
        word,
        tf,
        idf,
        tfidf
      });
    });

    // Sort by TF-IDF score
    const semanticCore = tfidfResults
      .sort((a, b) => b.tfidf - a.tfidf)
      .slice(0, 20); // Top 20 terms

    // Extract key phrases (bigrams and trigrams)
    const keyPhrases = this.extractKeyPhrases(text);
    
    // Generate concept cloud (related terms)
    const conceptCloud = this.generateConceptCloud(semanticCore);

    // Calculate readability score (simplified)
    const readabilityScore = this.calculateReadabilityScore(text);

    return {
      semanticCore,
      keyPhrases,
      conceptCloud,
      totalWords: words.length,
      uniqueWords: Object.keys(wordFrequency).length,
      averageWordLength: words.reduce((sum, word) => sum + word.length, 0) / words.length,
      readabilityScore
    };
  }

  private extractKeyPhrases(text: string): string[] {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const phrases: string[] = [];

    sentences.forEach(sentence => {
      const words = this.tokenize(sentence);
      
      // Extract bigrams
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        phrases.push(bigram);
      }
      
      // Extract trigrams
      for (let i = 0; i < words.length - 2; i++) {
        const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
        phrases.push(trigram);
      }
    });

    // Count phrase frequencies and return top phrases
    const phraseFreq: WordFrequency = {};
    phrases.forEach(phrase => {
      phraseFreq[phrase] = (phraseFreq[phrase] || 0) + 1;
    });

    return Object.entries(phraseFreq)
      .filter(([phrase, freq]) => freq > 1) // Only phrases that appear more than once
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([phrase]) => phrase);
  }

  private generateConceptCloud(semanticCore: TFIDFResult[]): string[] {
    const config = getLanguageConfig(this.language);
    const associations = config.conceptAssociations;
    const concepts: string[] = [];
    
    semanticCore.slice(0, 10).forEach(term => {
      const word = term.word.toLowerCase();
      // Match against concept keys from i18n config
      for (const [key, related] of Object.entries(associations)) {
        if (word.includes(key.substring(0, Math.min(key.length, 5)))) {
          concepts.push(...related);
        }
      }
    });

    return [...new Set(concepts)].slice(0, 20);
  }

  private calculateReadabilityScore(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
    const words = this.tokenize(text);
    const complexWords = words.filter(word => word.length > 6).length;
    
    // Simplified readability score for Serbian
    const avgWordsPerSentence = words.length / sentences;
    const complexWordRatio = complexWords / words.length;
    
    // Lower score = more readable
    const score = (avgWordsPerSentence * 0.39) + (complexWordRatio * 100 * 11.8) - 15.59;
    
    // Normalize to 0-100 scale (higher = more readable)
    return Math.max(0, Math.min(100, 100 - score));
  }
}