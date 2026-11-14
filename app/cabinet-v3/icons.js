// ZetSlay line icons (24px grid, 1.75 stroke). Utility actions only; entities use 3D art.
(function () {
  'use strict';
  var P = {
    chevron: 'M9 5l7 7-7 7',
    arrow: 'M4 12h16M14 6l6 6-6 6',
    close: 'M6 6l12 12M18 6L6 18',
    check: 'M5 12.5l4.5 4.5L19 7',
    alert: 'M12 7.5v6M12 17h.01',
    warn: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 8v4.6M12 15.8h.01',
    question: 'M9.2 9.3a2.9 2.9 0 1 1 4.3 2.5c-.9.5-1.5 1-1.5 2.2M12 17.2h.01',
    minus: 'M7 12h10',
    pause: 'M9 6v12M15 6v12',
    play: 'M8 5.5v13l10-6.5z',
    clock: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 7.5V12l3 2',
    refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
    home: 'M3.5 10.5L12 4l8.5 6.5V20h-5.5v-6h-6v6H3.5z',
    orders: 'M6 4h12v17H6zM9 9h6M9 13h6M9 17h3',
    message: 'M4 5h16v11H9.5L5 19.5V16H4z',
    grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
    plug: 'M9 3v5M15 3v5M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0zM12 17v4',
    bell: 'M6.5 10a5.5 5.5 0 0 1 11 0v4.5L19.5 17h-15l2-2.5zM10 20h4',
    card: 'M3.5 6h17v12h-17zM3.5 10h17M7 14.5h4',
    user: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4.5 20.5a7.5 7.5 0 0 1 15 0',
    shield: 'M12 3.5l7.5 3V12c0 4.5-3.5 7.5-7.5 9-4-1.5-7.5-4.5-7.5-9V6.5zM9 12l2.2 2.2L15.5 10',
    help: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM9.6 9.6a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.2.9-1.2 1.8M12 16.6h.01',
    doc: 'M7 3.5h7l4 4v13H7zM14 3.5v4h4M10 12h5M10 15.5h5',
    logout: 'M10 4.5H5v15h5M15 8l4 4-4 4M19 12H9.5',
    menu: 'M4 7h16M4 12h16M4 17h16',
    lock: 'M6 10.5h12V20H6zM8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5',
    key: 'M8.5 9.5a4 4 0 1 0 0 .01M11.5 12.5L20 21M16.5 17.5l2-2M14 15l2-2',
    route: 'M6 18.5a2 2 0 1 0 0-.01M18 5.5a2 2 0 1 0 0-.01M8 18.5h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16',
    unlink: 'M9.5 14.5l-2 2a3.2 3.2 0 0 1-4.5-4.5l2-2M14.5 9.5l2-2a3.2 3.2 0 0 1 4.5 4.5l-2 2M4 4l16 16',
    external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
    info: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM12 11v5.5M12 7.8h.01',
    search: 'M10.5 4a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM15.5 15.5L20 20',
    tag: 'M3.5 12.5V4h8.5l8.5 8.5-8 8zM8 8.5h.01',
    copy: 'M8.5 8.5h11v11h-11zM15.5 8.5v-4h-11v11h4',
    bolt: 'M13 3L5 13.5h6L10 21l8-10.5h-6z',
    sparkle: 'M12 3.5l1.8 5.2L19 10.5l-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8zM18.5 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z',
    chat: 'M4 5h16v11H9.5L5 19.5V16H4zM8.5 10.5l2 2 4-4',
    gamepad: 'M7 8h10a4 4 0 0 1 4 4.5l-.6 3.5a2 2 0 0 1-3.5 1L15 15H9l-1.9 2a2 2 0 0 1-3.5-1L3 12.5A4 4 0 0 1 7 8zM8 11v3M6.5 12.5h3M15.5 12h.01M17 13.5h.01',
    queue: 'M4 6h16M4 12h16M4 18h10',
    history: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4M12 8v4l3 2',
    wallet: 'M4 7.5h15.5V19H4zM4 7.5l11-3.5v3.5M15.5 13.3h.01',
    box: 'M4 7.5L12 4l8 3.5v9L12 20l-8-3.5zM4 7.5l8 3.5 8-3.5M12 11v9',
    users: 'M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 19.5a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 5.5',
    download: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14',
    upload: 'M12 15.5V4M7 9l5-5 5 5M5 19.5h14',
    plus: 'M12 5v14M5 12h14',
    trash: 'M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5',
    pin: 'M9 4h6l-1 6 3 3v1.5H7V13l3-3zM12 14.5V20',
    clip: 'M15.5 7.5l-6.8 6.8a2 2 0 0 0 2.8 2.8l7-7a4 4 0 0 0-5.7-5.6l-7 7a6 6 0 0 0 8.5 8.4l6-6',
    calendar: 'M4.5 6h15v14h-15zM4.5 10h15M8.5 3.5V7M15.5 3.5V7',
    globe: 'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17zM3.5 12h17M12 3.5c2.4 2.5 3.5 5.3 3.5 8.5s-1.1 6-3.5 8.5M12 3.5C9.6 6 8.5 8.8 8.5 12s1.1 6 3.5 8.5',
    fingerprint: 'M7 18.5c1.5-2 2-4 2-6.5a3 3 0 0 1 6 0c0 2.5-.5 5-2 7.5M4.5 15c.5-1 .8-2 .8-3a6.7 6.7 0 0 1 13.4 0c0 1.5-.2 3-.6 4.5M12 12c0 3-1 5.5-2.5 7.5',
    device: 'M7 3.5h10v17H7zM11 17.5h2',
    book: 'M5 5a2 2 0 0 1 2-1.5h12V17H7a2 2 0 0 0-2 2zM5 19a2 2 0 0 0 2 1.5h12V17',
    filter: 'M4 5.5h16l-6 7.5v5l-4 1.5v-6.5z',
    receipt: 'M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5zM9 8h6M9 12h6M9 16h3',
    send:'M21 4L3.5 11l6.5 2.5L12.5 20 21 4zM10 13.5L21 4',
    eye: 'M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    eyeoff: 'M3 3l18 18M10.6 6.1A9.6 9.6 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.7 3.4M6.6 6.7C4 8.4 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.7 0 3.2-.5 4.5-1.2M9.9 9.9a3 3 0 0 0 4.2 4.2',
    sliders:'M5 6h8M17 6h2M5 12h2M11 12h8M5 18h10M19 18h0M15 4v4M9 10v4M17 16v4'
  };
  function svg(name, cls) {
    var d = P[name] || P.info;
    return '<svg class="ico' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="' + d + '"/></svg>';
  }
  function hydrate(root) {
    (root || document).querySelectorAll('svg[data-icon]').forEach(function (el) {
      if (el.dataset.hydrated) return;
      el.setAttribute('viewBox', '0 0 24 24');
      el.setAttribute('aria-hidden', 'true');
      el.setAttribute('focusable', 'false');
      el.innerHTML = '<path d="' + (P[el.dataset.icon] || P.info) + '"/>';
      el.dataset.hydrated = '1';
    });
  }
  window.ZSIcons = { svg: svg, hydrate: hydrate, names: Object.keys(P) };
  if (document.readyState !== 'loading') hydrate(); else document.addEventListener('DOMContentLoaded', function () { hydrate(); });
})();
