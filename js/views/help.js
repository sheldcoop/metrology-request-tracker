/**
 * Metrology Request Tracker - views/help.js  (pattern from ABF Tracker v2)
 *
 * The user manual inside the app (#/help, the ? button in the top bar):
 * short step-by-step guides in the words the screens use, searchable,
 * printable (Print / PDF), each linking to the page it explains. The admin
 * guides hold the office checklist so nobody has to remember it (M1-11).
 * Text only - it reads nothing from the data file. #/help/<id> opens a guide.
 * When a screen changes, its guide changes in the same commit.
 */
window.MRT = window.MRT || {};
window.MRT.views = window.MRT.views || {};
window.MRT.views.help = (function () {
  'use strict';

  var ui = window.MRT.ui;
  var D = window.MRT.domain;
  var cfg = window.MRT.config;

  /* Each guide: id, title, icon, intro, steps (in order), tips, link [label, hash], extra() for a picture, admin. */
  var GUIDES = [
    { id: 'start', title: 'Getting started', icon: 'folder',
      intro: 'The app keeps everything in one file, ' + cfg.data_file + ', in the folder "data" next to the app on the share.',
      steps: [
        'Open the app with "Metrology Tool.cmd" (next to index.html). It starts Edge and tells the app your Windows user name.',
        'The first time on a PC, click Choose data folder and pick the folder "data". Next time it is one click (Reconnect) or none.',
        'First time ever? Say who you are. If an admin already added you, pick your name ("Is this you?"). Otherwise you are added as an Engineer and an admin sets your roles.',
        'Every change is saved at once - there is no Save button. The lamp next to the logo shows it: green = saved, red = not saved.'
      ],
      tips: [
        'Made a mistake? Click Undo next to the lamp, or press Ctrl+Z, within ' + cfg.undo_ms / 1000 + ' seconds.',
        'The strip under the top bar counts what needs attention - Line stop, Late, On hold, Needs clarification - for your tools (quality engineers) or your own requests. Click a count to see those requests.',
        'On a shared PC, use your name (top right) > Change user.'
      ],
      link: ['Open Lab status', '#/lab'] },

    { id: 'roles', title: 'Who does what (roles)', icon: 'users',
      intro: 'Each person has one or more roles. An admin ticks them in Settings > People.',
      extra: function () {
        var what = {
          engineer: 'requests measurements (from M2)',
          quality: 'runs the measurements: primary or backup of a tool, sets tool status; accepts and completes requests (from M3)',
          operator: 'no rights of its own yet - what operators may do is decided later',
          manager: 'sees the manager analytics (from M5)',
          admin: 'changes Settings, with the admin PIN'
        };
        return ui.el('dl', { class: 'help-roles' }, D.ROLES.map(function (r) {
          return [ui.el('dt', { text: D.ROLE_LABEL[r] }), ui.el('dd', { text: what[r] || '' })];
        }));
      },
      steps: [
        'Several roles per person are fine, e.g. a quality engineer who also requests is Engineer and Quality engineer.',
        'Everyone can read everything. Changes are limited by role.'
      ] },

    { id: 'lab', title: 'Lab status and tool status', icon: 'gauge',
      intro: 'Every tool as its nameplate: the tool drawing, its status, its quality engineers and what is set up for it.',
      steps: [
        'Green edge and "Up": the tool is running. Amber "Maintenance" and red "Down" show the until date and a note when given.',
        'The drawing tells it too: the beam is on when Up, dashed amber in Maintenance, gone when Down.',
        'A tool\'s primary or backup quality engineer (or an admin) clicks Set status, picks Up, Maintenance or Down, and optionally an until date and a note.',
        '"sample entries" on a plate: some of its measurement types or BKMs are still made up - see "Admin: setting up the office".'
      ],
      tips: ['Each plate also shows its queue: open requests (late ones counted), the oldest open request and the typical wait (median lab time from submit to start).',
             'While a tool has a request In progress its drawing works: the FIB beam rasters, the QVM crosshair locks on, the PRF stylus glides, the HRM probe taps, the AOI scan sweeps. A Down tool shows a blinking lamp.'],
      link: ['Open Lab status', '#/lab'] },

    { id: 'lots', title: 'Lots: register a lot', icon: 'lots',
      intro: 'Any engineer registers a lot here - or simply types a new lot number in the request form; it is registered when the request is sent.',
      steps: [
        'Lots > Register lot. Lot number: digits, e.g. 18178; a split lot adds .01, .02 (18178.01).',
        'Panels in the lot: optional. Requests name their panels by Hirata ID.',
        'A note is optional, e.g. "panels 3-4 have a known scratch". Below it come the lot fields the admin set up (e.g. Purpose of the lot, Started on, Lot status).',
        'Click a lot number to see all its details.',
        'You (the owner) or an admin can change the lot later, or delete it while no request uses it.'
      ],
      tips: ['A lot is just its number (plus panels, note and lot fields): project, part number and build-up are given on each request, because one lot runs through every build-up. The list shows the projects of its requests.',
             'Filter by lot, project (of its requests), owner or note; "Only my lots" shows yours. The search box at the top finds lots too.'],
      link: ['Open Lots', '#/lots'] },

    { id: 'new-request', title: 'New request', icon: 'request_new',
      intro: 'One request = one tool. Several tools on a lot = several requests. The form goes step by step: tool first, and each finished step folds into one line.',
      steps: [
        '1 Tool: click its drawing, then the measurement type and the BKM from the library - or paste the path of your own BKM PowerPoint. Without a BKM, say what to measure in the purpose (step 5).',
        '2 Lot and panels: Project · Lot · Build-up on one line - three separate choices. Pick the project (its part numbers appear below, optional). Type the lot number or pick it from the list; a lot that is not registered yet shows "New lot" and is registered when you submit. The build-up is optional: pick it and the layers follow it. Then the panels: their Hirata IDs ("3252, 3253" or "3252-3255"), or just how many (usually 2). Tick the layers if it matters: 1FCO / 1BCO is the core, BU-01 adds 2F / 2B, up to BU-04 = 5F / 5B; without a build-up all up to 5F / 5B.',
        '3 Where the panels are: pick the magazine and click the slots they sit in (or press and drag over several), or write a note ("in MES", "with Anna"). Slots other open requests hold are greyed out. Then where the panels go afterwards; FIB destroys panels: tick that they may be scrapped.',
        '4 Priority and date: Line stop and Hot need a reason. The needed-by date is optional.',
        '5 Purpose and tool fields: why the measurement, and whatever the tool asks in addition.',
        'Review lists what is still missing, step by step. Save draft keeps it for later - only you see drafts. Submit warns about a Down tool, an open request on the same panels, or a missing BKM, and then gives the request its ID, e.g. FIB-260924-03.'
      ],
      tips: ['The strip on top jumps to any step: green is done, amber still needs something.',
             '"Copy this request" (after submitting) or "New request on this lot" (lot details) saves typing.',
             'The traveller card on the right builds up as you fill in: what the quality engineer will see.'],
      link: ['New request', '#/new'] },

    { id: 'request-page', title: 'The request page', icon: 'requests',
      intro: 'Every submitted request has its own page: open it from the search (type part of the ID), from a lot\'s details or from your requests.',
      steps: [
        'The traveller card on top: request ID, tool, status stamp, lot, priority (the coloured stripe: red Line stop, amber Hot, green Normal, grey Low), needed-by, the panels (Hirata IDs or how many), layers, and the magazine with its slots.',
        'The countdown counts lab time only (lab days and hours, minus holidays): "13 h lab time left (3 days)". Outside lab hours it says "clock paused". Late requests turn red.',
        'The status rail shows each step - Submitted, Accepted, In progress, Completed - with who and when.',
        'On the right: the BKM path and the proposed results folder, each with a Copy button, the details and the people.',
        'Timeline: every status change and comment. Write @Name (or @windowsid) to point someone at a comment - they are notified from M4.',
        'Cancel request (requester, the tool\'s quality engineers, admins): give a reason. A cancelled request stays visible, never deleted.'
      ],
      tips: ['Edit request (requester): change anything but the tool, with a reason - the timeline shows each change.',
             'Print slip: an A6 traveller card with the request ID as a barcode, to put with the panels. A hand scanner reading it (anywhere in the app, not in a text field) opens the request.'],
      link: ['New request', '#/new'] },

    { id: 'my-requests', title: 'My requests (engineers)', icon: 'requests',
      intro: 'Everything you asked the lab for - your start page as an engineer.',
      steps: [
        'Waiting on you comes first (yellow): a question to answer (Answered), or completed results to check (Results OK or Reopen with a reason).',
        'Then your open requests: status, needed-by with the lab-time countdown, the expected done date (bold when later than you need it) and who has it.',
        'Show: waiting on me, open, completed, cancelled, drafts or all. Type a lot number to see where your lot is across all tools.',
        'Click a request ID for its page; a draft opens in the form. Drafts untouched for 30 days are marked "30+ days" - submit or delete them.'
      ],
      link: ['Open My requests', '#/requests'] },

    { id: 'board', title: 'The board', icon: 'board',
      intro: 'Every open request at a glance: one lane per tool, one column per status.',
      steps: [
        'Columns: Submitted, Accepted, In progress, Waiting (on hold or a question to the engineer), Completed in the last 7 days.',
        'Cards: request ID, priority, lot and panels, the countdown and who has it. An open Line stop pulses red.',
        'Click a card: a side panel opens with the full traveller and the buttons you may use (Accept, Start, Hold, Complete ...), with the same small dialogs as the request page. Ctrl+click opens the full page. Tools with nothing on them fold to one line; the bar on each card shows how much time is left until Needed by.',
        'Everyone else reads the board. Click a card for the full request; every action is also a button there.'
      ],
      tips: ['"Only my tools" shows just the lanes you work.'],
      link: ['Open the board', '#/board'] },

    { id: 'queue', title: 'My queue (quality engineers)', icon: 'inbox',
      intro: 'The open requests of the tools where you are the primary or backup quality engineer - your start page.',
      steps: [
        'Order: Line stop always on top, then late requests (red, most overdue first), then by needed-by date; requests without a date come last, by priority.',
        'Requests assigned to you come first; "Others of your tools" below. Take it moves one to you.',
        'Each row has one-click Accept / Start / Complete / Resume / Panels received and Copy BKM path. Click the request ID for the full page.',
        'Tick several rows for Accept all or Start all.',
        'Filter by tool or status (Waiting = on hold or needs clarification).'
      ],
      link: ['Open My queue', '#/queue'] },

    { id: 'working', title: 'Quality engineers: working a request', icon: 'activity',
      intro: 'The buttons under the traveller card show what you may do now. Only the tool\'s primary and backup quality engineers (and admins) see them.',
      steps: [
        'Accept - optionally with an "expected done" date; the engineer sees it.',
        'Panels received - who, when and where they are kept in the lab. Start asks for it once if you have not clicked it yet.',
        'Start - the request is In progress; the tool drawing on the card comes alive.',
        'Hold - pick why (Settings > Lists > On-hold reasons) and add a note; the clock pauses. Resume brings it back to where it was.',
        'Needs clarification - say what is missing; it goes back to the engineer. When they click Answered it returns to where it was.',
        'Complete - the results folder is proposed from the tool\'s results root (change it if needed); say what happened to the panels (FIB: scrapped).',
        'Take it - the backup takes over a request assigned to the primary. New requests go to the backup when the primary is away.'
      ],
      tips: ['The engineer then clicks Results OK or Reopen (with a reason). A completed request closes by itself after 7 days.'] },

    { id: 'bell', title: 'Notifications (the bell)', icon: 'bell',
      intro: 'The bell at the top shows what is new for you - a red number counts the unread ones.',
      steps: [
        'Engineers hear about their requests: accepted, started, a question, completed, comments, changes.',
        'Quality engineers hear about their tools: new requests, changes, answers, reopened or cancelled requests, comments, and requests assigned to them.',
        'Anyone written as @Name in a comment hears about it. Admins hear about people who added themselves.',
        'Click a line to open the request. "Mark all as read" clears the number (kept on this PC).',
        '"Turn on pop-ups" shows new things as a Windows pop-up while the app is open.',
        'After Submit, a question, Complete or Cancel, the green message offers "Email ..." - a ready Outlook draft to the other side. Check it and press Send.'
      ],
      tips: ['When someone else saves, the app loads their change by itself - unless you are in the middle of something; then a banner asks.'] },

    { id: 'magazines', title: 'Magazines', icon: 'grid',
      intro: 'A PCB magazine (M70345 ...) holds 24 panels, one per slot, numbered from the top - the magazines that feed the Hirata loader.',
      steps: [
        'New request, step 3: pick the magazine, then the slots the panels sit in - click, or press and drag over several. Slot order = panel order: the first slot gets the first Hirata ID.',
        'Slots of other open requests show greyed out with their request ID and cannot be picked. When a request is completed or cancelled its slots are free again.',
        'The request page and the slip show the magazine with the picked slots ("M70345 · slots 3-5").',
        'Complete (quality engineer): say where the panels go back - the same magazine and slots, or another. Scrapped panels (FIB) are marked on the lot and cannot be requested again.',
        'Admins keep the list in Settings > Lists > Magazines (number, slots, active); "in use now" shows how many slots open requests hold.'
      ],
      link: ['New request', '#/new'] },

    { id: 'templates', title: 'Request templates', icon: 'requests',
      intro: 'For requests you make again and again: keep what stays the same, add only the lot, panels, place and date.',
      steps: [
        'On one of your requests (or the form\'s last step), click "Save as template" and give it a name.',
        'New request: pick it under "Start from a template". Tool, type, BKM, project, part number, build-up, layers, afterwards, priority, purpose and extra fields are filled in.',
        'My requests > filter "My templates": use, rename or delete your templates. Only you see them.'
      ],
      tips: ['If something a template uses was hidden since (a BKM, a type ...), that part stays empty with a note - pick it again.',
             'A template whose tool is out of use cannot be started, only deleted.'],
      link: ['New request', '#/new'] },

    { id: 'analytics', title: 'Analytics', icon: 'analytics',
      intro: 'Numbers about the lab, in lab time (lab days and hours, holidays out). Click any number, bar or row to see the requests behind it - with Download.',
      steps: [
        'Pick the range (default: the last 90 days), a tool or a project at the top; "Last 90 days" resets.',
        'My work (quality engineers): your tools\' open requests, late, due today, on hold and why, what waits on you, what you finished per day.',
        'My requests (engineers): your open requests with the expected finish, "Where is my lot" (every request of a lot on every tool), and the typical turnaround per tool.',
        'Lab and Management (Manager role only): backlog per week, turnaround median and p90 with hold time apart, on time, load per quality engineer, clarification and reopen rates, on-hold reasons, requests per month by project, Line stop response, demand per tool.',
        'Every chart and table has Download: an Excel file (or CSV). Charts open full screen with the button at the top right.'
      ],
      tips: ['Turnaround = submitted to completed, in lab hours, with the time On hold taken out.', 'On time = completed by the end of the needed-by lab day. Requests without a date are not counted.',
             'Capacity per tool is not set yet, so Management shows demand only.'],
      link: ['Open Analytics', '#/analytics'] },

    { id: 'hirata', title: 'Hirata tools (panel codes)', icon: 'hirata',
      intro: 'Every panel carries a Hirata code: a pattern of drilled dots. Hirata tools reads it and draws it - nothing is saved.',
      steps: [
        'Menu > Hirata tools > Read a panel: tap the dots you see on the panel (or type the digits). You get the 9 digits and each field: Supplier, Year, Week, Day, Lot per day, Panel.',
        'Each column is one digit: add the weights of its dots, 8 + 4 + 2 + 1. No digit is above 9 - such a dot is locked. The bottom dot is always there; the first column (all five dots) shows which way round the code is.',
        'Find a pattern: type the last 4 digits (lot per day + panel) or the full 9 - several at once - and see each as the copper panel it is drilled into. Print them to hold against the real panels.',
        'In a request, each Hirata ID you type shows its copper panel right next to it; the request page and the printed slip show every panel with its decoded fields.'
      ],
      tips: ['A panel ID is the full 9-digit code when you know it, usually its last 4 digits.', 'The code layout is fixed: Supplier 1, Year 1, Week 2, Day 1, Lot per day 2, Panel 2.'],
      link: ['Open Hirata tools', '#/hirata'] },

    { id: 'away', title: 'Away (vacation, sick leave)', icon: 'calendar',
      intro: 'Tell the lab when you are not there, so people know who covers your tools.',
      steps: [
        'Click your name (top right) > I\'m away... Pick the first day, and the last day if you know it. Empty = until further notice.',
        'A note is optional, e.g. "Tom covers FIB". Never write why you are away - no reason is needed or stored.',
        'While you are away, Lab status shows "Away" next to your name. Settings > Health warns when a tool\'s primary and backup are both away.',
        'Back early? Your name > Away ... - change > I\'m back.'
      ],
      tips: ['An admin can set or clear Away for anyone in Settings > People (the calendar button).',
             'From M3 new requests for your tools go to the backup while you are away.'] },

    { id: 'saving', title: 'Saving, Undo and "someone else saved"', icon: 'save',
      steps: [
        'Each change is written to the data file at once, and recorded in the audit log.',
        'Before saving, the app checks nobody else saved in the meantime. If someone did, it stops and offers Reload - it never overwrites their work.',
        'If a save fails (the share is offline or read-only), the lamp turns red and a message offers Retry and Download as file. Nothing is lost.',
        'The first change of each day copies the file into data\\' + cfg.backup_dir + '\\ first; the last ' + cfg.backup_keep + ' days are kept.'
      ] },

    { id: 'admin-setup', title: 'Admin: setting up the office', icon: 'check', admin: true,
      intro: 'What to do before real use. Settings > Health lists what is still open - live - and each line goes away once done.',
      steps: [
        'Put the tool folder on the share with an empty folder "data" next to index.html. Everyone who uses the app needs write access to "data".',
        'Open the app with Metrology Tool.cmd and pick "data". The first person sets their name and the admin PIN and becomes Admin.',
        'Settings > People: tick "Quality engineer" for the people who measure. Add a second admin for when you are away.',
        'Settings > Tools: per tool set the primary and backup quality engineer and the results root folder.',
        'Replace the sample measurement types and BKMs (marked "Sample") with the real ones - edit, hide or delete. Saving a sample unchanged confirms it as real.',
        'Add the real extra fields per tool when the engineers name them.',
        'Settings > Lab calendar: confirm the lab days and hours ("These are right"), and add company closing days such as 24 and 31 December.',
        'Check Settings > Health: "Still to do" should be empty.'
      ],
      tips: [
        'The same list is in OFFICE_SETUP.md in the app folder.',
        'New data files start from js/seed.js. Put real lists there too, so a fresh start never shows sample data again.'
      ],
      link: ['Open Settings > Health', '#/settings/health'] },

    { id: 'admin-people', title: 'Admin: people and roles', icon: 'user', admin: true,
      intro: 'Settings is for admins and asks for the admin PIN once per visit.',
      steps: [
        'Settings > People > Add person: name, Windows user name (lowercase, no domain), optional domain and email, roles.',
        'People who added themselves show "New". Check their roles, then click Reviewed.',
        'People are never deleted. Untick Active to switch someone off; their name stays in the history.',
        'Away: the calendar button on a row sets or clears someone\'s away dates (e.g. when they are off sick and cannot do it themselves).',
        'At least one active admin must remain.'
      ],
      link: ['Open Settings > People', '#/settings/users'] },

    { id: 'admin-tools', title: 'Admin: tools, measurement types, fields, BKMs', icon: 'wrench', admin: true,
      steps: [
        'Settings > Tools > Add tool: code (1-6 capitals - it starts every request ID, e.g. FIB-260924-03), name, drawing, quality engineers, results root.',
        'Pick a tool under the list to set up its measurement types, extra fields and BKMs.',
        'Extra fields: 8 kinds - short text, long text, number (unit, min, max), one choice, several choices, yes/no, date, share path. "Only for" limits a field to some measurement types.',
        'BKMs: name, measurement type (or any), share path, version. The Copy button copies the path.',
        'Destructive (tick in the tool\'s Edit): measuring destroys the panels, like FIB. Requests on that tool must confirm the panels may be scrapped.',
        'An entry that is used cannot be deleted - hide it instead (untick Active). Renaming is always safe: everything refers to it by ID.'
      ],
      link: ['Open Settings > Tools', '#/settings/tools'] },

    { id: 'admin-lists', title: 'Admin: lists and lab calendar', icon: 'calendar', admin: true,
      steps: [
        'Settings > Lists: projects and build-ups (codes in capitals; a build-up can set its number of layers - empty means the number in the code, BU-04 = up to 5F / 5B) and priorities (Line stop, Hot, Normal, Low - renamable, one default, some need a reason).',
        'Part numbers (Settings > Lists): each one is stored once and linked to one or more projects - tick them. A project with part numbers cannot be deleted; hide it instead.',
        'Process steps (Settings > Lists): the steps of the line in order, e.g. After desmear. A request says which step its panels are at; engineers can still type another one.',
        'Settings > Lots: the same list as the Lots page. "Add several lots" registers a batch (e.g. 18178-18180) with the same panel count, note and lot fields; the person button gives a lot to another owner; any unused lot can be deleted with a reason.',
        'Lot fields (Settings > Lists): what every lot holds beyond the core fields - add, rename, hide, make required. Same 8 kinds as a tool\'s extra fields. The first seven are samples to shape with the team.',
        'Settings > Lab calendar: lab days and hours (Europe/Vienna). Turnaround and lateness count only these hours.',
        'Public holidays: the Austrian ones are filled in by rule; the button adds the next year. Add company closing days yourself.'
      ],
      link: ['Open Settings > Lab calendar', '#/settings/calendar'] },

    { id: 'admin-data', title: 'Admin: backups, restore, audit log, PIN', icon: 'archive', admin: true,
      steps: [
        'Settings > Data & PIN > Try it out: "Add 3 sample lots" adds made-up lots (tagged Sample) to try the app. Delete them on the Lots page before real use.',
        'Settings > Data & PIN shows the data file, lets you download a copy now, and lists the daily backups.',
        'Test data (Settings > Data & PIN): "Fill with demo data" puts the made-up demo (17 people, ~260 requests) into this folder - you become its Prince Khurana (admin) with your own Windows ID and keep your PIN. "Start empty" starts again like a first run with only you. Both keep the current file in the backups first; restore it from the Backups list ("before demo data").',
        'Restore puts everything back to that day for everyone. The current file is kept as a safety copy first, and the audit log keeps every entry. A reason is required.',
        'Settings > Audit log: every change - who, when, what, old and new value, reason. Type in Filter to search.',
        'Change the admin PIN under Data & PIN. Tell the other admins.',
        'Wrong data folder? Your name (top right) > Change data folder.',
        'Download the request history (Data & PIN): every request with all its status times, and every timeline event - an Excel workbook (CSV without the Excel library).'
      ],
      link: ['Open Settings > Data & PIN', '#/settings/data'] },

    { id: 'update', title: 'Updating the app', icon: 'download', admin: true,
      intro: 'Only program files are replaced. The folder "data" is never touched.',
      steps: [
        'Ask everyone to close the app.',
        'Copy the "data" folder somewhere safe, just in case.',
        'Copy the new program files over the old ones: index.html, Metrology Tool.cmd, css, js, vendor.',
        'Never copy a "data" folder from a new version, and never delete the existing one.',
        'Open the app. If the new version needs a newer data format, it upgrades the file itself and keeps a copy of the old one in data\\' + cfg.backup_dir + '\\.'
      ] },

    { id: 'keys', title: 'Keyboard shortcuts', icon: 'keyboard',
      steps: [
        '/ search tools, people and BKMs.  ? the list of shortcuts.',
        'g then l, s, h: go to Lab status, Settings, Help. More pages get their letter as they arrive.',
        '[ collapse the side menu.  Ctrl+Z undo.  Esc close a dialog or menu.'
      ] },

    { id: 'trouble', title: 'Troubleshooting', icon: 'alert',
      steps: [
        '"This browser is not supported": use Edge or Chrome - Metrology Tool.cmd opens Edge.',
        'It asks for the data folder every time: the browser forgot it, or the app was opened from another path. Pick "data" again.',
        '"Data was changed by ... Reload?": someone else saved. Reload takes their version.',
        'Nothing saves: the share may be offline or read-only. Use Download as file in the red message and keep the file.',
        'Something looks wrong in the data: Settings > Health lists broken links and odd states, each with a link to fix it.'
      ] },

    { id: 'coming', title: 'What comes next', icon: 'activity',
      steps: [
        'Done: M1 (shell, Settings, Help), M2 (lots, the request form, the request page), M3 (the workflow, My queue, My requests, the board) and M4 (notifications: the bell, pop-ups, Outlook drafts).',
        'M5: Analytics and exports (Excel). Next: M6 - import of the old request list. Later: attaching decoded Hirata panels to a lot.'
      ] }
  ];

  function render(main, ctx) {
    var search = ui.el('input', { type: 'search', class: 'input help-search', placeholder: 'Search the help…', 'aria-label': 'Search the help' });
    main.appendChild(ui.pageHead('Help', 'How to use the app, step by step', ui.el('div', { class: 'head-actions' }, [
      search, ui.button('Print / PDF', { icon: 'download', onClick: function () { window.print(); } })
    ])));

    var toc = ui.el('nav', { class: 'help-toc', 'aria-label': 'Help topics' }, GUIDES.map(function (g) {
      return ui.el('a', { href: '#/help/' + g.id, dataset: { id: g.id }, class: g.admin ? 'is-admin' : null },
                   [ui.icon(g.icon, 15), ui.el('span', { text: g.title })]);
    }));
    var sections = GUIDES.map(guide);
    var none = ui.el('p', { class: 'muted', hidden: true, text: 'Nothing found. Try another word.' });
    main.appendChild(ui.el('div', { class: 'help-layout' }, [toc, ui.el('div', { class: 'help-body' }, sections.concat([none]))]));

    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      var shown = 0;
      sections.forEach(function (sec, i) {
        var hit = !q || sec.textContent.toLowerCase().indexOf(q) !== -1;
        sec.hidden = !hit;
        toc.children[i].hidden = !hit;
        if (hit) shown++;
      });
      none.hidden = shown > 0;
    });

    if (ctx && ctx.subpath) {
      var target = main.querySelector('#help-' + ctx.subpath);
      if (target) {
        target.classList.add('is-selected');
        requestAnimationFrame(function () { target.scrollIntoView({ block: 'start' }); });
      }
    }
  }

  function guide(g) {
    return ui.el('section', { class: 'panel help-guide', id: 'help-' + g.id, 'aria-labelledby': 'help-h-' + g.id }, [
      ui.el('div', { class: 'panel-head' }, [
        ui.el('span', { class: 'panel-icon' }, ui.icon(g.icon, 16)),
        ui.el('h2', { class: 'panel-title', id: 'help-h-' + g.id, text: g.title }),
        g.admin ? ui.el('span', { class: 'chip accent-chip help-admin', text: 'Admin' }) : null
      ]),
      ui.el('div', { class: 'panel-body' }, [
        g.intro ? ui.el('p', { class: 'help-intro', text: g.intro }) : null,
        g.extra ? g.extra() : null,
        ui.el('ol', { class: 'help-steps' }, g.steps.map(function (t) { return ui.el('li', { text: t }); })),
        g.tips && g.tips.length ? ui.el('ul', { class: 'help-tips' }, g.tips.map(function (t) {
          return ui.el('li', {}, [ui.icon('info', 14), ui.el('span', { text: t })]);
        })) : null,
        g.link ? ui.el('a', { class: 'btn btn-sm help-open', href: g.link[1] }, [g.link[0], ui.icon('chevron_right', 14)]) : null
      ])
    ]);
  }

  return { render: render, GUIDES: GUIDES };
})();
