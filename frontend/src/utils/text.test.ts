import { initialsOf } from './text';

describe('initialsOf', () => {
  it('drops punctuation, as the design does ("Raju (milkman)" → "Rm")', () => {
    /* The Money Book's rows drew "R(" and "P(" for "Raju (milkman)" and
       "Priya (sister)": the first character of "(milkman)" is the bracket. */
    expect(initialsOf('Raju (milkman)')).toBe('Rm');
    expect(initialsOf('Priya (sister)')).toBe('Ps');
  });

  it('keeps a Devanagari letter whole', () => {
    expect(initialsOf('अमित शर्मा')).toBe('अश');
  });

  it('takes two words at most and survives an empty name', () => {
    expect(initialsOf('Suresh Kumar Jadhav')).toBe('SK');
    expect(initialsOf('  ')).toBe('');
  });
});
