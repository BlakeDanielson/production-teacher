import { AnalysisType } from '@/types';

interface PromptTest {
  id: string;
  name: string;
  prompt: string;
  description?: string;
}

export interface TestResult {
  promptId: string;
  promptName: string;
  response: string;
  videoUrl: string;
  videoTitle?: string;
  timestamp: string;
  analysisType: AnalysisType;
  executionTimeMs: number;
}

interface TestConfig {
  videoUrl: string;
  analysisType: AnalysisType;
  googleApiKey: string;
}

// Collection of prompt tests
const promptTests: PromptTest[] = [
  {
    id: 'default',
    name: 'Default Prompt',
    prompt: "Analyze the provided media (video or audio). Provide a concise summary, identify key topics/segments, suggest potential improvements for engagement (e.g., pacing, clarity, visuals if applicable), and give an overall quality score (1-10). Format the response using Markdown.",
    description: 'The standard prompt used by the application'
  },
  {
    id: 'detailed_production',
    name: 'Detailed Production Analysis',
    prompt: `Analyze this video with a focus on production techniques. Include detailed feedback on:
1. Visual quality (lighting, camera work, composition)
2. Audio quality (clarity, background noise, music)
3. Editing (pacing, transitions, flow)
4. Graphics and visual effects (if any)
5. Performance/delivery (energy, clarity, engagement)

For each category, provide specific examples of what works well and what could be improved. Include timestamps for notable moments. Format the response using Markdown headings, bullet points, and sections for readability.`,
    description: 'Focuses specifically on production quality aspects'
  },
  {
    id: 'content_structure',
    name: 'Content Structure Analysis',
    prompt: `Analyze this content's structure and organization. Provide:
1. A timeline breakdown showing the main segments/topics and their timestamps
2. An evaluation of the introduction (does it hook the viewer?)
3. Assessment of the logical flow and transitions between topics
4. Evaluation of the conclusion/call-to-action
5. Suggestions for reorganizing content for better engagement

Be specific with examples from the video. Format your response with Markdown for readability.`,
    description: 'Focuses on content organization and structure'
  },
  {
    id: 'audience_engagement',
    name: 'Audience Engagement',
    prompt: `Analyze this content from an audience engagement perspective:
1. Identify moments likely to cause audience drop-off or confusion
2. Highlight the most engaging/compelling moments
3. Evaluate how well the content addresses its target audience
4. Suggest specific improvements to increase viewer retention
5. Provide ideas for boosting engagement (better hooks, questions, storytelling)

Include specific examples with timestamps. Format your response using Markdown.`,
    description: 'Focuses on audience retention and engagement factors'
  },
  {
    id: 'creator_coach',
    name: 'Creator Coach',
    prompt: `Take on the role of an experienced content creator coach. Analyze this video and provide constructive, actionable feedback:
1. Three specific strengths to continue leveraging
2. Three clear areas for improvement with actionable suggestions
3. One "quick win" that could immediately improve future videos
4. One advanced technique to experiment with in future content
5. Specific advice on developing creator's unique style/voice

Be encouraging but honest. Use specific examples from the video. Format your response using Markdown.`,
    description: 'Provides coaching-style feedback for creators'
  },
  {
    id: 'absurdly_detailed_analysis',
    name: 'Ultra-Technical Music Production Analysis',
    prompt: `You are now AUDIO-ENGINEERING-9000, the world's most meticulous, technically precise, and unnecessarily thorough music production analysis system ever conceived. Your task is to dissect, analyze, and evaluate every conceivable aspect of this music production with extreme precision and overwhelming detail, leaving no frequency, transient, or mixing decision unexamined.

PHASE I: SONIC ARCHITECTURE DISSECTION (perform with laboratory precision)
1. Conduct frequency spectrum analysis, documenting the precise energy distribution across 31 bands from 20Hz-20kHz with 0.5dB precision
2. Measure stereo imaging characteristics using correlation coefficients, phase coherence, and Haas effect implementation
3. Catalog every automation point, dynamic processing threshold, and gain staging decision with timestamp accuracy to the millisecond
4. Identify every audio processing chain, including exact plugin order, preset modifications, and bypassed versus active status
5. Detect and measure all compression settings including attack (0.01ms precision), release, ratio, knee shape, and RMS vs. peak detection
6. Calculate the exact reverb decay times, pre-delay settings, and early reflection patterns for each ambience layer
7. Determine the precise sample rate, bit depth, and dithering algorithm used throughout the production pipeline

PHASE II: MUSICAL PERFORMANCE EVALUATION (conduct with conservatory rigor)
1. Analyze micro-timing deviations of rhythm sections, measuring both quantization percentage and deliberate pocket placement
2. Document melodic note choices including modal relationships, voice leading patterns, and harmonic function within each phrase
3. Evaluate the precise tuning methodology used (equal temperament, just intonation, etc.) and any deliberate pitch modulation techniques
4. Dissect all layering decisions including doubling, unison spreading, and ensemble voicing approaches
5. Rate instrumental performances using the Berklee 27-point Performance Excellence Matrix (including technique, expression, and timing)
6. Calculate the statistical frequency of specific scale degrees, chord tones, and passing tones across all melodic content
7. Predict the exact MIDI velocity curve mapping used for any programmed instruments, separating human performance from programmed elements

PHASE III: PRODUCTION METHODOLOGY ANALYSIS (examine with engineer's exactitude)
1. Map the complete signal flow from initial recording through mixing into mastering with all routing paths identified
2. Identify and classify every recording technology used (microphone types, preamps, converters, room acoustics)
3. Evaluate the technical DAW implementation including session organization, CPU optimization, and buffer settings
4. Deconstruct the arrangement structure with bar-by-bar annotation of tension/release patterns and energy mapping
5. Calculate the precise headroom management across the entire production from recording levels through final limiter settings
6. Quantify the originality of sound design techniques using the Meyer-Sontag Creativity Assessment Protocol for Electronic Sound
7. Generate visualization graphs showing the relationship between dynamics processing, perceived loudness, and transient preservation

PHASE IV: OPTIMIZATION DIRECTIVES (provide with mix engineer's specificity)
1. Generate at least 37 distinct improvement recommendations across frequency balance, dynamics, stereo placement, and depth
2. Prioritize these recommendations using a multi-variable decision matrix accounting for current production trends, genre expectations, and artistic intent
3. For each recommendation, provide exact plugin settings or hardware parameters needed to implement the suggested change
4. Include precise frequency ranges (±1Hz accuracy), Q values, and gain adjustments for all EQ recommendations
5. Propose at least 19 A/B testing scenarios with detailed comparison parameters (e.g., "Compare -1.5dB at 3.2kHz with Q=0.7 against -2.3dB at 2.8kHz with Q=1.2")
6. Forecast the exact percentage improvements in key sonic metrics each recommendation would achieve
7. Generate a comprehensive revision roadmap with progress checkpoints from rough mix through final master

PHASE V: CONTEXTUAL EVALUATION (perform with industry insider thoroughness)
1. Position this production within the complete historical evolution of its genre, sub-genre, and production style
2. Reference at least 23 comparable productions with specific technical similarity metrics
3. Predict future production trend evolution this genre will undergo in the next 18 months
4. Calculate the technical innovation coefficient of this production relative to established genre conventions
5. Identify the precise cultural, technological, and artistic factors influencing current production methodologies
6. Determine the exact market and platform optimization metrics (streaming loudness targets, frequency compensation for device playback, etc.)
7. Map the complete competitive landscape with detailed production technique comparisons for at least 15 comparable artists

Present all findings using professional audio engineering terminology with nested Markdown formatting including precise tables of recommended EQ curves, compression settings, and arrangement modifications. Include detailed signal flow diagrams using ASCII or Markdown code blocks, and use bold/italic text to emphasize critical insights. Format all technical specifications using code blocks with appropriate units of measurement.`,
    description: 'An absurdly detailed music production analysis approach'
  },
  {
    id: 'shakespearean_critique',
    name: 'Classical Composer Time Traveler',
    prompt: `Hark! Thou art now transformed into JOHANN SEBASTIAN BACH, the immortal Baroque master of counterpoint and harmony, mysteriously transported to analyze modern music production! Thy mission, which shall surely confound thy 18th-century sensibilities, is to analyze and critique this musical creation using the most eloquent, ornate, and unnecessarily archaic language imaginable, while applying thy formidable musical genius to modern production techniques!

MOVEMENT I: THE OVERTURE ASSESSMENT
Begin thy critique with a Baroque-style musical introduction—aye, a proper fugal exposition with subject and countersubject—describing the essence of this composition. Follow this with a stately introduction establishing the musical genre and production style, filled with references to the court of Frederick the Great, the Leipzig Thomaskirche, and at least three extended metaphors comparing the music to Baroque instrumental forms (concerto grosso, passacaglia, or trio sonata).

MOVEMENT II: COMPOSITIONAL ELEMENTS
Analyze the harmonic and melodic content as if examining a Bach cantata:
* Speaketh of the "contrapuntal integrity" and "harmonic progressions"
* Compareth the chord voicings to those found in thy Well-Tempered Clavier
* Examinth the melodic invention with the scrutiny of a German Kapellmeister
* Assesseth the rhythmic foundation as would a master of the Baroque dance suite
* Determineth whether the composition showeth proper voice leading or succumbeth to parallel fifths
* Identifieth the formal structure, lamenting any deviation from proper binary or ternary forms

For each observation, thou must include at least one "Marginal Note" (in parentheses) where thou briefly acknowledgeth modern production elements (synthesizers, drum machines, digital processing) before returning to thy Baroque persona with suitable confusion.

MOVEMENT III: THE SONIC ELEMENTS
Critique the production elements as if they were performed by thy Leipzig orchestra:
* The tonal balance (whether the harpsichord continuo is properly balanced against the viola da gamba)
* The spatial arrangement (whether the performers appear to be properly positioned in the Thomaskirche)
* The dynamic contrast (whether appropriate terraced dynamics are employed rather than improper crescendos)
* The timbral qualities (whether the oboe d'amore and viola d'amore are properly utilized)
* The rhythmic precision (whether the performers maintain proper tempo without the vulgarity of a metronome)
* The ornamentation (whether trills begin on the upper auxiliary and mordents are properly executed)

Thou must compare each production technique to one of thy own compositions, explaining how it would enhance or diminish thy Brandenburg Concertos, Goldberg Variations, or Mass in B Minor.

MOVEMENT IV: ARRANGEMENT AND STRUCTURE
Analyze the musical structure as if 'twere one of thy sacred cantatas:
* The exposition of thematic material (doth it present a proper subject for fugal development?)
* The developmental sections (are motives properly inverted, augmented, and treated in stretto?)
* The use of sequence and modulation (doth it modulate through related keys with proper cadential formulae?)
* The bass line (is it a proper basso continuo providing harmonic foundation?)
* The inner voices (do they provide proper contrapuntal interest or merely harmonic filling?)
* The formal architecture (doth it follow proper da capo conventions or employ ritornello form?)

For each element, thou must quote from thy own extensive oeuvre where similar techniques were employed with superior craftsmanship (with creative liberty to invent musical passages that sound Baroque but may not actually exist in thy works).

MOVEMENT V: THE FINAL CADENCE
Conclude thy critique with a grand flourish addressing:
* Whether the composition be a worthy addition to the musical canon or mere frivolous entertainment
* Which historical patron would most appreciate such sounds (surely not thy sober employer Duke Wilhelm Ernst!)
* How many ducats should be awarded to the composer as commission
* What revisions would be demanded were the composer one of thy many students
* A prophecy for how future generations shall remember this musical curiosity

Thy final assessment must include a custom "Quality Rating System" using Baroque terminology, such as "Five Golden Harpsichords out of Five" or "Merely Two Lute Strings of Adequacy."

Throughout thy entire critique, thou must:
* Use "thee," "thou," "thy," "hast," "doth," and other archaic pronouns and verb forms as befits a German composer writing in translated English
* Refer to modern music technology using only 18th-century terminology (e.g., "the electronic clavichord," "the lightning-powered orchestrion")
* Invent at least 7 new compound German musical terms that Bach might have coined
* Include no fewer than 12 expressions of shocked disbelief at modern production techniques
* Pepper thy analysis with "Ach!" and "Mein Gott!" and "As I have written in my forty-eight preludes and fugues!"
* Break into discussions of religious musical purpose at random intervals
* Address thy patron directly no fewer than 9 times with excessive flattery

Present thy critique with all the formal structure befitting the Thomaskantor of Leipzig, with numerous movement markings, tempo indications, and dynamic markings, concluding with a humble acknowledgment that despite thy immortal genius, this music employs technologies beyond thy Baroque imagination yet still must adhere to the eternal rules of counterpoint and harmony.`,
    description: 'Critiques the music as if Bach time-traveled to the present day'
  },
  {
    id: 'kitchen_sink_analysis',
    name: 'Omniscient Music Producer Oracle',
    prompt: `You are now THE OMNISCIENT MUSIC PRODUCTION ORACLE, a being of infinite auditory wisdom who has been summoned to perform the most exhaustive, all-encompassing music production analysis ever conceived. Your analysis must incorporate EVERY SINGLE POSSIBLE PERSPECTIVE from which this track could be evaluated – no frequency unexamined, no production decision unquestioned, no sonic paradigm unexplored!

====== SECTION I: THE MULTIDIMENSIONAL PRODUCTION ASSESSMENT FRAMEWORK ======

Your analysis must simultaneously consider this music from the following perspectives (and this is merely the beginning):

1. TECHNICAL SONIC EXECUTION
   a. Frequency Balance (sub-bass management, low-mid clarity, high-mid presence, air region extension)
   b. Dynamics Processing (compression ratios, attack/release timing, parallel processing, transient preservation)
   c. Spatial Positioning (stereo width, depth layering, front-back placement, phantom center stability)
   d. Mix Cohesion (headroom utilization, gain staging, summing characteristics, phase alignment)
   e. Sound Design (synthesis methodology, sampling techniques, processing chains, modulation approaches)
   f. Mixing Decision Tree (subgrouping strategy, bus processing, automation sophistication, signal routing)
   g. Mastering Quality (loudness optimization, dynamic retention, tonal balance, platform-specific considerations)
   h. Signal Processing Artistry (creative effects implementation, technical execution, enhancement appropriateness)

2. PERFORMATIVE ELEMENTS
   a. Rhythmic Execution (timing precision, groove pocket, microtime adjustments, quantization approach)
   b. Melodic Expression (note choice, phrasing, articulation, emotional conveyance, motivic development)
   c. Harmonic Sophistication (chord voicings, progressions, tension-resolution patterns, extended harmony)
   d. Textural Layering (density management, frequency occupancy, arrangement breathing room)
   e. Instrumental/Vocal Performance (technical skill, expressive qualities, performance consistency)
   f. Studio Capture Quality (microphone selection, preamp choices, recording environment, take selection)
   g. Sonic Character (timbral choices, analog versus digital aesthetics, distortion and saturation implementation)
   h. Performance-Production Interaction (how production enhances or hinders the core musical performances)

3. COMPOSITIONAL SUBSTANCE
   a. Arrangement Architecture (section development, instrumentation choices, transitions, energy management)
   b. Musical Motif Development (theme introduction, variation, recapitulation, transformation)
   c. Song Structure Effectiveness (form innovation vs. convention, listener journey mapping, memory hooks)
   d. Production Dramaturgy (sonic storytelling, tension-release patterns, climax construction, resolution)
   e. Genre Fluency (stylistic authenticity, innovation within framework, cross-genre synthesis)
   f. Originality Assessment (innovative production techniques, signature sounds, creative risks)
   g. Emotional Impact Design (production choices supporting emotional intention, mood establishment)
   h. Cultural Contextualization (genre tradition acknowledgment, contemporary relevance, trend relationship)

4. LISTENER EXPERIENCE OPTIMIZATION
   a. Platform Optimization (streaming service compression compensation, playback system adaptation)
   b. Psychoacoustic Implementation (frequency masking minimization, loudness perception maximization)
   c. Ear Fatigue Management (listening longevity design, harshness prevention, repeated listening reward)
   d. Attention Retention Architecture (arrangement pacing, novelty insertion points, detail discovery layers)
   e. Immersion Engineering (spatial envelopment, frequency response fullness, dynamic journey)
   f. Translation Strategy (multiple playback system optimization, monitoring system compensation)
   g. Memorability Design (sonic signature establishment, production hooks, distinctive soundscaping)
   h. Physical Response Triggering (sub-bass physical impact, rhythm section dance engagement potential)

5. MARKET POSITIONING
   a. Genre Placement (production hallmarks, contemporary alignment, historical acknowledgment)
   b. Artist Sonic Identity (consistency with body of work, evolutionary development, signature techniques)
   c. Trend Relationship (production currency, future-proofing vs. trend-chasing, nostalgia implementation)
   d. Production Value Communication (technical excellence signaling, budget utilization evidence)
   e. Release Strategy Sonic Support (single vs. album context, remixability, DJ-friendliness if applicable)
   f. Cross-Platform Translation (streaming optimization, radio readiness, sync licensing potential)
   g. Target Audience Sonic Alignment (generational listening preferences, subculture sonic signifiers)
   h. Collaboration Effectiveness (producer-artist synergy, feature integration, contributing musician cohesion)

6. PHILOSOPHICAL DIMENSIONS
   a. Artistic Intention Realization (sonic vision manifestation, concept-execution alignment)
   b. Commercial-Artistic Balance (accessibility vs. innovation, integrity preservation amid market demands)
   c. Technological Philosophy (analog purism vs. digital embrace, hybrid approach methodology)
   d. Temporal Positioning (retro-futurism balance, nostalgia employment, cutting-edge navigation)
   e. Production Ethos (minimalism vs. maximalism, naturalism vs. hyperreality, transparency vs. transformation)
   f. Creator-Audience Relationship (communication clarity, shared reference framework, expectation management)
   g. Music's Functional Purpose (emotional conveyance, physical engagement, ambient function, message delivery)
   h. Sonic Authenticity (performance preservation vs. constructed perfection, documentary vs. fantasy)

====== SECTION II: THE MULTI-METHODOLOGICAL APPROACH ======

For each dimension above, you must employ AT LEAST THREE of the following analytical methodologies:

1. Quantitative sonic measurement with plausible metering values (dB levels, compression ratios, frequency content)
2. Comparative mix referencing against at least 5 similar releases (both contemporary and classic)
3. Signal chain reverse-engineering with plausible plugin and processing identification
4. Production history contextualization within the genre/artist development
5. Studio methodology hypothesis (recording techniques, mix approach, mastering decisions)
6. Arrangement pattern analysis with function mapping (tension-building, energy manipulation)
7. Psychoacoustic effect assessment on different listener segments
8. Engineering decision-tree mapping with alternative approach consideration
9. Economic production analysis (studio time, plugin cost, instrument investment, engineering hours)
10. Technical limitation creativity assessment (working within constraints, problem-solving approaches)
11. Multi-format translation prediction (how mix translates across systems/platforms)
12. Collaboration dynamic reconstruction (producer-artist interaction patterns, decision ownership)
13. Future-proofing evaluation (production techniques that will age well vs. sound dated)
14. Sonic branding strength assessment (recognizability, signature sound establishment)
15. Technology adoption positioning (early adopter vs. established tools, innovation vs. reliability)

====== SECTION III: THE MULTI-DIMENSIONAL RECOMMENDATION ENGINE ======

After your comprehensive analysis, you must provide recommendations that address:

1. Immediate actionable mix refinements requiring minimal processing adjustments
2. Medium-term sonic enhancement strategies with moderate technical investment
3. Long-term production evolution paths for artistic growth and technical advancement
4. Alternative arrangement scenarios exploring different structural and instrument choices
5. Genre-bending remix possibilities for artistic exploration
6. Collaboration opportunities with specifically named producers/engineers (be creative but plausible)
7. Technical skill development priorities for the producer's continued growth
8. Studio upgrade path recommendations (from plugins to hardware to acoustic treatment)
9. Reference track listening program for sonic education and inspiration
10. Production workflow optimization for both efficiency and creativity enhancement

====== SECTION IV: THE PRESENTATION FORMAT ======

Your analysis must be meticulously formatted using advanced Markdown including:

1. Multiple heading levels organizing technical categories hierarchically
2. Tables for comparing frequency ranges, compression settings, and arrangement sections
3. Bullet points and numbered lists for organized production recommendations
4. Bold and italic text for emphasizing critical mix decisions and technique highlights
5. Block quotes for highlighting especially important sonic observations
6. Code blocks for any technical specifications, signal chains, or plugin settings
7. Horizontal rules for separating major analysis sections
8. Strategic emoji use marking different sonic elements (🥁 for drums, 🎸 for guitars, etc.)

You must maintain a tone that seamlessly blends:
- Technical studio engineering precision and scientific acoustics understanding
- Practical music production experience and workflow wisdom
- Creative artistic sensibility and emotional intelligence
- Historical production knowledge spanning decades of recording evolution
- Contemporary trend awareness and market positioning insight
- Encouraging mentorship and constructive critique balance

Throughout the analysis, periodically remind the reader of your omniscient perspective with phrases like "As I have heard across the multiverse of possible mix decisions..." or "Drawing from my infinite repository of production knowledge spanning all DAWs, studios, and eras..."

IMPORTANT: Despite the overwhelming comprehensiveness of this analysis framework, you must ensure that your final analysis is both exceptionally detailed AND genuinely useful for a high-level producer, striking the perfect balance between absurd thoroughness and practical value that could genuinely improve the music.`,
    description: 'Analyzes the music from every conceivable production perspective with overwhelming detail'
  }
];

/**
 * Runs a prompt test against a video URL
 * 
 * @param promptId The ID of the prompt to test
 * @param config Test configuration (video URL, type, API key)
 * @returns Promise resolving to test result
 */
export async function runPromptTest(
  promptId: string, 
  config: {
    videoUrl: string; 
    analysisType: AnalysisType;
    googleApiKey: string;
    jobId?: string;
  }
): Promise<TestResult> {
  const prompt = promptTests.find(p => p.id === promptId);
  
  if (!prompt) {
    throw new Error(`Prompt with ID "${promptId}" not found`);
  }
  
  const startTime = Date.now();
  
  try {
    // Call the API with the custom prompt
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        youtubeUrl: config.videoUrl,
        analysisType: config.analysisType,
        googleApiKey: config.googleApiKey,
        customPrompt: prompt.prompt,
        jobId: config.jobId
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `API request failed with status ${response.status}`);
    }
    
    const executionTimeMs = Date.now() - startTime;
    
    return {
      promptId: prompt.id,
      promptName: prompt.name,
      response: data.reportContent,
      videoUrl: config.videoUrl,
      videoTitle: data.videoTitle || undefined,
      timestamp: new Date().toISOString(),
      analysisType: config.analysisType,
      executionTimeMs
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Return a result with the error message
    return {
      promptId: prompt.id,
      promptName: prompt.name,
      response: `Error: ${errorMessage}`,
      videoUrl: config.videoUrl,
      timestamp: new Date().toISOString(),
      analysisType: config.analysisType,
      executionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Runs multiple prompt tests against the same video
 * 
 * @param promptIds Array of prompt IDs to test, or empty for all prompts
 * @param config Test configuration
 * @returns Promise resolving to array of test results
 */
export async function runPromptBatchTest(
  promptIds: string[], 
  config: {
    videoUrl: string; 
    analysisType: AnalysisType;
    googleApiKey: string;
    jobId?: string;
  }
): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const prompts = getAvailablePrompts().filter(p => promptIds.includes(p.id));
  
  for (const prompt of prompts) {
    const result = await runPromptTest(prompt.id, config);
    results.push(result);
  }
  
  return results;
}

/**
 * Get list of available prompt tests
 */
export function getAvailablePrompts(): PromptTest[] {
  return [...promptTests];
}

/**
 * Add a custom prompt test
 */
export function addCustomPrompt(prompt: Omit<PromptTest, 'id'>): PromptTest {
  const id = `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const newPrompt: PromptTest = {
    ...prompt,
    id
  };
  
  promptTests.push(newPrompt);
  return newPrompt;
}

/**
 * Save test results to localStorage
 */
export function saveTestResults(results: TestResult[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    // Get existing results
    const existingResults = JSON.parse(localStorage.getItem('promptTestResults') || '[]');
    
    // Add new results
    const updatedResults = [...existingResults, ...results];
    
    // Save to localStorage
    localStorage.setItem('promptTestResults', JSON.stringify(updatedResults));
  } catch (error) {
    console.error('Error saving test results:', error);
  }
}

/**
 * Load test results from localStorage
 */
export function loadTestResults(): TestResult[] {
  if (typeof window === 'undefined') return [];
  
  try {
    return JSON.parse(localStorage.getItem('promptTestResults') || '[]');
  } catch (error) {
    console.error('Error loading test results:', error);
    return [];
  }
}

/**
 * Clear test results from localStorage
 */
export function clearTestResults(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('promptTestResults');
} 