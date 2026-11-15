(() => {
    'use strict';

    const number = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
    const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
    const n = value => number.format(value);
    const euros = cents => money.format(cents / 100);
    const containers = (need, size) => Math.ceil(need / size - 1e-9);
    const doorArea = 0.8 * 2;
    const paintCoverage = 10;
    const paintDensity = 1.5;
    const wallPaintFormats = [{ size: 200, cents: 29000 }, { size: 300, cents: 40000 }, { size: 500, cents: 62500 }];
    const ceilingFormats = [{ size: 350, cents: 49500 }, { size: 1000, cents: 115000 }];
    const tileReferences = {
        vesta: { label: 'Seramik 30 × 60 cm (Yeni Premium)', length: 60, width: 30, size: 1.44, pieces: 8, unitCents: 41746 },
        marmi: { label: 'Seramik 60 × 60 cm (Urban Cenere)', length: 60, width: 60, size: 1.44, pieces: 4, unitCents: 33970 },
    };
    const irregularWallAllowance = 0.09;
    const irregularFloorAllowance = 0.05;
    const flooringCutAllowance = 0.10;
    const flooringReferences = [
        { name: 'Laminat parke', size: 2.3071, unitCents: 68982, separateUnderlay: true },
        { name: 'SPC vinil (örnek paket)', size: 2.2, unitCents: 301785, separateUnderlay: false },
        { name: 'Lamine parke', size: 0.65, unitCents: 259350, separateUnderlay: true },
    ];

    function fail(field, message) {
        field.setAttribute('aria-invalid', 'true');
        for (let node = field.parentElement; node; node = node.parentElement) {
            if (node.tagName === 'DETAILS') node.open = true;
        }
        field.focus();
        throw new Error(message);
    }

    function value(form, name, min, max, decimals = 2) {
        const field = form.elements.namedItem(name);
        const raw = field.value.trim();
        const valid = (decimals ? /^\d+(?:[.,]\d{1,2})?$/ : /^\d+$/).test(raw);
        const parsed = valid ? Number(raw.replace(',', '.')) : NaN;
        if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
            const label = field.labels[0].firstChild.textContent.trim();
            fail(field, `${label}: ${n(min)} ile ${n(max)} arasında ${decimals ? 'en fazla iki ondalıklı' : 'tam sayı'} bir değer girin.`);
        }
        return parsed;
    }

    function cheapestPaint(formats, requirement, unit) {
        // One state per 0.01 kg or 0.01 L. An optimum cannot include enough excess
        // to remove a full container, because every container has a positive price.
        const limit = requirement + Math.max(...formats.map(format => format.size)) - 1;
        const costs = new Float64Array(limit + 1).fill(Infinity);
        const tins = new Float64Array(limit + 1).fill(Infinity);
        const previous = new Int8Array(limit + 1).fill(-1);
        costs[0] = 0;
        tins[0] = 0;
        for (let quantity = 0; quantity <= limit; quantity++) {
            if (!Number.isFinite(costs[quantity])) continue;
            for (const [index, format] of formats.entries()) {
                const next = quantity + format.size;
                const cost = costs[quantity] + format.cents;
                const count = tins[quantity] + 1;
                if (next <= limit && (cost < costs[next] || (cost === costs[next] && count < tins[next]))) {
                    costs[next] = cost;
                    tins[next] = count;
                    previous[next] = index;
                }
            }
        }
        let best = requirement;
        for (let quantity = requirement + 1; quantity <= limit; quantity++) {
            if (costs[quantity] < costs[best] || (costs[quantity] === costs[best] && tins[quantity] < tins[best])) best = quantity;
        }
        const counts = formats.map(() => 0);
        for (let amount = best; amount > 0;) {
            const index = previous[amount];
            counts[index]++;
            amount -= formats[index].size;
        }
        const items = formats.map((format, index) => ({ ...format, count: counts[index] }))
            .filter(item => item.count > 0).sort((a, b) => b.size - a.size);
        const label = items.map(item => `${item.count} × ${n(item.size / 100)} ${unit}`).join(' + ');
        return { label, items, quantity: best, cents: costs[best] };
    }

    function purchaseItem(name, need, unit, pack, unitCents) {
        const count = containers(need, pack);
        return { name, need, unit, pack, count, unitCents, cents: count * unitCents };
    }

    function itemRows(items, system = '') {
        return items.filter(item => item.count > 0).map(item => [
            system ? `${system} · ${item.name}` : item.name,
            `${n(item.need)} ${item.unit}`,
            item.pack === 1 && item.unit === 'adet' ? `${n(item.count)} adet` : `${n(item.count)} × ${n(item.pack)} ${item.unit}`,
            euros(item.unitCents),
            euros(item.cents),
        ]);
    }

    const totalItems = items => items.reduce((sum, item) => sum + item.cents, 0);

    function paintAuxiliaries(form, area, netWalls, perimeter, doors, windowEdges, floorArea) {
        const primer = form.elements.namedItem('usePrimer').checked
            ? area * value(form, 'primerCoats', 1, 5, 0) / 12
            : 0;
        const filler = netWalls * 0.02 * 1 * 1.1;
        const tape = perimeter + doors * (0.8 + 2 * 2) + windowEdges;
        const references = [
            ['Astar', primer, 'L', 5, 65000],
            ['Macun', filler, 'kg', 1, 13000],
            ['Maskeleme bandı', tape, 'm', 50, 8500],
            ['Koruyucu örtü', floorArea, 'm²', 20, 10000],
            ['Rulo, fırça ve tepsi seti', 1, 'adet', 1, 22000],
            ['Spatula', 1, 'adet', 1, 9500],
            ['Zımpara süngeri', 1, 'adet', 1, 4500],
        ];
        return references.map(reference => purchaseItem(...reference));
    }

    function windowSize(form, index, maxWidth, maxHeight) {
        const widthName = `windowWidth${index}`;
        const heightName = `windowHeight${index}`;
        const width = form.elements.namedItem(widthName);
        const height = form.elements.namedItem(heightName);
        if (!width.value.trim() && !height.value.trim()) return { area: 0, edges: 0 };
        const w = value(form, widthName, 0.01, maxWidth);
        const h = value(form, heightName, 0.01, maxHeight);
        return { area: w * h, edges: 2 * (w + h) };
    }

    function calculatePaint(form) {
        const length = value(form, 'length', 0.1, 100);
        const width = value(form, 'width', 0.1, 100);
        const height = value(form, 'height', 0.1, 20);
        const rectangularWalls = 2 * (length + width) * height;
        const extraWalls = form.elements.namedItem('irregularRoom').checked
            ? rectangularWalls * irregularWallAllowance
            : 0;
        const walls = rectangularWalls + extraWalls;
        const doors = value(form, 'doors', 0, 2, 0);
        const maxWindowWidth = Math.max(length, width);
        const firstWindow = windowSize(form, 1, maxWindowWidth, height);
        const secondWindow = windowSize(form, 2, maxWindowWidth, height);
        const openings = doors * doorArea + firstWindow.area + secondWindow.area;
        const netWalls = walls - openings;
        if (netWalls < -1e-9) fail(form.elements.namedItem('doors'), 'Kapı ve pencerelerin alanı duvar alanını aşıyor.');
        const coats = value(form, 'coats', 1, 10, 0);
        const reserve = value(form, 'reserve', 0, 100);
        const floorArea = length * width;
        const paintableWalls = Math.max(0, netWalls);
        const ceilingMode = form.elements.namedItem('ceilingMode').value;
        const ceilingArea = ceilingMode === 'none' ? 0 : floorArea;
        const totalArea = paintableWalls + ceilingArea;
        const wallPaintArea = paintableWalls + (ceilingMode === 'combined' ? ceilingArea : 0);
        if (totalArea <= 1e-9) fail(form.elements.namedItem('doors'), 'Boyanacak yüzey sıfırdan büyük olmalı.');
        const litresPerSquareMetre = coats * (1 + reserve / 100) / paintCoverage;
        const wallLitres = wallPaintArea * litresPerSquareMetre;
        const required = Math.max(0, containers(wallLitres * paintDensity * 100, 1));
        const ceilingLitres = ceilingMode === 'separate' ? ceilingArea * litresPerSquareMetre : 0;
        if (required > 150000 || ceilingLitres > 1000) fail(form.elements.namedItem('coats'), 'Her boya türü için en fazla 1.000 L hesaplanabilir. Alanı bölerek yeniden hesaplayın.');
        const best = required ? cheapestPaint(wallPaintFormats, required, 'kg') : { label: '—', quantity: 0, cents: 0 };
        const ceiling = ceilingLitres ? cheapestPaint(ceilingFormats, containers(ceilingLitres * 100, 1), 'L') : null;
        const auxiliaries = paintAuxiliaries(form, totalArea, paintableWalls, walls / height, doors, firstWindow.edges + secondWindow.edges, floorArea);
        const extras = totalItems(auxiliaries);
        const ceilingCost = ceiling?.cents ?? 0;
        const geometryNote = extraWalls > 0
            ? ` Girinti payı: +${n(irregularWallAllowance * 100)} % brüt duvar alanı (${n(extraWalls)} m²).`
            : '';
        const options = required ? [best, ...wallPaintFormats.map(format => {
            const count = containers(required, format.size);
            return { label: `${count} × ${n(format.size / 100)} kg`, quantity: count * format.size, cents: count * format.cents };
        }).filter(option => option.label !== best.label)] : [];
        const ceilingNote = ceiling ? ` · Tavan boyası: ${euros(ceilingCost)}` : '';
        const ceilingRows = ceiling ? [
            ...ceiling.items.map(item => [
                `${item.count} × ${n(item.size / 100)} L tavan boyası`, '—',
                `${n(item.count * item.size / 100)} L`, euros(item.count * item.cents),
            ]),
            ['Tavan boyası toplamı', `${n(ceilingLitres)} L`, `${n(ceiling.quantity / 100)} L`, euros(ceilingCost)],
        ] : [];
        return {
            summary: `${n(wallPaintArea)} m² duvar boyası uygulama alanı · ${n(required / 100)} kg (yaklaşık ${n(wallLitres)} L) fire dahil · En düşük maliyetli alım: ${best.label}${ceilingNote} · Yardımcı malzemeler: ${euros(extras)} · Total: ${euros(best.cents + ceilingCost + extras)}. Düşülen açıklıklar: ${n(openings)} m².${geometryNote}`,
            auxiliaries: itemRows(auxiliaries),
            ceilingRows,
            rows: options.map(({ label, quantity, cents }, i) => [
                i === 0 ? `En düşük maliyet · ${label}` : label,
                `${n(quantity / 100)} kg`, `${n((quantity - required) / 100)} kg`, euros(cents), euros(cents + extras + ceilingCost),
            ]),
        };
    }

    function calculateFloor(form) {
        const length = value(form, 'length', 0.1, 100);
        const width = value(form, 'width', 0.1, 100);
        const irregular = form.elements.namedItem('irregularRoom').checked;
        const area = length * width * (1 + (irregular ? irregularFloorAllowance : 0));
        const need = area * (1 + flooringCutAllowance);
        const perimeter = 2 * (length + width) * (1 + (irregular ? irregularWallAllowance : 0));
        const skirting = Math.max(0, perimeter - 0.8);
        const profile = purchaseItem('Geçiş profili', 1, 'adet', 1, 35000);
        const floatingItems = [
            purchaseItem('MDF süpürgelik', skirting, 'm', 2.4, 14500),
            profile,
            purchaseItem('Takozlu montaj seti', 1, 'adet', 1, 35000),
        ];
        const underlay = purchaseItem('Şilte', area, 'm²', 10, 32000);
        const tile = tileReferences[form.elements.namedItem('tileModel').value];
        const { length: tileLength, width: tileWidth, size: tileSize, pieces: tilePieces } = tile;
        const tileArea = tileSize / tilePieces;
        const grout = area * (1 / (tileLength * 10) + 1 / (tileWidth * 10)) * 3 * 8 * 1.6;
        const tileItems = [
            purchaseItem('Seramik yapıştırıcısı', area * 4, 'kg', 25, 29000),
            purchaseItem('Derz dolgusu', grout, 'kg', 2, 15000),
            purchaseItem('Seramik süpürgelik', skirting, 'm', 0.6, 9000),
            profile,
            purchaseItem('Derz artısı', containers(area, tileArea), 'adet', 200, 10000),
            purchaseItem('Taraklı mala', 1, 'adet', 1, 19000),
            purchaseItem('Derz temizleme kovası', 1, 'adet', 1, 65000),
        ];
        const options = flooringReferences.map(reference => ({
            ...reference,
            items: reference.separateUnderlay ? [underlay, ...floatingItems] : floatingItems,
        }));
        options.push({
            name: tile.label, size: tileSize, unitCents: tile.unitCents, items: tileItems,
        });
        const budgets = options.map(option => {
            const count = containers(need, option.size);
            const supplies = count * option.unitCents;
            const extras = totalItems(option.items);
            return { ...option, count, supplies, extras, total: supplies + extras };
        }).sort((left, right) => left.total - right.total);
        const best = budgets[0];
        const lowest = budgets.filter(option => option.total === best.total).map(option => option.name);
        const geometryNote = irregular ? ` · Girinti payı: +${n(irregularFloorAllowance * 100)} %` : '';
        return {
            summary: `${n(area)} m² net alan${geometryNote} · Kesim payıyla ${n(need)} m² gerekir · En düşük maliyet: ${lowest.join(' ve ')} · ${euros(best.total)}.`,
            auxiliaries: budgets.flatMap(option => itemRows(option.items, option.name)),
            rows: budgets.map(({ name, size, count, unitCents, supplies, extras, total }) => [
                name, n(count), `${n(count * size)} m²`, euros(unitCents), euros(supplies), euros(extras), euros(total), euros(total / area),
            ]),
        };
    }

    function renderRows(target, entries) {
        target.replaceChildren(...entries.map(cells => {
            const row = document.createElement('tr');
            for (const [i, text] of cells.entries()) {
                const cell = document.createElement(i === 0 ? 'th' : 'td');
                if (i === 0) cell.scope = 'row';
                cell.textContent = text;
                row.append(cell);
            }
            return row;
        }));
    }

    function attach(tool, calculate) {
        const form = document.getElementById(`${tool}-form`);
        const message = document.getElementById(`${tool}-summary`);
        const results = document.getElementById(`${tool}-results`);
        const tableRows = document.getElementById(`${tool}-rows`);
        const auxiliaryResults = document.getElementById(`${tool}-aux`);
        const auxiliaryRows = document.getElementById(`${tool}-aux-rows`);
        const ceilingResults = tool === 'paint' ? document.getElementById('paint-ceiling') : null;
        const ceilingRows = tool === 'paint' ? document.getElementById('paint-ceiling-rows') : null;

        function update() {
            form.querySelectorAll('[aria-invalid]').forEach(field => field.removeAttribute('aria-invalid'));
            let result;
            try {
                result = calculate(form);
            } catch (error) {
                message.textContent = error.message;
                message.setAttribute('data-error', '');
                results.hidden = true;
                auxiliaryResults.hidden = true;
                if (ceilingResults) ceilingResults.hidden = true;
                return;
            }
            message.removeAttribute('data-error');
            message.textContent = result.summary;
            renderRows(tableRows, result.rows);
            renderRows(auxiliaryRows, result.auxiliaries);
            auxiliaryResults.hidden = result.auxiliaries.length === 0;
            results.hidden = result.rows.length === 0;
            if (ceilingResults) {
                renderRows(ceilingRows, result.ceilingRows);
                ceilingResults.hidden = result.ceilingRows.length === 0;
            }
        }

        form.noValidate = true;
        form.addEventListener('submit', event => {
            event.preventDefault();
            update();
        });
        form.addEventListener('reset', () => setTimeout(update, 0));
        update();
    }

    if (document.getElementById('paint-form')) attach('paint', calculatePaint);
    if (document.getElementById('floor-form')) attach('floor', calculateFloor);
})();

(() => {
    'use strict';

    const number = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
    const money = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' });
    const n = value => number.format(value);
    const cash = value => money.format(value);

    function read(form, name, min, max) {
        const field = form.elements.namedItem(name);
        const raw = field.value.trim();
        const value = /^-?\d+(?:[.,]\d+)?$/.test(raw) ? Number(raw.replace(',', '.')) : NaN;
        if (!Number.isFinite(value) || value < min || value > max) {
            const details = field.closest('details');
            if (details) details.open = true;
            field.focus();
            throw new Error(field.labels[0].firstChild.textContent.trim() + ' için ' + n(min) + ' ile ' + n(max) + ' arasında bir değer girin.');
        }
        return value;
    }

    function fillRows(body, entries) {
        body.replaceChildren(...entries.map(entry => {
            const row = document.createElement('tr');
            entry.forEach((content, index) => {
                const cell = document.createElement(index === 0 ? 'th' : 'td');
                if (index === 0) cell.scope = 'row';
                if (typeof content === 'string') cell.textContent = content;
                else cell.append(content);
                row.append(cell);
            });
            return row;
        }));
    }

    function bind(id, calculate) {
        const form = document.getElementById(id);
        if (!form) return;
        const result = document.getElementById(id + '-result');
        const run = () => {
            try {
                result.textContent = calculate(form);
                result.removeAttribute('data-error');
            } catch (error) {
                result.textContent = error.message + ' Önceki geçerli sonuç varsa tabloda kalır.';
                result.setAttribute('data-error', '');
            }
        };
        form.noValidate = true;
        form.addEventListener('submit', event => {
            event.preventDefault();
            run();
        });
        run();
    }

    bind('kh-solar', form => {
        const area = read(form, 'area', 0.01, 500);
        const sun = read(form, 'sun', 0, 1500);
        const glass = read(form, 'glass', 0, 1);
        const shade = read(form, 'shade', 0, glass);
        const original = area * sun * glass;
        const shaded = area * sun * shade;
        return `Gölgelemesiz ${n(original)} W · Gölgelemeli ${n(shaded)} W · Azalma ${n(original - shaded)} W`;
    });

    bind('kh-heating', form => {
        const electricity = read(form, 'electricity', 0, 1000);
        const gas = read(form, 'gas', 0, 10000);
        const load = read(form, 'load', 0.1, 100);
        const balance = read(form, 'balance', 5, 21);
        const conversion = read(form, 'conversion', 1, 25);
        const gasEfficiency = read(form, 'gasEfficiency', 1, 100) / 100;
        const electricEfficiency = read(form, 'electricEfficiency', 1, 100) / 100;
        const spf = read(form, 'spf', 1, 8);
        const months = [['Aralık', 31, -7.1], ['Ocak', 31, -10.2], ['Şubat', 28, -8.8]];
        const totals = [0, 0, 0, 0];
        const asRow = (label, [heat, gasVolume, electric, pump]) => [
            label, `${n(heat)} kWh`, `${n(gasVolume)} Sm³ · ${cash(gasVolume * gas)}`,
            `${n(electric)} kWh · ${cash(electric * electricity)}`, `${n(pump)} kWh · ${cash(pump * electricity)}`,
        ];
        const entries = months.map(([month, days, outside]) => {
            const heat = load / 41 * Math.max(0, balance - outside) * days * 24;
            const values = [heat, heat / gasEfficiency / conversion, heat / electricEfficiency, heat / spf];
            values.forEach((value, index) => { totals[index] += value; });
            return asRow(`${month} (${n(outside)} °C)`, values);
        });
        entries.push(asRow('Üç ay toplamı', totals));
        fillRows(document.getElementById('kh-heating-rows'), entries);
        return `Üç ayın tahmini faydalı ısı ihtiyacı ${n(totals[0])} kWh.`;
    });

    const models = document.getElementById('kh-klima-modeller');
    if (!models) return;
    const frame = document.querySelector('#hesaplama iframe');
    const status = document.getElementById('kh-klima-durum');
    const showAll = document.getElementById('kh-klima-tumu');
    const series = [
        {
            name: 'Arçelik',
            source: capacity => 'https://www.arcelik.com.tr/split-klima/' + ({ 9000: '09325', 12000: '12325', 18000: '18325', 24000: '24325' })[capacity] + '-klima',
            models: [
                ['09325', 9000, 2.638, 7, 4, 19, 59],
                ['12325', 12000, 3.517, 6.6, 4, 19, 59],
                ['18325', 18000, 5.275, 7, 4.3, 31, 60],
                ['24325', 24000, 7.034, 6.9, 4.3, 31, 65],
            ],
        },
        {
            name: 'Mitsubishi Electric',
            source: 'https://klima.mitsubishielectric.com.tr/Compare/MSZ-HR.pdf',
            models: [
                ['MSZ-HR25VF', 9000, 2.5, 6.2, 4.3, 21, null],
                ['MSZ-HR35VF', 12000, 3.4, 6.2, 4.3, 22, null],
                ['MSZ-HR50VF', 18000, 5, 6.5, 4.3, 28, null],
                ['MSZ-HR71VF', 24000, 7.1, 7.1, 4.3, 33, null],
            ],
        },
        {
            name: 'Gree Pular',
            source: 'https://tlcklima.com/wp-content/uploads/2024/03/Pular-Urun-Bilgi-Formu.pdf',
            models: [
                ['GWH09AGAXB-K6DNA1B', 9000, 2.5, 6.6, 4.1, 21, 55],
                ['GWH12AGBXB-K6DNA1A', 12000, 3.2, 6.1, 4, 24, 56],
                ['GWH18AGD-K6DNA1D', 18000, 4.6, 6.4, 4, 29, 57],
                ['GWH24AGD-K6DNA1C', 24000, 6.2, 6.8, 4, 30, 63],
            ],
        },
        {
            name: 'Midea Xtreme Save',
            source: 'https://ecmx.com.tr/midea-xtreme-save.html',
            models: [
                ['AG2Eco-09NXD0-I', 9000, 2.64, 7.4, 4.1, 20, null],
                ['AG2Eco-12NXD0-I', 12000, 3.52, 7, 4.2, 21, null],
                ['AG2Eco-18NXD0-I', 18000, 5.28, 7, 4, 20, null],
                ['AG2Eco-24NXD0-I', 24000, 7.03, 6.4, 4, 21, null],
            ],
        },
        {
            name: 'Vestel Flora Doğa Inverter Wi-Fi',
            source: 'https://statik.vestel.com.tr/webfiles/20234513_k.pdf',
            models: [
                ['092', 9000, 2.5, 6.6, 4, null, 52],
                ['122', 12000, 3.4, 6.6, 4, null, 52],
                ['182', 18000, 5.28, 6.5, 4, null, 55],
                ['242', 24000, 6.74, 6.1, 4, null, 59],
            ],
        },
        {
            name: 'Toshiba Seiya',
            source: 'https://www.alarko-carrier.com.tr/Data/Files/Dokumanlar/brosur/toshiba-seiya-2025.pdf',
            models: [
                ['RAS-B10B2KV2G-TR', 9000, 2.5, 6.1, 4, 19, 55],
                ['RAS-B13B2KV2G-TR', 12000, 3.3, 6.1, 4, 19, 56],
                ['RAS-B18B2KV2G-TR', 18000, 5, 6.1, 4, 26, 60],
                ['RAS-B24B2KV2G-TR', 24000, 6.5, 6.1, 4, 29, 61],
            ],
        },
        {
            name: 'Bosch Climate 2000',
            source: 'https://www.bosch-homecomfort.com/ocsmedia/optimized/full/o547408v272_Bosch_Climate2000_LeafletBrosur.pdf',
            models: [
                ['26 WE', 9000, 2.64, 6.3, 4, 25, 54],
                ['35 WE', 12000, 3.52, 6.1, 4, 25, 55],
                ['53 WE', 18000, 5.28, 7.4, 4, 26, 56],
                ['70 WE', 24000, 7.03, 6.1, 4, 36, 59],
            ],
        },
        {
            name: 'E.C.A. Spylos Plus',
            source: 'https://eca.com.tr/uploads/documents/bdd/eef/a8dad3b7-9eba-4734-a891-5f63b3a1724d.pdf',
            models: [
                ['ESA1609A100', 9000, 2.7, 6.5, 4, 19, 57],
                ['ESA1612A100', 12000, 3.5, 6.1, 4, 20, 59],
                ['ESA1618A100', 18000, 5.3, 6.1, 4, 28, 60],
                ['ESA1624A100', 24000, 6.8, 6.1, 4, 29, 65],
            ],
        },
        {
            name: 'Mitsubishi Heavy Industries Trend',
            source: (_, code) => 'https://form-mhiklima.com/tr/urun/' + code.toLowerCase() + '-set',
            models: [
                ['SRK25ZSP-W1', 9000, 2.5, 6.08, 4.1, 23, null],
                ['SRK35ZSP-W1', 12000, 3.2, 7.3, 4.5, 22, null],
                ['SRK50ZSP-W1', 18000, 5, 6.2, 4.2, 22, null],
            ],
        },
        {
            name: 'Airfel',
            source: 'https://airfel.com/uploads/files/AIRFEL_KLIMA_BROSUR_202313.pdf',
            models: [
                ['LTXM25N', 9000, 2.64, 6.3, 4, 25, 54],
                ['LTXM35N', 12000, 3.52, 6.1, 4, 25, 55],
                ['LTXM50N', 18000, 5.28, 7.4, 4, 26, 56],
                ['LTXM71N', 24000, 7.03, 6.1, 4, 36, 59],
            ],
        },
        {
            name: 'Daikin Sensira',
            source: 'https://catalogues.daikin.eu/flipbooks/EN/Air_conditioning/Split/44/',
            models: [
                ['FTXF25F', 9000, 2.5, 6.5, 4.2, 20, 54],
                ['FTXF35F', 12000, 3.3, 6.5, 4.2, 20, 54],
                ['FTXF50F', 18000, 5, 6.5, 4.1, 31, 59],
                ['FTXF71F', 24000, 7.1, 5.15, 3.81, 34, 62],
            ],
        },
        {
            name: 'Baymak Elegant Plus',
            source: 'https://www.baymak.com.tr/media/7416/elegant-plus-klima-brosur-baski-130426.pdf',
            models: [
                ['09', 9000, 2.65, 6.5, 4, null, null],
                ['12', 12000, 3.5, 6.2, 4, null, null],
                ['18', 18000, 5.1, 6.8, 4, null, null],
                ['24', 24000, 7.2, 6.3, 4, null, null],
            ],
        },
        {
            name: 'Carrier AMBI',
            source: 'https://www.alarko-carrier.com.tr/Data/Files/Dokumanlar/brosur/Carrier_AMBI_klima_TR_Brosur.pdf#page=7',
            models: [
                ['42QCE009D8SP', 9000, 2.6, 7, 4.1, 18, 54],
                ['42QCE012D8SP', 12000, 3.5, 6.5, 4.1, 18, 56],
                ['42QCE018D8SP', 18000, 5.2, 7.4, 4.1, 20, 58],
                ['42QCE024D8SP', 24000, 7, 6.5, 4.1, 20, 59],
            ],
        },
    ];
    const data = series.flatMap(({ name, source, models }) => models.map(
        ([code, capacity, power, seer, scop, pressure, soundPower]) => ({
            name: name + ' ' + code, capacity, power, seer, scop, pressure, soundPower,
            source: typeof source === 'function' ? source(capacity, code) : source,
        })
    )).sort((a, b) => a.capacity - b.capacity || a.name.localeCompare(b.name, 'tr'));

    function externalLink(url, label) {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = label;
        return link;
    }

    const dba = value => value === null ? '—' : n(value) + ' dB(A)';
    fillRows(models, data.map(({ name, capacity, power, seer, scop, pressure, soundPower, source }) => [
        name, n(capacity) + ' BTU/h', n(power) + ' kW', n(seer) + ' / ' + n(scop),
        dba(pressure), dba(soundPower),
        externalLink(source, 'Teknik veriye bak'),
        externalLink('https://www.akakce.com/arama/?q=' + encodeURIComponent(name), 'Akakçe’de ara'),
    ]));
    const rows = [...models.rows];
    function reset() {
        rows.forEach(row => { row.hidden = false; });
        showAll.hidden = true;
        status.textContent = 'Tüm kapasite grupları gösteriliyor. Hesap yaptığınızda tablo sonuçla eşleşir.';
    }
    showAll.addEventListener('click', reset);
    window.addEventListener('message', event => {
        if (event.origin !== location.origin || event.source !== frame.contentWindow || event.data?.type !== 'kh-klima-kapasite') return;
        const { watts, capacity } = event.data;
        if (!Number.isFinite(watts) || watts <= 0) { reset(); return; }
        const matching = data.filter(model => model.capacity === capacity);
        if (!matching.length) {
            reset();
            status.textContent = `Hesaplanan ${n(watts / 1000)} kW için önerilen cihaz düzeni bu tablonun kapsamı dışında.`;
            return;
        }
        rows.forEach((row, i) => { row.hidden = data[i].capacity !== capacity; });
        showAll.hidden = false;
        status.textContent = `Yük ${n(watts / 1000)} kW. Önerilen sınıf ${n(capacity)} BTU/h.` +
            (matching.some(model => model.power * 1000 < watts) ? ' Bu sınıftaki en az bir modelin nominal gücü hesaplanan yükün altında kalıyor.' : '');
    });
})();
