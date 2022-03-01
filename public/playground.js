// About innerHTML, I know it's bad and all, and I *will remove* it later on, when I implement
// an actual colorizing function. For now, deal with it. Or, don't visit this website :)

import init, { lex } from "./corul_wasm.js";

import { locate_cursor_pos, load, add, default_input } from "./playground-utils.old.js";

(async () => {

    await init(); // initialize wasm

    const _is_chrome       = !!window.chrome, // currently unused...
          editor           = document.querySelector('.editor'),
          save_btn         = document.querySelector('.save'),
          run_btn          = document.querySelector('.run'),
          theme_btn        = document.querySelector('.theme'),
          settings_btn     = document.querySelector('.settings'),
          play_name        = document.querySelector('#playground-name'),
          highlights       = document.querySelectorAll('.highlight');

    let waiting_for_link   = false;

    const colorize = input => lex(input);

    for (const highlighter of highlights)
        highlighter.innerHTML = colorize(highlighter.textContent);

    const id = new URLSearchParams(window.location.search).get('i');

    try {
        const then = Date.now();
        const res = await load(id);
        // should be true always if no errors occur during load, but still
        if (res?.value)
            editor.innerHTML = colorize(res.value);
        if (res?.name)
            play_name.value = res.name;
        notifs.set_type("n-success");
        notifs.send(`Loaded content successfully in ${Date.now() - then}ms!`);
    } catch (e) {
        if (e) {
            notifs.set_type("n-err");
            notifs.send(`Failed to load content! ${e}`);
        }
        editor.innerHTML = colorize(default_input);
    }

    const input = _ => {
        const sel = window.getSelection();
        const rng = sel.getRangeAt(0);
        rng.setStart(editor, 0);
        // get the current position of the cursor (absolute to editor)
        const len = rng.toString().length
        let tc    = editor.textContent ?? editor.innerText;
        editor.innerHTML =
            colorize(tc)
            // fixes bug in chromium (wants 2 '\n's at the end of input for 1 '\n')
            // and maybe firefox has the same issue too?...
            + (tc.slice(-1) !== '\n' ? '\n' : '');
        // restore the cursor's position, i.e. find which element and where the cursor must be put
        let { node, position } = locate_cursor_pos(editor, len);
        let range              = document.createRange();
        sel.removeAllRanges();
        range.setStart(node, position);
        range.setEnd(node, position);
        sel.addRange(range);
    }

    editor.addEventListener("input", input);

    editor.addEventListener("paste", e => {
        // some copy-paste text is not formatted correctly due to .textContent reading it incorrectly
        // so the paste event is used as a workaround for this issue
        e.preventDefault();
        let txt =
            (e.clipboardData || window.clipboardData).getData('text')
                .replace(/\r/g, '');
        let sel = window.getSelection();
        let rng = sel.getRangeAt(0);
        sel.deleteFromDocument();
        rng.insertNode(document.createTextNode(txt));
        rng.collapse(false);
        input(e);
    });

    editor.addEventListener('keydown', e => {
        if (e.key === "Tab" || (e.keyCode || e.which) === 9) {
            e.preventDefault();
            const sel = window.getSelection();
            const rng = sel.getRangeAt(0);
            const s   = document.createElement('span');
            s.appendChild(document.createTextNode('\t'));
            rng.deleteContents();
            rng.insertNode(s);
            rng.collapse(false);
        }

        // modified from SO answer: https://stackoverflow.com/a/20398132
        if (e.key === "Enter" || (e.keyCode || e.which) === 13) {
            e.preventDefault();
            const sel = window.getSelection();
            const rng = sel.getRangeAt(0);
            const df  = document.createDocumentFragment();
            df.appendChild(document.createTextNode('\n'));
            rng.deleteContents();
            rng.insertNode(df);
            rng.collapse(false);
            input(e); // cursor sometimes bounces when event is not triggered here
        }
    });

    save_btn.addEventListener('click', async _ => {
        if (waiting_for_link) {
            notifs.set_type('n-info');
            notifs.send("Whoa there! Wait up! Your link is getting prepared...");
            return;
        }
        waiting_for_link = true;
        let res = null;
        try {
            // TODO: add a name
            res = await add(editor.textContent, play_name.value, null);
            play_name.value = res.name;
            waiting_for_link = false;
        } catch (e) {
            notifs.set_type('n-err');
            notifs.send(`Failed to add to database! ${e}`);
            return;
        }
        let link = `${window.location.pathname}?i=${res.id}`;
        window.history.replaceState(null, null, link);
        let abs_link =
            `${window.location.protocol}//${window.location.hostname}${window.location.port ? ":" + window.location.port : ""}` + link;

        notifs.set_type('n-info');
        const span = document.createElement('span');
        let similar = "The link for this snippet is: ";
        if (res?.match === 'exact')
            similar = "An exact entry already exists in the database, for which the link is: ";
        else if (res?.match === 'similar')
            similar =
                "A similar entry (with a different name and same value) already exists in the database, for which the link is: ";
        span.innerHTML =
            `${similar}<span class="artificial-link">${abs_link}</span>. All entries expire after 30 days. Click to copy`;
        const el = notifs.send(span);
        // will never be null... but anyway
        el?.addEventListener('click', async _ => {
            try {
                await navigator.clipboard.writeText(abs_link);
                notifs.set_type('n-success');
                notifs.send('Successfully copied link to clipboard!');
            } catch (e) {
                notifs.set_type('n-err');
                notifs.send(
                    'Failed to copy link to clipboard! Please try again, or enable sufficient permissions'
                );
                console.log("Failed to add to clipboard! Error", e);
            }
        });
    });

    run_btn.addEventListener('click', _ => {
        notifs.set_type('n-warn');
        notifs.send(
            'Running the code does not do anything currently, since the language is not in a ready state.'
        );
    });

    theme_btn.addEventListener('click', _ => {
        notifs.set_type('n-warn');
        notifs.send(
            'The theme changer has not been implemented yet, but will be in the near future.'
        );
    });

    settings_btn.addEventListener('click', _ => {
        notifs.set_type('n-warn');
        notifs.send(
            'The settings pane is not currently implemented and will be implemented in future releases.'
        );
    });
})();