import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// layout effect: focus in the same commit that marks the fields (a passive effect can run after the alerts are read)
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** Focus the first enabled field marked `aria-invalid="true"` inside `root`, in document (= screen) order.
 *  Returns whether one was found. Input and Select set the attribute whenever they show an error. */
export function focusFirstInvalid(root: ParentNode | null | undefined): boolean {
  const el = root?.querySelector<HTMLElement>('[aria-invalid="true"]:not(:disabled)');
  if (!el) return false;
  el.focus();
  return true;
}

/** U5.4 (WCAG 3.3.1): after a failed submit, move keyboard focus to the first wrong field, so a screen reader
 *  starts there instead of staying on the submit button.
 *  The fields are not marked yet when the submit handler runs: hand-rolled forms keep their errors in useState, and
 *  react-hook-form only publishes its errors after calling onInvalid. So `request()` bumps a counter (which forces a
 *  render even when the same errors are already showing) and the focus happens in a layout effect once a marked field is
 *  on screen: on that render, or the next one for react-hook-form. Two renders at most, so a request that found
 *  nothing cannot pull focus away later.
 *  Put `ref` on the <form> (or the element that holds the fields) and call `request()` when validation fails;
 *  with react-hook-form pass it as `handleSubmit(onValid, request)` and set `shouldFocusError: false`. */
export function useFocusFirstInvalid<T extends HTMLElement = HTMLFormElement>() {
  const ref = useRef<T>(null);
  const pending = useRef(0); // renders left to find a marked field
  const [, setTick] = useState(0);
  useIsoLayoutEffect(() => {
    if (!pending.current) return;
    pending.current = focusFirstInvalid(ref.current) ? 0 : pending.current - 1;
  });
  const request = useCallback(() => {
    pending.current = 2;
    setTick((n) => n + 1);
  }, []);
  return { ref, request };
}
