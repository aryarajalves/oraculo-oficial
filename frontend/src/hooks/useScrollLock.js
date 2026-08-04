import { useEffect } from 'react';

let activeLocks = 0;

export function useScrollLock(isLocked) {
  useEffect(() => {
    if (isLocked) {
      activeLocks++;
      document.body.classList.add('modal-open');
      document.documentElement.classList.add('modal-open');
    }
    return () => {
      if (isLocked) {
        activeLocks = Math.max(0, activeLocks - 1);
        if (activeLocks === 0) {
          document.body.classList.remove('modal-open');
          document.documentElement.classList.remove('modal-open');
        }
      }
    };
  }, [isLocked]);
}
