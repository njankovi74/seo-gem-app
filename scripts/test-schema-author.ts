import { PUBLISHER_INFO } from '../src/lib/portal-config';
import { resolveSchemaAuthor } from '../src/lib/seo-output';

interface TestCase {
  portal: string;
  authorName: string;
  expected: Record<string, any> | Array<Record<string, any>>;
}

const TEST_CASES: TestCase[] = [
  {
    portal: 'newsmax',
    authorName: 'Cubes d.o.o.',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
  {
    portal: 'newsmax_pl',
    authorName: 'Cubes d.o.o.',
    expected: { '@type': 'Organization', name: 'Newsmax Polska' },
  },
  {
    portal: 'newsmax_al',
    authorName: 'Redaksia Newsmax Balkans',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
  {
    portal: 'newsmax',
    authorName: 'Newsmax Polska',
    expected: { '@type': 'Organization', name: 'Newsmax Polska' },
  },
  {
    portal: 'newsmax',
    authorName: 'Newsmax Balkans',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
  {
    portal: 'newsmax',
    authorName: '',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
  {
    portal: 'newsmax',
    authorName: 'none',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
  {
    portal: 'newsmax',
    authorName: '(N/A)',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
  {
    portal: 'newsmax',
    authorName: 'Nemanja Lukić',
    expected: { '@type': 'Person', name: 'Nemanja Lukić' },
  },
  {
    portal: 'newsmax_pl',
    authorName: 'Wojciech Łaskarzewski',
    expected: { '@type': 'Person', name: 'Wojciech Łaskarzewski' },
  },
  {
    portal: 'newsmax',
    authorName: 'Desko Nikitović',
    expected: { '@type': 'Person', name: 'Desko Nikitović' },
  },
  {
    portal: 'newsmax',
    authorName: 'Petar Beta',
    expected: { '@type': 'Person', name: 'Petar Beta' },
  },
  {
    portal: 'insajder',
    authorName: 'Beta',
    expected: { '@type': 'Organization', name: 'Beta' },
  },
  {
    portal: 'insajder',
    authorName: 'Redakcija',
    expected: { '@type': 'Organization', name: 'Insajder' },
  },
  {
    portal: 'insajder',
    authorName: 'Ana Anić, Beta',
    expected: [
      { '@type': 'Person', name: 'Ana Anić' },
      { '@type': 'Organization', name: 'Beta' },
    ],
  },
  {
    portal: 'insajder',
    authorName: 'Ana Anić, Marko Marković',
    expected: [
      { '@type': 'Person', name: 'Ana Anić' },
      { '@type': 'Person', name: 'Marko Marković' },
    ],
  },
  {
    portal: 'insajder',
    authorName: 'Redakcija, Ana Anić',
    expected: [
      { '@type': 'Organization', name: 'Insajder' },
      { '@type': 'Person', name: 'Ana Anić' },
    ],
  },
  {
    portal: 'newsmax',
    authorName: 'Cubes d.o.o., Cubes d.o.o.',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
  {
    portal: 'newsmax',
    authorName: 'Marko Princ',
    expected: { '@type': 'Person', name: 'Marko Princ' },
  },
  {
    portal: 'newsmax',
    authorName: 'Ana Vinc',
    expected: { '@type': 'Person', name: 'Ana Vinc' },
  },
  {
    portal: 'newsmax_pl',
    authorName: 'Jan Szulinc',
    expected: { '@type': 'Person', name: 'Jan Szulinc' },
  },
  {
    portal: 'newsmax',
    authorName: 'Kim Doo',
    expected: { '@type': 'Person', name: 'Kim Doo' },
  },
  {
    portal: 'newsmax',
    authorName: 'Firma doo',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
  {
    portal: 'newsmax',
    authorName: 'Cubes, d.o.o.',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
  {
    portal: 'newsmax',
    authorName: 'CUBES D.O.O.',
    expected: { '@type': 'Organization', name: 'Newsmax Balkans' },
  },
];

let failed = 0;

console.log('=== TEST A3: resolveSchemaAuthor(rawAuthor, pubName) ===\n');

for (const tc of TEST_CASES) {
  const pubName = PUBLISHER_INFO[tc.portal].name;
  const actual = resolveSchemaAuthor(tc.authorName, pubName);
  const ok = JSON.stringify(actual) === JSON.stringify(tc.expected);
  if (!ok) failed++;
  console.log(
    `${ok ? '✅ PASS' : '❌ FAIL'} | ${tc.portal} (${pubName}) | authorName=${JSON.stringify(tc.authorName)} → ${JSON.stringify(actual)}${ok ? '' : ` (expected: ${JSON.stringify(tc.expected)})`}`
  );
}

console.log(`\nUkupno: ${TEST_CASES.length - failed}/${TEST_CASES.length} prošlo.`);
if (failed > 0) {
  process.exit(1);
}
