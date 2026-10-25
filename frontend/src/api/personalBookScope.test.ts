import { personalBookUrl } from './personalBookScope';

describe('personal book routing', () => {
  it('never reads the business list for personal Udhaar', () => {
    expect(personalBookUrl('/parties?balance=all', 'khata')).toBe('/personal/parties?balance=all');
    expect(personalBookUrl('/parties/p1/ledger-entries', 'khata')).toBe('/personal/parties/p1/ledger-entries');
    expect(personalBookUrl('/reminders/preview', 'khata')).toBe('/personal/reminders/preview');
  });
  it('does not change Shop or live vertical contracts', () => {
    for (const app of ['shop', 'library', 'lending', null])
      expect(personalBookUrl('/parties/p1', app)).toBe('/parties/p1');
    expect(personalBookUrl('/parties?book=shop', 'khata')).toBe('/parties?book=shop');
    expect(personalBookUrl('/auth/me', 'khata')).toBe('/auth/me');
    expect(personalBookUrl('/personal/parties', 'khata')).toBe('/personal/parties');
  });
});
