// Scout routing battery — run: node --experimental-strip-types scripts/scout-battery.mjs
// (wraps the parser layers from scoutActions.ts; every utterance must land on
// a named outcome, never a silent dead-end)
import { readFileSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';

const src = readFileSync(new URL('../src/api/endpoints/scoutActions.ts', import.meta.url), 'utf8');
const a = src.indexOf('const ASR_FIXES');
const b = src.indexOf('/** One clarify round');
let body = src.slice(a, b).replace(/export function/g, 'function').replace(/export type/g, 'type');
body = body.replace('function matchJobs(jobs: Job[]', 'function matchJobs(jobs: any[]');

const harness = body + `
const route = (ask) => {
  const aff = parseAffirmation(ask);
  if (aff) return 'AFFIRM:' + aff + ' (drives pending card / stands down)';
  if (parseAgain(ask)) return 'AGAIN (re-runs last, confirmed)';
  const nav = parseNav(ask);
  if (nav) return 'NAV → ' + nav.label;
  const n = normalizeAsk(ask);
  const i = parseIntent(n.text);
  if (!i) return 'CLASSIFIER → (chat if question / refine if targeted)';
  if (i.kind === 'find_people') return 'PREVIEW ' + (i.role || 'people') + ' @ ' + i.company + (i.location ? ' in ' + i.location : '');
  if (i.kind === 'find_jobs') return 'JOBS q="' + i.query + '"';
  if (i.kind === 'apply_saved') return 'APPLY (scope receipt)';
  if (i.kind === 'prep') return 'PREP';
  const gate = !i.company ? 'clarify' : 'gates→run';
  return 'DRAFT ' + i.count + 'x "' + i.role + '" @ ' + (i.company ?? '?') + ' [' + gate + ']';
};
const battery = [
  // confirmations & control
  'yes', 'yeah go ahead', 'run it', 'no cancel that', 'never mind', 'stop',
  'again', 'one more', 'do it again',
  // navigation
  'open my inbox', 'check my replies', 'where are my saved jobs', 'go to my network',
  'show my credits', 'open notifications', 'take me to my profile',
  // bare fragments
  'Goldman Sachs', 'Stripe', 'hiring managers', 'IB analysts in LA', 'consultants',
  // core intents
  'Draft 3 IB analysts at Goldman', 'Find one hiring manager at Stripe',
  'show me people at Bain in LA', 'people at Evercore', 'who works at Meta',
  'find me a pm role to apply to', 'apply to my saved jobs', 'prep me for my 2pm',
  'Send five emails to hiring managers in investment banking in Los Angeles',
  // mishears & garbage
  'manners at goldman sex', 'recruiter at stipe', 'Blah blah at Goldman Sachs',
  // questions (must stay conversational)
  'what should I say in a follow up email', 'how do I network into MBB',
  'are managers usually nice', 'what can you do',
  // odd but must not dead-end
  'hello', 'thanks scout', 'draft 20 analysts at Google', 'asdf ghjk',
];
let out = '';
for (const t of battery) out += JSON.stringify(t).padEnd(72) + ' -> ' + route(t) + String.fromCharCode(10);
console.log(out);
`;
writeFileSync('/tmp/scout-battery-run.ts', harness);
const r = spawnSync('node', ['--experimental-strip-types', '/tmp/scout-battery-run.ts'], { encoding: 'utf8' });
process.stdout.write(r.stdout || '');
process.stderr.write(r.stderr || '');
