import { appPlace, rememberAppPlace } from './appPlace';

/**
 * Revamp 04 §2 — switching app returns to the screen the person left in it.
 * The defect this prevents is the old switch, which always opened the app's
 * home: a librarian checking Seats who hopped to the Shop for one bill came
 * back to Library Home and had to find Seats again.
 */
beforeEach(() => window.sessionStorage.clear());

it('returns the remembered screen for that business and app', () => {
  rememberAppPlace('t1', 'library', '/library/seats');
  expect(appPlace('t1', 'library', '/library')).toBe('/library/seats');
});

it('keeps businesses and apps apart', () => {
  rememberAppPlace('t1', 'library', '/library/seats');
  expect(appPlace('t2', 'library', '/library')).toBe('/library');
  expect(appPlace('t1', 'shop', '/dashboard')).toBe('/dashboard');
});

it('never sends a person off the site from a value someone wrote into storage', () => {
  window.sessionStorage.setItem('yourkhata:place:t1:shop', '//evil.example');
  expect(appPlace('t1', 'shop', '/dashboard')).toBe('/dashboard');
});

it('falls back to home when storage throws', () => {
  const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(appPlace('t1', 'shop', '/dashboard')).toBe('/dashboard');
  spy.mockRestore();
});
