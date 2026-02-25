import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

Gio._promisify(Gio.Subprocess.prototype, 'communicate_utf8_async');
Gio._promisify(Gio.Subprocess.prototype, 'wait_async');

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

function runGh(ghPath, args) {
  const argv = [ghPath, ...args];
  const launcher = new Gio.SubprocessLauncher({
    flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
  });
  launcher.set_environ(GLib.get_environ());
  try {
    const proc = launcher.spawnv(argv);
    return proc.communicate_utf8_async(null, null);
  } catch (e) {
    return Promise.resolve([null, e.message]);
  }
}

const GhPrIndicator = GObject.registerClass(
  class GhPrIndicator extends PanelMenu.Button {
    _init(config) {
      super._init(0.0, 'GitHub PRs');
      this._ghPath = config.ghPath;

      const icon = new St.Icon({
        icon_name: 'git-branch-symbolic',
        style_class: 'system-status-icon'
      });
      this.add_child(icon);

      this._header = new PopupMenu.PopupMenuItem('GitHub PRs', { reactive: false });
      this.menu.addMenuItem(this._header);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      this._dynamicItems = [];
    }

    _clearDynamic() {
      this._dynamicItems.forEach(item => this.menu.removeMenuItem(item));
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

    _fetchMyPRs() {
      return runGh(this._ghPath, ['pr', 'list', '--author', '@me', '--state', 'open', '--json', 'number,title,url,headRepository', '--limit', '50']).then(([stdout]) => {
        if (!stdout || !stdout.trim()) return [];
        try { return JSON.parse(stdout.trim()); } catch (_) { return []; }
      });
    }

    _fetchReviewRequested() {
      return runGh(this._ghPath, ['search', 'prs', '--review-requested=@me', '--state=open', '--json', 'number,title,url,repository', '--limit', '50']).then(([stdout]) => {
        if (!stdout || !stdout.trim()) return [];
        try { return JSON.parse(stdout.trim()); } catch (_) { return []; }
      });
    }

    _loadPrs() {
      this._clearDynamic();
      this._addSection('Carregando...');

      Promise.all([this._fetchMyPRs(), this._fetchReviewRequested()]).then(([myPrs, reviewPrs]) => {
        this._clearDynamic();

        this._addSection('Abertas por mim');
        if (myPrs.length === 0) {
          const none = new PopupMenu.PopupMenuItem('Nenhuma', { reactive: false });
          this.menu.addMenuItem(none);
          this._dynamicItems.push(none);
        } else {
          myPrs.forEach(pr => this._addPrRow(pr));
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._addSection('Pendentes de revisao');
        if (reviewPrs.length === 0) {
          const none = new PopupMenu.PopupMenuItem('Nenhuma', { reactive: false });
          this.menu.addMenuItem(none);
          this._dynamicItems.push(none);
        } else {
          reviewPrs.forEach(pr => this._addPrRow(pr));
        }
      }).catch(() => {
        this._clearDynamic();
        this._addSection('Erro ao carregar (gh auth?)');
      });
    }

    open(animate) {
      this._loadPrs();
      super.open(animate);
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
