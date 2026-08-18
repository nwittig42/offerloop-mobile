/**
 * Display-case a value PDL stored lowercase.
 *
 * PDL normalizes to lowercase and the contact records keep it that way (the
 * lowercase form is what the matching relies on), so lists render "jack
 * mathews", "goldman sachs", "vice president". Cased once on the way in,
 * rather than in every component that draws a person.
 *
 * Left alone if the value already has capitals: a real "eBay" or "USC" must
 * survive, and anything already properly cased is already right.
 *
 * Lives here rather than beside one caller because the People deck and the
 * Network list both need it, and two copies would drift the moment somebody
 * fixed a name in one of them.
 */
const SMALL_WORDS = new Set(['of', 'the', 'and', 'at', 'for', 'in', 'on', 'to', 'a', 'an']);

export function titleCase(v: string | undefined): string | undefined {
  if (!v) return v;
  if (/[A-Z]/.test(v)) return v;
  let first = true;
  return v.replace(/([^\s/&-]+)/g, (w) => {
    // "University Of Southern California" was the giveaway that this needed
    // to know English: small words stay down unless they lead.
    const keepDown = !first && SMALL_WORDS.has(w.toLowerCase());
    first = false;
    return keepDown ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1);
  });
}
