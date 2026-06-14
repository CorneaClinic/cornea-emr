/**
 * Cornea Clinic — lid condition type-ahead autocomplete
 * Phase 5 extraction from Cornea.html
 */

function buildLidConditionOptions() {
    const o = [];
    const add = (s) => o.push(s);
    const L = ['Upper lid', 'Lower lid', 'Both lids'];

    L.forEach(loc => ['Seborrhoeic', 'Ulcerative'].forEach(t => add(`1. Anterior Blepharitis — ${loc} — ${t}`)));
    ['Good', 'Fair', 'Poor'].forEach(t => add(`2. Bell's Phenomenon — ${t}`));
    add('3. Blepharophimosis — Palpebral Height (mm)');
    add('3. Blepharophimosis — Palpebral Width (mm)');
    L.forEach(loc => add(`4. Chalazion — ${loc}`));
    L.forEach(loc => add(`5. Coloboma — ${loc}`));
    const cystSub = ['Zeis', 'Moll', 'Comedones', 'Milia', 'Epidermal Inclusion Cyst', 'Dermoid'];
    L.forEach(loc => cystSub.forEach(s => add(`6. Cyst — ${loc} — ${s}`)));
    add('7. Deep Socket');
    add('8. Dermatochalasis');
    L.forEach(loc => ['Mild', 'Moderate', 'Severe'].forEach(sev => add(`9. Ecchymosis — ${loc} — ${sev}`)));
    const ect = ['Involutional', 'Cicatricial', 'Paralytic', 'Mechanical'];
    L.forEach(loc => ect.forEach(t => add(`10. Ectropion — ${loc} — ${t}`)));
    L.forEach(loc => add(`11. Edema — ${loc}`));
    const ent = ['Involutional', 'Spastic', 'Cicatricial', 'Congenital'];
    L.forEach(loc => ent.forEach(t => add(`12. Entropion — ${loc} — ${t}`)));
    L.forEach(loc => add(`13. Floppy Eye Lids — ${loc}`));
    L.forEach(loc => add(`14. Hordeolum externum (stye) — ${loc}`));
    L.forEach(loc => add(`15. Hordeolum Internum — ${loc}`));
    const lac = ['Sutured', 'Unsutured', 'Full Thickness', 'Partial Thickness', 'Involving Lid Margin', 'Involving Canaliculi'];
    L.forEach(loc => lac.forEach(t => add(`16. Laceration — ${loc} — ${t}`)));
    L.forEach(loc => add(`17. Lagophthalmos — ${loc}`));
    ['Trichiasis', 'Madarosis', 'Poliosis', 'Distichiasis'].forEach(t => add(`18. Lashes — ${t}`));
    L.forEach(loc => add(`19. Lid lag — ${loc}`));
    L.forEach(loc => add(`20. Lid retraction — ${loc}`));
    L.forEach(loc => add(`21. Matted Lashes — ${loc}`));
    const mgd = ['Meibomian Capping', 'Hyperaemic Lid Margin', 'Froth on the Lid Margin'];
    L.forEach(loc => mgd.forEach(t => add(`22. MGD — ${loc} — ${t}`)));
    L.forEach(loc => ['Freckle', 'Naevus'].forEach(t => add(`23. Pigmented Lesion — ${loc} — ${t}`)));
    L.forEach(loc => add(`24. Pthriasis palpebrum — ${loc}`));
    ['Mild', 'Moderate', 'Severe', 'Complete', 'MRD1', 'MRD2', 'MRD3'].forEach(t => add(`25. Ptosis — ${t}`));
    add('26. Scar — Above Lower lid — (size in mm)');
    add('26. Scar — Above Upper lid');
    add('26. Scar — Both lids');
    const skin = ['Crust', 'Hyper Pigmented', 'Hypo Pigmented', 'Erythematous', 'Vesicles'];
    L.forEach(loc => skin.forEach(t => add(`27. Skin — ${loc} — ${t}`)));
    const tumors = ['Papilloma', 'Skin Tags', 'Capillary Hemangioma', 'Neurofibroma', 'Basal Cell Carcinoma', 'Squamous Cell Carcinoma', 'Sebaceous Gland Carcinoma'];
    L.forEach(loc => tumors.forEach(t => add(`28. Tumor — ${loc} — ${t}`)));
    add('29. Xanthelasma');
    return o;
}

let _lidAllOptions = null;
function getAllLidConditionStrings() {
    if (!_lidAllOptions) _lidAllOptions = buildLidConditionOptions();
    return _lidAllOptions;
}

function filterLidOptions(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const all = getAllLidConditionStrings();
    const out = [];
    for (let i = 0; i < all.length && out.length < 100; i++) {
        if (all[i].toLowerCase().includes(q)) out.push(all[i]);
    }
    return out;
}

function setupLidAutocompleteForEye(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);
    if (!input || !list) return;

    list.dataset.lidInputId = inputId;

    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', listId);
    input.setAttribute('aria-expanded', 'false');

    let hi = -1;
    let blurTO = null;
    let scrollListenersBound = false;

    function positionList() {
        const r = input.getBoundingClientRect();
        if (r.width < 2 && r.height < 2) return;
        const pad = 8;
        const w = Math.max(160, r.width);
        let left = r.left;
        if (left + w > window.innerWidth - pad) left = window.innerWidth - pad - w;
        if (left < pad) left = pad;
        list.style.left = left + 'px';
        list.style.top = (r.bottom + 4) + 'px';
        list.style.width = w + 'px';
        const maxH = Math.min(240, Math.max(100, window.innerHeight - r.bottom - 16));
        list.style.maxHeight = maxH + 'px';
    }

    list._lidReposition = positionList;

    function unbindScroll() {
        if (!scrollListenersBound) return;
        scrollListenersBound = false;
        window.removeEventListener('scroll', onScrollResize, true);
        window.removeEventListener('resize', onScrollResize);
    }

    function hide() {
        list.classList.remove('open');
        list.innerHTML = '';
        list.setAttribute('aria-hidden', 'true');
        input.setAttribute('aria-expanded', 'false');
        hi = -1;
        unbindScroll();
    }

    function onScrollResize() {
        if (list.classList.contains('open')) positionList();
    }

    function bindScroll() {
        if (scrollListenersBound) return;
        scrollListenersBound = true;
        window.addEventListener('scroll', onScrollResize, true);
        window.addEventListener('resize', onScrollResize);
    }

    function renderAndShow(matches) {
        list.innerHTML = '';
        hi = -1;
        matches.forEach((text, idx) => {
            const li = document.createElement('li');
            li.className = 'lid-ac-item';
            li.setAttribute('role', 'option');
            li.id = listId + '-opt-' + idx;
            li.textContent = text;
            li.addEventListener('mousedown', (e) => {
                e.preventDefault();
                input.value = text;
                input.dispatchEvent(new Event('input', { bubbles: true }));
                hide();
                input.focus();
            });
            list.appendChild(li);
        });
        if (matches.length === 0) {
            hide();
            return;
        }
        list.setAttribute('aria-hidden', 'false');
        list.classList.add('open');
        requestAnimationFrame(() => {
            positionList();
            bindScroll();
        });
        input.setAttribute('aria-expanded', 'true');
    }

    function refresh() {
        clearTimeout(blurTO);
        const q = input.value;
        if (!q.trim()) {
            hide();
            return;
        }
        renderAndShow(filterLidOptions(q));
    }

    input.addEventListener('input', refresh);
    input.addEventListener('focus', () => {
        if (input.value.trim()) refresh();
        else hide();
    });
    input.addEventListener('blur', () => {
        blurTO = setTimeout(hide, 200);
    });

    input.addEventListener('keydown', (e) => {
        if (!list.classList.contains('open') || !list.firstChild) {
            if (e.key === 'Escape') hide();
            return;
        }
        const items = [...list.querySelectorAll('.lid-ac-item')];
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            hi = Math.min(hi + 1, items.length - 1);
            items.forEach((el, i) => el.setAttribute('aria-selected', i === hi ? 'true' : 'false'));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            hi = Math.max(hi - 1, 0);
            items.forEach((el, i) => el.setAttribute('aria-selected', i === hi ? 'true' : 'false'));
        } else if (e.key === 'Enter' && hi >= 0) {
            e.preventDefault();
            input.value = items[hi].textContent;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            hide();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            hide();
        }
    });
}

function repositionOpenLidAutocompleteLists() {
    document.querySelectorAll('.lid-ac-list.open').forEach((ul) => {
        if (typeof ul._lidReposition === 'function') ul._lidReposition();
    });
}

function setupLidAutocomplete() {
    setupLidAutocompleteForEye('lidRE', 'lidRE-ac');
    setupLidAutocompleteForEye('lidLE', 'lidLE-ac');
}

window.repositionOpenLidAutocompleteLists = repositionOpenLidAutocompleteLists;
window.getAllLidConditionStrings = getAllLidConditionStrings;
