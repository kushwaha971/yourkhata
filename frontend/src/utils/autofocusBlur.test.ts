import { blurIfTyped } from './autofocusBlur';

describe('blurIfTyped', () => {
  /** Prevents a drawer's focused, untouched name turning red when the merchant taps a switch (A5 manual pass). */
  it('does not mark an empty, never-typed field touched on the way out', () => {
    const onBlur = jest.fn();
    blurIfTyped({ value: '', onBlur }, false)();
    blurIfTyped({ value: '   ', onBlur }, false)();
    expect(onBlur).not.toHaveBeenCalled();
  });

  it('checks a typed value as the merchant leaves, and everything after a Save', () => {
    const onBlur = jest.fn();
    blurIfTyped({ value: 'Atta', onBlur }, false)();
    blurIfTyped({ value: '', onBlur }, true)();
    expect(onBlur).toHaveBeenCalledTimes(2);
  });
});
