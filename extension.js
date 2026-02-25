import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

const I18N = {
  'pt': {
    opened: 'Abertas por mim',
    review: 'Pendentes de revisao',
    none: 'Nenhuma',
    loading: 'Carregando...',
    error: 'Erro ao carregar (gh auth?)',
  },
  'en': {
    opened: 'Opened by me',
    review: 'Pending review',
    none: 'None',
    loading: 'Loading...',
    error: 'Failed to load (gh auth?)',
  },
};

function getLocale() {
  const langs = GLib.get_language_names();
  for (const lang of langs) {
    if (lang.startsWith('pt')) return 'pt';
  }
  return 'en';
}

const t = I18N[getLocale()] || I18N['en'];

function loadConfig(extensionPath) {
  const path = extensionPath + '/config.json';
  const file = Gio.File.new_for_path(path);
  if (!file.query_exists(null)) return { ghPath: '/usr/bin/gh' };
  const [, data] = file.load_contents(null);
  try {
    const o = JSON.parse(new TextDecoder().decode(data));
    return { ghPath: (o['gh-path'] || o.ghPath || '/usr/bin/gh').trim() };
  } catch (_) {
    return { ghPath: '/usr/bin/gh' };
  }
}

function runGhAsync(ghPath, args, callback) {
  const argv = [ghPath, ...args];
  try {
    const proc = Gio.Subprocess.new(
      argv,
      Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    );
    proc.communicate_utf8_async(null, null, (_proc, res) => {
      try {
        const [, stdout, stderr] = _proc.communicate_utf8_finish(res);
        callback(stdout, stderr);
      } catch (e) {
        callback(null, e.message);
      }
    });
  } catch (e) {
    callback(null, e.message);
  }
}

function parseJson(stdout) {
  if (!stdout || !stdout.trim()) return [];
  try { return JSON.parse(stdout.trim()); } catch (_) { return []; }
}

const GhPrIndicator = GObject.registerClass(
  class GhPrIndicator extends PanelMenu.Button {
    _init(config) {
      super._init(0.0, 'GitHub PRs');
      this._ghPath = config.ghPath;
      this._cachedMyPrs = [];
      this._cachedReviewPrs = [];
      this._hasCache = false;
      this._fetchId = 0;

      this.style = 'padding: 0 4px;';

      const icon = new St.Icon({
        icon_name: 'git-branch-symbolic',
        style_class: 'system-status-icon'
      });
      this.add_child(icon);

      this._header = new PopupMenu.PopupMenuItem('GitHub PRs', { reactive: false });
      this.menu.addMenuItem(this._header);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._dynamicItems = [];

      this._menuOpenId = this.menu.connect('open-state-changed', (_menu, isOpen) => {
        if (isOpen) this._onMenuOpen();
      });
    }

    destroy() {
      if (this._menuOpenId) {
        this.menu.disconnect(this._menuOpenId);
        this._menuOpenId = null;
      }
      super.destroy();
    }

    _clearDynamic() {
      this._dynamicItems.forEach(item => item.destroy());
      this._dynamicItems = [];
    }

    _addSection(title) {
      const item = new PopupMenu.PopupMenuItem(title, { reactive: false });
      item.label.add_style_class_name('gh-pr-section');
      this.menu.addMenuItem(item);
      this._dynamicItems.push(item);
    }

    _addPrRow(pr) {
      let repo = '';
      if (pr.repository && pr.repository.nameWithOwner) repo = pr.repository.nameWithOwner + '#';
      else if (pr.headRepository && pr.headRepository.nameWithOwner) repo = pr.headRepository.nameWithOwner + '#';
      const label = (repo ? repo + pr.number + ' ' : '') + (pr.title || '').trim() || '#' + pr.number;
      const short = label.length > 58 ? label.substring(0, 55) + '...' : label;
      const item = new PopupMenu.PopupMenuItem(short, { reactive: true });
      item._url = pr.url;
      item.connect('activate', () => {
        if (item._url) Gio.AppInfo.launch_default_for_uri(item._url, null);
      });
      this.menu.addMenuItem(item);
      this._dynamicItems.push(item);
    }

    _renderData(myPrs, reviewPrs) {
      this._clearDynamic();

      this._addSection(t.opened);
      if (myPrs.length === 0) {
        const none = new PopupMenu.PopupMenuItem(t.none, { reactive: false });
        this.menu.addMenuItem(none);
        this._dynamicItems.push(none);
      } else {
        myPrs.forEach(pr => this._addPrRow(pr));
      }

      const sep = new PopupMenu.PopupSeparatorMenuItem();
      this.menu.addMenuItem(sep);
      this._dynamicItems.push(sep);

      this._addSection(t.review);
      if (reviewPrs.length === 0) {
        const none = new PopupMenu.PopupMenuItem(t.none, { reactive: false });
        this.menu.addMenuItem(none);
        this._dynamicItems.push(none);
      } else {
        reviewPrs.forEach(pr => this._addPrRow(pr));
      }
    }

    _onMenuOpen() {
      if (this._hasCache) {
        this._renderData(this._cachedMyPrs, this._cachedReviewPrs);
      } else {
        this._clearDynamic();
        this._addSection(t.loading);
      }

      this._fetchInBackground();
    }

    _fetchInBackground() {
      this._fetchId++;
      const currentFetch = this._fetchId;
      let myPrs = null;
      let reviewPrs = null;

      const tryUpdate = () => {
        if (myPrs === null || reviewPrs === null) return;
        if (currentFetch !== this._fetchId) return;

        this._cachedMyPrs = myPrs;
        this._cachedReviewPrs = reviewPrs;
        this._hasCache = true;

        if (this.menu.isOpen) {
          this._renderData(myPrs, reviewPrs);
        }
      };

      runGhAsync(this._ghPath, ['search', 'prs', '--author=@me', '--state=open', '--json', 'number,title,url,repository', '--limit', '50'], (stdout) => {
        myPrs = parseJson(stdout);
        tryUpdate();
      });

      runGhAsync(this._ghPath, ['search', 'prs', '--review-requested=@me', '--state=open', '--json', 'number,title,url,repository', '--limit', '50'], (stdout) => {
        reviewPrs = parseJson(stdout);
        tryUpdate();
      });
    }
  }
);

let _indicator = null;

export default class GhPrIndicatorExtension extends Extension {
  enable() {
    const config = loadConfig(this.path);
    _indicator = new GhPrIndicator(config);
    Main.panel.addToStatusArea(this.uuid, _indicator, 0, 'right');
  }

  disable() {
    if (_indicator) {
      _indicator.destroy();
      _indicator = null;
    }
  }
}
