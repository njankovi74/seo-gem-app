// Serbian stop words list
export const serbianStopWords = new Set([
  // Common Serbian stop words
  'a', 'al', 'ali', 'bi', 'bio', 'bila', 'bile', 'bili', 'bilo', 'biće', 'bih', 'bu', 'da', 'do', 'ga', 'god', 'će', 'čak', 'da', 'dr', 'dug', 'duh', 'dok', 'dom', 'dan', 'dat', 'duž', 'el', 'eq', 'et', 'fa', 'fe', 'gi', 'go', 'ha', 'ho', 'hr', 'hm', 'je', 'jer', 'ji', 'jo', 'ka', 'ko', 'ku', 'li', 'ma', 'me', 'mi', 'mu', 'na', 'ne', 'ni', 'no', 'nu', 'od', 'oh', 'ok', 'pa', 'po', 'pr', 'ra', 're', 'se', 'si', 'so', 'su', 'ta', 'te', 'ti', 'to', 'tu', 'tv', 'uv', 've', 'vo', 'za', 'že',
  
  // Pronouns
  'ja', 'ti', 'on', 'ona', 'ono', 'mi', 'vi', 'oni', 'one', 'ova', 'taj', 'ova', 'ovo', 'ovaj', 'moj', 'tvoj', 'njegov', 'njen', 'naš', 'vaš', 'njihov', 'koja', 'koje', 'koji', 'koju', 'kome', 'čiji', 'čija', 'čije', 'samo', 'sve', 'sva', 'svak', 'neki', 'neka', 'neko', 'ništa', 'niko', 'nikoga', 'nikome', 'svima', 'svemu', 'svega',
  
  // Prepositions and conjunctions
  'bez', 'bez', 'bilo', 'blizu', 'zbog', 'dok', 'duž', 'gdje', 'kako', 'kada', 'kroz', 'među', 'nad', 'oko', 'pod', 'pred', 'preko', 'prije', 'protiv', 'takođe', 'takođe', 'upravo', 'van', 'više', 'gdje', 'zašto', 'zato', 'gdje', 'gdje', 'odakle', 'dokle', 'kamo', 'kuda', 'kada', 'dokad', 'otkad', 'koliko', 'kako', 'zašto', 'zato',
  
  // Common verbs
  'biti', 'bio', 'bila', 'bilo', 'biti', 'budem', 'budemo', 'budeš', 'budete', 'bude', 'budu', 'jesam', 'jesi', 'jeste', 'jest', 'jesmo', 'jeste', 'jesu', 'sam', 'si', 'smo', 'ste', 'su', 'želim', 'želiš', 'želi', 'želimo', 'želite', 'žele', 'hteo', 'htela', 'hteli', 'htele', 'htelo', 'hoću', 'hoćeš', 'hoće', 'hoćemo', 'hoćete', 'ću', 'ćeš', 'će', 'ćemo', 'ćete', 'mogu', 'možeš', 'može', 'možemo', 'možete', 'mogu', 'moramo', 'moraš', 'mora', 'moramo', 'morate', 'moraju', 'treba', 'trebam', 'trebaš', 'trebamo', 'trebate', 'trebaju', 'ima', 'imamo', 'imaš', 'imaju', 'imaju', 'nema', 'nemamo', 'nemaš', 'nemaju',
  
  // Auxiliary words
  'ovo', 'ovde', 'ovdje', 'onde', 'tamo', 'sada', 'sad', 'tada', 'pre', 'prije', 'posle', 'poslije', 'uvek', 'uvijek', 'nikad', 'nikada', 'već', 'još', 'tek', 'već', 'baš', 'prilično', 'vrlo', 'dosta', 'malo', 'mnogo', 'najbolji', 'najbolja', 'najbolje', 'dobro', 'loše', 'jako', 'jako',
  
  // Articles and particles
  'jedan', 'jedna', 'jedno', 'prvi', 'prva', 'prvo', 'drugi', 'druga', 'drugo', 'treći', 'treća', 'treće', 'poslednji', 'poslednja', 'poslednje', 'oba', 'obe', 'oboje',
  
  // Question words
  'ko', 'što', 'šta', 'gdje', 'gde', 'kada', 'kad', 'kako', 'zašto', 'zbog', 'koga', 'kome', 'čiji', 'čija', 'čije', 'koliko', 'kojem', 'kojoj', 'kojim', 'kojima',
  
  // Time indicators
  'danas', 'sutra', 'juče', 'jučer', 'prekjučer', 'prekosutra', 'noću', 'ujutru', 'popodne', 'uveče', 'uvečer', 'noćas', 'jutros', 'sinoć', 'godina', 'godine', 'godinu', 'mesec', 'meseca', 'mjesec', 'mjeseca', 'dan', 'dana', 'dani', 'sat', 'sata', 'sati', 'minut', 'minuta', 'sekund', 'sekunde', 'vreme', 'vrijeme', 'vremena',
  
  // Common adjectives
  'nov', 'nova', 'novo', 'novi', 'nove', 'stari', 'stara', 'staro', 'veliki', 'velika', 'veliko', 'mali', 'mala', 'malo', 'dobro', 'dobar', 'dobra', 'loš', 'loša', 'loše', 'čist', 'čista', 'čisto', 'prost', 'prosta', 'prosto', 'mlad', 'mlada', 'mlado', 'staro', 'crn', 'crna', 'crno', 'beo', 'bela', 'belo', 'bijel', 'bijela', 'bijelo',
  
  // Numbers
  'nula', 'jedan', 'dva', 'tri', 'četiri', 'pet', 'šest', 'sedam', 'osam', 'devet', 'deset', 'jedanaest', 'dvanaest', 'trinaest', 'četrnaest', 'petnaest', 'šesnaest', 'sedamnaest', 'osamnaest', 'devetnaest', 'dvadeset', 'trideset', 'četrdeset', 'pedeset', 'šezdeset', 'sedamdeset', 'osamdeset', 'devedeset', 'sto', 'hiljada', 'hiljade', 'tisuća', 'tisuće', 'milion', 'milijun', 'milijuna',
  
  // Common expressions
  'dakle', 'inače', 'ipak', 'takođe', 'takође', 'zapravo', 'naime', 'međutim', 'međutim', 'prije', 'svega', 'najviše', 'najmanje', 'uvek', 'uvijek', 'često', 'retko', 'ponekad', 'katkad', 'nekad', 'nekada', 'uvek', 'baš', 'samo', 'tek', 'čak', 'još'
]);

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

  constructor() {
    // Initialize with a base corpus for Serbian language
    this.initializeBasicCorpus();
  }

  private initializeBasicCorpus() {
    // Basic Serbian corpus for IDF calculation
    const basicCorpus = [
      'politika vlada srbija beograd novi sad niš kragujevac subotica',
      'sport fudbal košarka tenis olimpijada utakmica turnir liga',
      'ekonomija privreda inflacija banka kredit evro dinar',
      'kultura pozorište film muzika umetnost festival koncert',
      'zdravlje medicina lekar bolnica tretman terapija',
      'tehnologija kompjuter internet digitalni inovacija AI',
      'obrazovanje škola univerzitet student profesor nauka',
      'životna sredina ekologija klima zagađenje priroda',
      'turizam putovanje odmor destinacija hotel restoran',
      'nauka istraživanje studija rezultat analiza podatak'
    ];

    basicCorpus.forEach(doc => this.addDocument(doc));
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
    return text
      .toLowerCase()
      .replace(/[^\w\sčćžšđČĆŽŠĐ]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length > 2 && 
        !serbianStopWords.has(word) &&
        !/^\d+$/.test(word) // Remove pure numbers
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
    // Simple concept expansion based on semantic similarity
    const concepts: string[] = [];
    
    semanticCore.slice(0, 10).forEach(term => {
      const word = term.word;
      
      // Add related concepts based on common Serbian word patterns and associations
      if (word.includes('politik')) concepts.push('vlada', 'izbori', 'stranka', 'parlament');
      if (word.includes('ekonom') || word.includes('privreda')) concepts.push('tržište', 'investicije', 'rast', 'razvoj');
      if (word.includes('sport')) concepts.push('liga', 'utakmica', 'trener', 'igrač');
      if (word.includes('kultur')) concepts.push('umetnost', 'festival', 'tradicija', 'nasleđe');
      if (word.includes('zdravlj')) concepts.push('medicina', 'terapija', 'prevencija', 'dijagnoza');
      if (word.includes('tehnolog')) concepts.push('inovacije', 'digitalizacija', 'automatizacija', 'AI');
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