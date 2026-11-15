(() => {
    const panel = document.getElementById('hesaplama');
    const frame = panel.querySelector('iframe');
    const triggers = [...document.querySelectorAll('[data-calc]')];
    let last;

    for (const trigger of triggers) {
        trigger.addEventListener('click', event => {
            event.preventDefault();
            last = trigger;
            panel.hidden = false;
            const url = trigger.getAttribute('href');
            if (frame.getAttribute('src') !== url) frame.setAttribute('src', url);
            for (const link of triggers) link.setAttribute('aria-expanded', 'true');
            const motion = matchMedia('(prefers-reduced-motion: reduce)').matches;
            panel.scrollIntoView({ behavior: motion ? 'auto' : 'smooth', block: 'start' });
        });
    }

    document.getElementById('hesabi-kapat').addEventListener('click', () => {
        panel.hidden = true;
        for (const link of triggers) link.setAttribute('aria-expanded', 'false');
        last?.focus();
    });

    window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'kh-guide-height') return;
        const height = Number(event.data.height);
        if (Number.isFinite(height) && height >= 300 && height <= 25000) frame.style.height = Math.ceil(height) + 'px';
    });
})();
