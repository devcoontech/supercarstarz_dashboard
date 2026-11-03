import { useEffect, useState } from 'react';

/** Hash routes: #/<page>/<id?>/<sub?> */
export const go = (path: string) => { window.location.hash = '/' + path; };

export function useRoute() {
  const read = () => window.location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [parts, setParts] = useState(read);
  useEffect(() => {
    const on = () => { setParts(read()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return parts;
}
