/**
 * Automatic fact check of generated titles against the article text (currently used for Serbian).
 *
 * Why: tests (Oct 2026) showed that every model occasionally invents or exaggerates a detail
 * ("glasaju noću", "neregularnosti", "18 stepeni je idealno"). Prompt rules reduce this but do
 * not guarantee it. A second, cheap and fast model call verifies each title and corrects only
 * titles with factual problems.
 */
import type { TitleOption } from './title-history';

export interface FactCheckResult {
  i: number;            // 1-based title index
  ok: boolean;
  problem?: string;
  fixed?: string;
}

export interface FactCheckOutcome {
  checked: boolean;
  results: FactCheckResult[];
  replaced: number[];   // 1-based indexes that were replaced
  usage?: any;
  model: string;
}

const MAX_LEN = 70;

function buildPrompt(titles: TitleOption[], text: string): string {
  const list = titles.map((t, k) => `${k + 1}. ${t.text}`).join('\n');
  return `Ti si urednik-proverivač činjenica na informativnom portalu. Uporedi svaki naslov sa tekstom članka i označi SAMO JASNE ČINJENIČNE GREŠKE.

Naslov je GREŠKA („ok": false) SAMO ako:
1. sadrži činjenicu, broj, ime, mesto ili događaj kojeg NEMA u tekstu (izmišljeno), ili
2. izvrće ono što tekst kaže (pogrešan broj, pogrešna osoba, suprotan smisao, pogrešan odnos ko je šta uradio), ili
3. tuđu izjavu, procenu ili optužbu iznosi kao UTVRĐENU ČINJENICU, a u naslovu nema nikakvog pripisivanja, ili
4. značajno preteruje (npr. „najbolji na svetu" kada tekst kaže „jedan od boljih").

Naslov NIJE greška („ok": true) ako:
- je tvrdnja logički ista kao u tekstu, samo drugačije rečena (npr. „svaki stepen manje štedi 6%" = „svaki stepen više troši 6% više");
- je skraćen ili uopšten, a smisao ostaje tačan;
- izostavlja nijansu poput „moglo bi", „pojedini", „podseća na" — osim ako time nastaje suprotan ili bitno drugačiji smisao;
- ima stilske ili formalne nedostatke (oblik pitanja, dužina, ton) — to NIJE tvoj posao.
Kad nisi siguran — „ok": true.

Za grešku daj "problem" (kratko, šta tačno nije u tekstu) i "fixed": ispravljen naslov sa NAJMANJOM mogućom izmenom, samo činjenice iz teksta, isti ugao, najviše ${MAX_LEN} karaktera, bez tačke na kraju, pravilan srpski jezik (latinica). Naslov 3 mora ostati pitanje sa „?"; u naslovima 1–5 nema dvotačke.

Vrati isključivo JSON: {"results":[{"i":1,"ok":true},{"i":2,"ok":false,"problem":"...","fixed":"..."}]}

NASLOVI:
${list}

TEKST ČLANKA:
${text.substring(0, 6000)}`;
}

/**
 * Runs the fact check and replaces titles that failed, if the correction passes basic rules.
 * Never throws — on any error the original titles are kept.
 */
export async function factCheckTitles(
  genAI: any,
  titles: TitleOption[],
  text: string,
  modelName: string = process.env.FACTCHECK_MODEL || 'gemini-3.8-flash'
): Promise<FactCheckOutcome> {
  const outcome: FactCheckOutcome = { checked: false, results: [], replaced: [], model: modelName };
  try {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        thinkingConfig: { thinkingBudget: 1024 },
      } as any,
    });
    const result = await model.generateContent(buildPrompt(titles, text.normalize('NFC')));
    outcome.usage = result.response.usageMetadata || {};
    const raw = result.response.text().replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(m ? m[0] : raw);
    outcome.results = Array.isArray(parsed.results) ? parsed.results : [];
    outcome.checked = true;

    for (const r of outcome.results) {
      if (r.ok !== false) continue;
      const idx = Number(r.i) - 1;
      if (!(idx >= 0 && idx < titles.length)) continue;
      let f = (r.fixed || '').trim().replace(/[^.]\.$/, (x) => x.slice(0, -1)).trim();
      const colonOk = idx === 5 || !f.includes(':');
      const questionOk = idx !== 2 || f.endsWith('?');
      if (f && f.length <= MAX_LEN && colonOk && questionOk) {
        titles[idx].text = f;
        titles[idx].length = f.length;
        titles[idx].reasoning = `${titles[idx].reasoning || ''} [Provera činjenica: ispravljeno — ${r.problem || ''}]`.trim();
        outcome.replaced.push(idx + 1);
      } else {
        console.warn(`⚠️ [FactCheck] Fix rejected for #${idx + 1}: "${f}" (${f.length})`);
      }
    }
  } catch (e) {
    console.error('⚠️ [FactCheck] Failed (keeping originals):', e instanceof Error ? e.message : e);
  }
  return outcome;
}
