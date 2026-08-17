import type { ContactRelation } from '@/types';

/**
 * Read a person's relation to the user off their job title.
 *
 * This is an inference from a free-text string, not a fact the server tells
 * us, so it is deliberately conservative: a title only earns "Recruiter" or
 * "Hiring manager" when it says so plainly. Everything else falls through to
 * "Employee", which is the honest answer for an unknown title rather than a
 * guess dressed up as data.
 *
 * Shared by the People deck (which shows the relation on every card) and the
 * Inbox (which badges only the two non-default answers). One definition, so
 * the same person cannot read as a hiring manager on one screen and an
 * employee on the other.
 */
export function relationFor(title: string | undefined | null): ContactRelation {
  const t = (title || '').toLowerCase();
  if (/recruit|talent|university relations|campus/.test(t)) return 'Recruiter';
  if (/head|director|vp\b|vice president|chief|manager|lead|partner|principal/.test(t)) {
    return 'Hiring manager';
  }
  return 'Employee';
}

/**
 * The Inbox badge: only the relations worth calling out. Returns null for a
 * plain employee and for a missing title, so a row with nothing to say shows
 * no badge at all rather than an "Employee" chip on almost every line.
 */
export function badgeRelationFor(
  title: string | undefined | null,
): Exclude<ContactRelation, 'Employee'> | null {
  if (!title || !title.trim()) return null;
  const rel = relationFor(title);
  return rel === 'Employee' ? null : rel;
}
