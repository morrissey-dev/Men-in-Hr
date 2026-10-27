import { useEffect, useRef } from 'react';

type TurnstileClient = {
  render: (container: HTMLElement, options: { sitekey: string; callback: (token: string) => void; 'expired-callback': () => void; 'error-callback': () => void }) => string;
  remove: (id: string) => void;
};

declare global { interface Window { turnstile?: TurnstileClient } }

export default function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (value: string) => void }) {
  const elementRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onToken);
  useEffect(() => { callbackRef.current = onToken; }, [onToken]);

  useEffect(() => {
    if (!siteKey) return;
    let active = true;
    let widgetId: string | undefined;
    const render = () => {
      if (!active || !window.turnstile || !elementRef.current || widgetId) return;
      widgetId = window.turnstile.render(elementRef.current, {
        sitekey: siteKey,
        callback: token => callbackRef.current(token),
        'expired-callback': () => callbackRef.current(''),
        'error-callback': () => callbackRef.current(''),
      });
    };
    if (window.turnstile) render();
    else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-men-in-hr-turnstile]');
      const script = existing ?? document.createElement('script');
      script.addEventListener('load', render);
      if (!existing) {
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.menInHrTurnstile = 'true';
        document.head.appendChild(script);
      }
      return () => {
        active = false;
        script.removeEventListener('load', render);
        if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
      };
    }
    return () => { active = false; if (widgetId && window.turnstile) window.turnstile.remove(widgetId); };
  }, [siteKey]);

  return <div className="turnstile-wrap"><div ref={elementRef} /><p className="field-hint">Security verification is required before submitting. Cloudflare Turnstile will load here.</p></div>;
}
