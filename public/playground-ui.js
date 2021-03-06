import * as idb from './indexedDB.js';

const tb          = document.querySelector('.tool-bar'),
      main        = document.querySelector('.main'),
      footer      = document.querySelector('.footer-bar'),
      opener      = document.querySelector('.opener'),
      options     = document.querySelector('.settings-area .options'),
      selector    = document.querySelector('.settings-area .tab-selector'),
      resize_bar  = document.querySelector('.bar'),
      sections    = options?.querySelectorAll('.tab-section'),
      tabs        = opener ?.querySelectorAll('.tab'),
      layout      = tb     ?.querySelector('.layout');

const selector_children = [],
      footer_children   = [];

// generate relevant tab buttons and append them to the footer / sidebar
if (tabs && tabs.length > 0) {
    let open = false;
    for (const [idx, tab] of tabs.entries()) {
        const visible  = tab.getAttribute('visible'),
              tab_name = tab.getAttribute('tab-name'),
              btn      = document.createElement('div');

        btn.id = tab.classList[0];
        btn.classList.add('btn');

        if (visible && !open) {
            btn.classList.add('selected');
            open = true; // don't hide all tabs, cuz there's one that's open!
        } else
            tab.classList.add('hide');

        if (tab_name)
            btn.textContent = tab_name;
        else
            btn.textContent = `Tab ${idx}`;

        footer_children.push(btn);
    }
    if (!open) // hide all tabs if none are open
        main.classList.add('hide');
    footer.append(...footer_children);
}

if (sections && sections.length) {
    for (const section of sections) {
        const btn = document.createElement('div'),
              tab_name = section.getAttribute('tab-name');
        btn.classList.add('btn');
        btn.classList.add('selector');
        btn.setAttribute('tab-name', tab_name);
        btn.textContent = tab_name;
        btn.addEventListener('click', function() {
            let tb = this.getAttribute('tab-name');
            if (tb)
                document.querySelector(`.tab-section[tab-name="${tb}"]`)?.scrollIntoView();
        });
        selector_children.push(btn);
    }
    selector.append(...selector_children);
}


export class UI {

    static MIN_WIDTH  = 400;
    static MIN_HEIGHT = 400;

    constructor() {}

    move_to_tab({ id, el }) {
        const sel_tab =
            el ? opener.querySelector('.' + el.id) : id ? opener.querySelector('.' + id) : null;
        if (sel_tab !== null) {
            main.classList.remove('hide');
            const tab = footer.querySelector('#' + sel_tab.classList[0]);
            for (const tab of tabs)
                if (tab !== sel_tab)
                    tab.classList.add('hide');
            for (const footer_btn of footer_children)
                if (footer_btn !== tab)
                    footer_btn.classList.remove('selected');
            sel_tab.classList.remove('hide');
            tab    .classList.add('selected');
        } else {
            for (const footer_btn of footer_children)
                footer_btn.classList.remove('selected');
            main.classList.add('hide');
        }
    }

    footer_btn_click(el) {
        if (el.classList.contains('selected'))
            this.move_to_tab({ /* null, so hide all tabs */ });
        else
            this.move_to_tab({ el });
    }

    // I'm not using media queries only because, doing it in JS offers more flexibility.
    // To figure out weather a media query was triggered is not really that ideal...
    size_check() {
        const cl    = this.mode ?? 'horizontal',
              reset = (_this) => {
                   _this.window_small = false;
                   if (cl === 'horizontal') layout.classList.remove('flip');
                   else layout.classList.add('flip');
                   layout.classList.remove('disabled'); // disabled = false not working??
              }
        if (window.innerHeight <= UI.MIN_HEIGHT || window.innerWidth <= UI.MIN_WIDTH) {
            this.window_small = true;
            if (window.innerWidth <= UI.MIN_WIDTH) {
                main.classList.remove('horizontal');
                main.classList.add('vertical');
                layout.classList.add('flip');
            } else {
                main.classList.remove('vertical');
                main.classList.add('horizontal');
                layout.classList.remove('flip');
            }
            layout.classList.add('disabled'); // disabled = true not working??
        } else if (!main.classList.contains(cl)) {
            main.classList.remove('horizontal', 'vertical');
            main.classList.add(cl);
            reset(this);
        } else reset(this);
    }

    async change_layout() {
        if (this.window_small) return;
        layout.classList.toggle('flip');
        if (layout.classList.contains('flip')) {
            this.mode = 'vertical';
            main.classList.remove('horizontal');
            main.classList.add(this.mode);
        } else {
            this.mode = 'horizontal';
            main.classList.remove('vertical');
            main.classList.add(this.mode);
        }
        await idb.setItem('layout', this.mode);
    }

    resize_tab(e, type) {
        // when using touch, resizing is sometimes laggy... wierd bug
        const root         = document.documentElement,
              cursor_style =
                  resize_bar.style.cursor || window.getComputedStyle(resize_bar).cursor;
        // touch event stuff
        const orig_ev    = e.originalEvent ?? e,
              touches    = orig_ev?.touches || orig_ev?.changedTouches,
              touch      = touches ? touches[0] : null,
              [ cx, cy ] = [
                  touch?.clientX || e.clientX || e.pageX || e.screenX,
                  touch?.clientY || e.clientY || e.pageY || e.screenY,
              ];
        switch (type) {
            case 'down': {
                if (!e.type?.includes('touch')) e.preventDefault();
                root.style.cursor = cursor_style;
                this.resizing = true;
                this.coords = { cx, cy };
            }
            break;
            case 'move': {
                if (this.resizing && this.coords) {
                    if (!e.type?.includes('touch')) e.preventDefault();
                    const [ pcx, pcy ] = [ this.coords.cx, this.coords.cy ],
                          [ ox, oy ]   = [ pcx - cx, pcy - cy ],
                          opener_cs    = window.getComputedStyle(opener),
                          bc           = document.documentElement.getBoundingClientRect();
                    if (main.classList.contains('horizontal')) {
                        // using getBoundingClientRect to get floating precision viewport width & height
                        const percent = (parseFloat(opener_cs.width) + ox) * 100 / (bc.width ?? window.innerWidth);
                        document.documentElement
                            .style
                            .setProperty('--tab-width', this.window_small ?
                                (parseFloat(opener_cs.width) + ox + 'px') :
                                (percent + 'vw'));
                    } else if (main.classList.contains('vertical')) {

                        const percent = (parseFloat(opener_cs.height) + oy) * 100 / (bc.height ?? window.innerHeight);
                        document.documentElement
                            .style
                            .setProperty('--tab-height', this.window_small ?
                                (parseFloat(opener_cs.height) + oy + 'px') :
                                (percent + 'vh'));
                    }
                    this.coords = { cx, cy };
                }
            }
            break;
            case 'end': {
                this.resizing = false;
                root.style.cursor = 'auto';
            }
        }
    }

    async start() {
        // First class must always be `horizontal` or `vertical` to work
        let _l = await idb.getItem('layout');
        this.mode = _l ? _l : main.classList[0];
        for (const child of footer_children)
            child.addEventListener('click', this.footer_btn_click.bind(this, child));
        if (layout) // will always be true, for this website, but anyway...
            layout.addEventListener('click', this.change_layout.bind(this));

        this.size_check();
        window.addEventListener('resize', this.size_check.bind(this));

        const t = this;
        resize_bar.addEventListener('dragstart' , e => e.preventDefault());

        resize_bar.addEventListener('mousedown' , e => t.resize_tab.call(t, e, 'down'));
        resize_bar.addEventListener('touchstart', e => t.resize_tab.call(t, e, 'down'),
            { passive: true }); // apparently passive improves performance? (lighthouse)
        // it does seem to remove that "laggy bug" that occurs when using touch to resize the tab

        window.addEventListener('mousemove'  , e => t.resize_tab.call(t, e, 'move'));
        window.addEventListener('touchmove'  , e => t.resize_tab.call(t, e, 'move'),
            { passive: true });

        window.addEventListener('mouseup'    , e => t.resize_tab.call(t, e, 'end'));
        window.addEventListener('touchend'   , e => t.resize_tab.call(t, e, 'end'),
            { passive: true });
        window.addEventListener('touchcancel', e => t.resize_tab.call(t, e, 'end'),
            { passive: true });
        window.addEventListener('mouseleave' , e => t.resize_tab.call(t, e, 'end'));
        window.addEventListener('dragend'    , e => t.resize_tab.call(t, e, 'end'));

        const sb_db = document.querySelector('#sb-db'),
              fb_db = document.querySelector('#fb-db'),
              url   = document.querySelector("#url");

        sb_db.addEventListener('input', async _ => {
            if (sb_db.checked)
                await idb.setItem('db-mode', 'sb-db')
        });
        fb_db.addEventListener('input', async _ => {
            if (fb_db.checked)
                await idb.setItem('db-mode', 'fb-db')
        });
        url.addEventListener('input', async _ => {
            if (url.checked)
                await idb.setItem('db-mode', 'url')
        });

        fb_db.checked = false;
        sb_db.checked = false;
        url  .checked = false;

        switch (await idb.getItem('db-mode')) {
            case 'fb-db' : fb_db.checked = true; break;
            case 'url'   : url  .checked = true; break;
            default      : sb_db.checked = true;
        }

        // replace characters in playground-name input area
        const playground_name_input = document.querySelector('#playground-name');
        playground_name_input.addEventListener('input', _ => {
            playground_name_input.value =
                playground_name_input.value.substring(0, 50 /* Max name length */ );
        });
    }
}

export class Notification {
    constructor(
        ui           ,
        base_class   ,
        message_class,
        time_class   ,
    ) {
        this.ui          = ui;
        this._root       =
            opener.querySelector('.notifications') || document.documentElement;
        this._modal_root =
            document.querySelector('.floating-notifs') || document.documentElement;
        this._duration   = 5000;
        this._modal      = false;
        this._base_cls   = base_class     || 'notification';
        this._msg_cls    = message_class  || 'message';
        this._time_cls   = time_class     || 'time-stamp';
        this._hour24     = false;
        this._type       = null;
        this._root
            .querySelector('.clear-all')
            .addEventListener('click', _ => {
            const children = this._root.querySelectorAll('.notification');
            for (const child of children) child.remove();
            if (!this._root.querySelector('.no-notif-plchldr')) {
                const p = document.createElement('p');
                p.classList.add('no-notif-plchldr');
                p.textContent = 'No new notifications!';
                this._root.append(p);
            }
        });
    }

    // unused
    set_date_fmt(hour_24_format) {
        this._hour24 = hour_24_format;
    }

    // unused
    set_modal_duration(dur = 1000) {
        this._duration = dur;
    }

    set_type(type) {
        this._type = type;
    }

    set_modal(open = false) {
        this._modal = open;
        if (open)
            this._modal_root.style.display = 'block';
        else
            this._modal_root.style.display = 'none';
    }

    _pad(value) {
        if (value < 10)
            value = '0' + value;
        return value;
    }

    // generate timestamp
    _gen_ts() {
        const date    = new Date(),
              hrs     = date.getHours(),
              mins    = date.getMinutes(),
              secs    = date.getSeconds(),
              am_pm   = hrs >= 12 ? ' PM' : ' AM',
              hrs_fmt = `${this._hour24 ? hrs : (hrs > 12 ? hrs - 12 : hrs)}`;
        return `${ hrs_fmt }:${ this._pad(mins) }:${ this._pad(secs) }${ this._hour24 ? '' : am_pm }`;
    }

    send(value = "Unknown message") {
        let time_stamp;
        if (this._time_cls) {
            time_stamp             = document.createElement("span");
            time_stamp.textContent = this._gen_ts();
            time_stamp.classList.add(this._time_cls);
        }

        if (this._modal) {
            const base      = document.createElement("div"),
                  text_span = document.createElement("span");

            text_span.append(value.nodeType ? value.cloneNode(true) : value);
            base     .append(text_span);

            text_span.classList.add(this._msg_cls);
            base     .classList.add(this._base_cls);

            if (this._type)
                base.classList.add(this._type);

            if (time_stamp)
                base.append(time_stamp.cloneNode(true));

            setTimeout(() => base.remove(), this._duration);

            this._modal_root.append(base);
        }

        const q = this._root.querySelector('.no-notif-plchldr');
        if (q) q.remove();

        if (!this._modal)
            this.ui.move_to_tab({ id: this._root.classList[0] });

        const base      = document.createElement("div"),
              text_span = document.createElement("span");

        base.title = 'Double click to remove this notification.';

        text_span.append(value);
        base     .append(text_span);

        text_span.classList.add(this._msg_cls);
        base     .classList.add(this._base_cls);

        if (this._type)
            base.classList.add(this._type);

        if (time_stamp)
            base.append(time_stamp);

        this._root.append(base);
        this._type = null;

        this._root.scrollTo(this._root.scrollLeft, this._root.scrollHeight);

        base.addEventListener('dblclick', _ => base.remove());

        return base;
    }
}