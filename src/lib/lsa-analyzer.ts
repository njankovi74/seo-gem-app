import { TFIDFAnalyzer, TFIDFResult } from './tfidf-analyzer';

interface LSAResult {
  conceptVectors: ConceptVector[];
  semanticSimilarity: SemanticMatch[];
  topicClusters: TopicCluster[];
  conceptStrength: number;
}

interface ConceptVector {
  concept: string;
  weight: number;
  relatedTerms: string[];
}

interface SemanticMatch {
  term1: string;
  term2: string;
  similarity: number;
}

interface TopicCluster {
  name: string;
  terms: string[];
  strength: number;
}

interface SearchIntent {
  type: 'informational' | 'commercial' | 'transactional' | 'navigational';
  confidence: number;
  indicators: string[];
}

export class LSAAnalyzer {
  private tfidfAnalyzer: TFIDFAnalyzer;
  private conceptDatabase: Map<string, string[]> = new Map();
  
  constructor() {
    this.tfidfAnalyzer = new TFIDFAnalyzer();
    this.initializeConceptDatabase();
  }

  private initializeConceptDatabase() {
    // Serbian concept associations for LSA
    this.conceptDatabase = new Map([
      // Politics
      ['politika', ['vlada', 'ministar', 'parlament', 'skupština', 'predsednik', 'izbori', 'stranka', 'koalicija', 'opozicija', 'referendum']],
      ['vlada', ['ministar', 'premijer', 'kabinet', 'sednica', 'odluka', 'uredba', 'zakon', 'politika', 'reforma']],
      ['izbori', ['glasanje', 'kandidat', 'stranka', 'lista', 'kampanja', 'birači', 'parlament', 'referendum', 'demokratija']],
      
      // Economy
      ['ekonomija', ['privreda', 'BDP', 'inflacija', 'devize', 'investicije', 'tržište', 'trgovina', 'finansije', 'banka']],
      ['privreda', ['proizvodnja', 'industrija', 'poljoprivreda', 'turizam', 'izvoz', 'uvoz', 'preduzeća', 'zaposleni']],
      ['inflacija', ['cene', 'poskupljenje', 'ekonomija', 'dinar', 'evro', 'kupovna', 'moć', 'troškovi']],
      
      // Sports
      ['sport', ['fudbal', 'košarka', 'tenis', 'vaterpolo', 'olimpijada', 'prvenstvo', 'liga', 'utakmica', 'turnir']],
      ['fudbal', ['reprezentacija', 'liga', 'utakmica', 'golovi', 'igrači', 'trener', 'stadion', 'navijači', 'transfer']],
      ['košarka', ['NBA', 'ABA', 'liga', 'utakmica', 'poeni', 'koševi', 'igrači', 'trener', 'finale']],
      
      // Health
      ['zdravlje', ['medicina', 'bolest', 'terapija', 'lečenje', 'dijagnoza', 'simptomi', 'lekar', 'bolnica', 'zdravstvo']],
      ['medicina', ['lečenje', 'terapija', 'dijagnoza', 'simptomi', 'zdravlje', 'bolest', 'lekar', 'medicinski']],
      ['bolnica', ['pacijenti', 'lečenje', 'operacija', 'zdravstvo', 'medicinski', 'osoblje', 'oprema']],
      
      // Technology
      ['tehnologija', ['digitalno', 'internet', 'kompjuter', 'softver', 'aplikacija', 'inovacije', 'AI', 'automatizacija']],
      ['internet', ['web', 'sajt', 'online', 'digitalno', 'mreža', 'povezanost', 'tehnologija']],
      ['AI', ['veštačka', 'inteligencija', 'mašinsko', 'učenje', 'algoritmi', 'automatizacija', 'robotika']],
      
      // Culture
      ['kultura', ['umetnost', 'pozorište', 'muzika', 'film', 'festival', 'nasleđe', 'tradicija', 'kreativnost']],
      ['umetnost', ['slika', 'skulptura', 'galerija', 'muzej', 'umetnik', 'kreativnost', 'kultura']],
      ['festival', ['kultura', 'umetnost', 'muzika', 'film', 'pozorište', 'manifestacija', 'događaj']],
      
      // Education
      ['obrazovanje', ['škola', 'univerzitet', 'student', 'profesor', 'nauka', 'istraživanje', 'studije', 'diploma']],
      ['univerzitet', ['fakultet', 'student', 'profesor', 'studije', 'istraživanje', 'diploma', 'akademski']],
      ['nauka', ['istraživanje', 'studija', 'rezultati', 'analiza', 'teorija', 'eksperiment', 'univerzitet']],
      
      // Environment
      ['životna', ['sredina', 'ekologija', 'priroda', 'zagađenje', 'klima', 'očuvanje', 'zaštita', 'održivost']],
      ['klima', ['promena', 'globalno', 'zagrevanje', 'temperature', 'vremenske', 'prilike', 'ekologija']],
      ['zagađenje', ['životna', 'sredina', 'vazduh', 'voda', 'otpad', 'ekologija', 'zaštita']]
    ]);
  }

  analyzeSemantics(text: string): LSAResult {
    // First, get TF-IDF analysis
    const tfidfResults = this.tfidfAnalyzer.analyze(text);
    
    // Extract concept vectors
    const conceptVectors = this.extractConceptVectors(tfidfResults.semanticCore);
    
    // Calculate semantic similarity between terms
    const semanticSimilarity = this.calculateSemanticSimilarity(tfidfResults.semanticCore);
    
    // Identify topic clusters
    const topicClusters = this.identifyTopicClusters(conceptVectors);
    
    // Calculate overall concept strength
    const conceptStrength = this.calculateConceptStrength(conceptVectors);

    return {
      conceptVectors,
      semanticSimilarity,
      topicClusters,
      conceptStrength
    };
  }

  private extractConceptVectors(semanticCore: TFIDFResult[]): ConceptVector[] {
    const vectors: ConceptVector[] = [];
    
    semanticCore.forEach(term => {
      const relatedTerms = this.findRelatedConcepts(term.word);
      const weight = term.tfidf;
      
      vectors.push({
        concept: term.word,
        weight,
        relatedTerms
      });
    });

    return vectors.sort((a, b) => b.weight - a.weight);
  }

  private findRelatedConcepts(term: string): string[] {
    const related: string[] = [];
    
    // Direct concept lookup
    if (this.conceptDatabase.has(term)) {
      related.push(...this.conceptDatabase.get(term)!);
    }
    
    // Fuzzy matching for related concepts
    for (const [concept, relatedTerms] of this.conceptDatabase.entries()) {
      if (relatedTerms.includes(term) && !related.includes(concept)) {
        related.push(concept);
      }
      
      // Check for partial matches (stemming simulation)
      if (term.length > 4) {
        const termRoot = term.substring(0, term.length - 2);
        if (concept.includes(termRoot) || relatedTerms.some(rt => rt.includes(termRoot))) {
          related.push(...relatedTerms.filter(rt => !related.includes(rt)));
        }
      }
    }
    
    return [...new Set(related)].slice(0, 8); // Limit to top 8 related terms
  }

  private calculateSemanticSimilarity(semanticCore: TFIDFResult[]): SemanticMatch[] {
    const matches: SemanticMatch[] = [];
    
    for (let i = 0; i < semanticCore.length; i++) {
      for (let j = i + 1; j < semanticCore.length; j++) {
        const term1 = semanticCore[i];
        const term2 = semanticCore[j];
        
        const similarity = this.calculateTermSimilarity(term1.word, term2.word);
        
        if (similarity > 0.3) { // Only include meaningful similarities
          matches.push({
            term1: term1.word,
            term2: term2.word,
            similarity
          });
        }
      }
    }
    
    return matches.sort((a, b) => b.similarity - a.similarity).slice(0, 10);
  }

  private calculateTermSimilarity(term1: string, term2: string): number {
    // Check for direct concept relationship
    const related1 = this.findRelatedConcepts(term1);
    const related2 = this.findRelatedConcepts(term2);
    
    if (related1.includes(term2) || related2.includes(term1)) {
      return 0.9;
    }
    
    // Check for shared concepts
    const sharedConcepts = related1.filter(concept => related2.includes(concept));
    if (sharedConcepts.length > 0) {
      return 0.7 * (sharedConcepts.length / Math.max(related1.length, related2.length));
    }
    
    // String similarity (Jaccard index for n-grams)
    return this.calculateJaccardSimilarity(term1, term2);
  }

  private calculateJaccardSimilarity(str1: string, str2: string): number {
    const ngrams1 = this.getNGrams(str1, 2);
    const ngrams2 = this.getNGrams(str2, 2);
    
    const set1 = new Set(ngrams1);
    const set2 = new Set(ngrams2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  private getNGrams(str: string, n: number): string[] {
    const ngrams: string[] = [];
    for (let i = 0; i <= str.length - n; i++) {
      ngrams.push(str.substring(i, i + n));
    }
    return ngrams;
  }

  private identifyTopicClusters(conceptVectors: ConceptVector[]): TopicCluster[] {
    const clusters: TopicCluster[] = [];
    const usedConcepts = new Set<string>();
    
    // Predefined topic patterns for Serbian content
    const topicPatterns = [
      {
        name: 'Politika',
        keywords: ['politika', 'vlada', 'ministar', 'parlament', 'izbori', 'stranka', 'predsednik'],
        threshold: 0.3
      },
      {
        name: 'Ekonomija',
        keywords: ['ekonomija', 'privreda', 'inflacija', 'banka', 'investicije', 'tržište', 'BDP'],
        threshold: 0.3
      },
      {
        name: 'Sport',
        keywords: ['sport', 'fudbal', 'košarka', 'utakmica', 'liga', 'reprezentacija', 'turnir'],
        threshold: 0.25
      },
      {
        name: 'Zdravlje',
        keywords: ['zdravlje', 'medicina', 'bolnica', 'lečenje', 'terapija', 'dijagnoza'],
        threshold: 0.25
      },
      {
        name: 'Tehnologija',
        keywords: ['tehnologija', 'internet', 'AI', 'digitalno', 'inovacije', 'automatizacija'],
        threshold: 0.25
      },
      {
        name: 'Kultura',
        keywords: ['kultura', 'umetnost', 'festival', 'pozorište', 'muzika', 'nasleđe'],
        threshold: 0.2
      }
    ];

    topicPatterns.forEach(pattern => {
      const matchingConcepts = conceptVectors.filter(cv => 
        pattern.keywords.some(keyword => 
          cv.concept.includes(keyword) || cv.relatedTerms.includes(keyword)
        ) && !usedConcepts.has(cv.concept)
      );

      if (matchingConcepts.length > 0) {
        const totalWeight = matchingConcepts.reduce((sum, cv) => sum + cv.weight, 0);
        const strength = totalWeight / conceptVectors.length;

        if (strength >= pattern.threshold) {
          clusters.push({
            name: pattern.name,
            terms: matchingConcepts.map(cv => cv.concept),
            strength
          });

          matchingConcepts.forEach(cv => usedConcepts.add(cv.concept));
        }
      }
    });

    return clusters.sort((a, b) => b.strength - a.strength);
  }

  private calculateConceptStrength(conceptVectors: ConceptVector[]): number {
    if (conceptVectors.length === 0) return 0;
    
    const totalWeight = conceptVectors.reduce((sum, cv) => sum + cv.weight, 0);
    const avgWeight = totalWeight / conceptVectors.length;
    
    // Normalize to 0-1 scale
    return Math.min(1, avgWeight * 10);
  }

  classifySearchIntent(text: string, semanticCore: TFIDFResult[]): SearchIntent {
    const indicators = {
      informational: ['kako', 'šta', 'gde', 'kada', 'zašto', 'vodič', 'objašnjenje', 'definicija', 'lista', 'saveti'],
      commercial: ['najbolji', 'recenzija', 'poređenje', 'iskustva', 'alternativa', 'preporuke', 'izbor', 'opcije'],
      transactional: ['kupi', 'cena', 'popust', 'prodaja', 'naruči', 'rezerviši', 'preuzmi', 'instaliraj'],
      navigational: ['sajt', 'portal', 'homepage', 'kontakt', 'adresa', 'lokacija', 'oficijalni']
    };

    const scores = {
      informational: 0,
      commercial: 0,
      transactional: 0,
      navigational: 0
    };

    const lowerText = text.toLowerCase();
    const foundIndicators: string[] = [];

    Object.entries(indicators).forEach(([intent, keywords]) => {
      keywords.forEach(keyword => {
        if (lowerText.includes(keyword)) {
          scores[intent as keyof typeof scores] += 1;
          foundIndicators.push(keyword);
        }
      });
    });

    // Additional heuristics based on semantic core
    semanticCore.forEach(term => {
      const word = term.word.toLowerCase();
      if (word.includes('kako') || word.includes('vodič')) scores.informational += 2;
      if (word.includes('najbolji') || word.includes('recenzija')) scores.commercial += 2;
      if (word.includes('cena') || word.includes('kupi')) scores.transactional += 2;
    });

    const maxScore = Math.max(...Object.values(scores));
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    
    if (totalScore === 0) {
      return { type: 'informational', confidence: 0.5, indicators: [] };
    }

    const intentType = Object.entries(scores).find(([, score]) => score === maxScore)?.[0] as keyof typeof scores;
    const confidence = maxScore / totalScore;

    return {
      type: intentType,
      confidence,
      indicators: foundIndicators.slice(0, 5)
    };
  }
}