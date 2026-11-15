(() => {
    const startup = document.documentElement.dataset.rehberMotor ? 'DOMContentLoaded' : 'load';
    window.addEventListener(startup, () => {
        const query = new URLSearchParams(location.search);
        const legacyEmbed = { isitma: 'isitma', clima: 'pratik' };
        const mode = query.get('hesap') || legacyEmbed[query.get('embed')];
        if (!['pratik', 'klima', 'isitma'].includes(mode) || typeof hesapAracinaGit !== 'function') return;

        const embedded = Boolean(document.documentElement.dataset.rehberMotor);
        hesapAracinaGit(mode);
        if (query.get('alan') === '30' && mode === 'pratik') {
            const sample = {
                pratikSehir: 'Adana',
                pratikAlan: '30',
                pratikDuvarOlcusu: '6',
                pratikYukseklik: '2.8',
                pratikYalitim: 'standart',
                pratikKisi: '3',
                pratikYon: 'Guney',
                pratikPencereYon: 'Guney',
                pratikCephe: '2',
                pratikIkinciYon: 'Yok',
                pratikCamOrani: '0.60',
                pratikCamTipi: 'PVC - Çift Cam',
                pratikKatKonum: 'Ara Kat',
                pratikFonksiyon: 'Konut',
            };
            for (const [id, value] of Object.entries(sample)) document.getElementById(id).value = value;
            pratikCepheDegisti();
            hesaplaPratik();
        }
        if (query.get('alan') === '30' && mode === 'klima') document.getElementById('mahalAlani').value = '30';

        if (embedded && window.parent !== window) {
            const tools = document.getElementById('hesapAraclari');
            let previous = 0;
            const send = () => {
                const height = Math.ceil(tools.getBoundingClientRect().bottom + window.scrollY + 16);
                if (Math.abs(height - previous) <= 2) return;
                previous = height;
                window.parent.postMessage({ type: 'kh-guide-height', height }, location.origin);
            };
            const observer = new ResizeObserver(send);
            observer.observe(tools);
            observer.observe(document.getElementById('hesapAraclariSekmeler'));
            requestAnimationFrame(send);
        }
    }, { once: true });
})();
