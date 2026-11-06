import { counterIntent } from './counterIntent';
it.each([
  ['Radhe 2000', 'Radhe', '2000.00'],
  ['Radhe ₹2,000.50', 'Radhe', '2000.50'],
  ['₹150.25', '', '150.25'],
  ['9794620535', '9794620535', null],
  ['INV-001', 'INV-001', null],
  ['MCB 6A', 'MCB 6A', null],
  ['0', '0', null],
])('parses %s without posting or mistaking phones for amounts', (query, term, amount) => {
  expect(counterIntent(query)).toEqual({ term, amount });
});
