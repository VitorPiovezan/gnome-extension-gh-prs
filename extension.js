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
    actions: 'Actions',
    none: 'Nenhuma',
    loading: 'Carregando...',
    noRepos: 'Configure repos nas preferencias',
    noRuns: 'Nenhum run recente',
  },
  'en': {
    opened: 'Opened by me',
    review: 'Pending review',
    actions: 'Actions',
    none: 'None',
    loading: 'Loading...',
    noRepos: 'Set up repos in preferences',
    noRuns: 'No recent runs',
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

function getStatusColor(run) {
  if (run.status === 'in_progress') return '#e8a817';
  if (run.status === 'queued' || run.status === 'waiting' || run.status === 'pending' || run.status === 'requested') return '#9e9e9e';
  if (run.status === 'completed') {
    if (run.conclusion === 'success') return '#3fb950';
    if (run.conclusion === 'failure' || run.conclusion === 'timed_out' || run.conclusion === 'startup_failure') return '#f85149';
    return '#9e9e9e';
  }
  return '#9e9e9e';
}

const GhPrIndicator = GObject.registerClass(
  class GhPrIndicator extends PanelMenu.Button {
    _init(settings) {
      super._init(0.0, 'GitHub PRs');
      this._settings = settings;
      this._cachedMyPrs = [];
      this._cachedReviewPrs = [];
      this._cachedActions = [];
      this._hasCache = false;
      this._fetchId = 0;
      this._ghUsername = null;
      this._usernameLoaded = false;
      this._signalIds = [];

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
      this._applyMenuWidth();

      this._menuOpenId = this.menu.connect('open-state-changed', (_menu, isOpen) => {
        if (isOpen) this._onMenuOpen();
      });

      this._signalIds.push(
        this._settings.connect('changed::menu-width', () => this._applyMenuWidth()),
      );
    }

    _applyMenuWidth() {
      const width = this._settings.get_int('menu-width');
      this.menu.box.style = `width: ${width}px;`;
    }

    destroy() {
      if (this._menuOpenId) {
        this.menu.disconnect(this._menuOpenId);
        this._menuOpenId = null;
      }
      this._signalIds.forEach(id => this._settings.disconnect(id));
      this._signalIds = [];
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
      const maxChar = Math.floor(this._settings.get_int('menu-width') / 7.5);
      let repo = '';
      if (pr.repository && pr.repository.nameWithOwner) repo = pr.repository.nameWithOwner + '#';
      else if (pr.headRepository && pr.headRepository.nameWithOwner) repo = pr.headRepository.nameWithOwner + '#';
      const label = (repo ? repo + pr.number + ' ' : '') + (pr.title || '').trim() || '#' + pr.number;
      const short = label.length > maxChar ? label.substring(0, maxChar - 3) + '...' : label;
      const item = new PopupMenu.PopupMenuItem(short, { reactive: true });
      item._url = pr.url;
      item.connect('activate', () => {
        if (item._url) Gio.AppInfo.launch_default_for_uri(item._url, null);
      });
      this.menu.addMenuItem(item);
      this._dynamicItems.push(item);
    }

    _addActionRow(run) {
      const item = new PopupMenu.PopupBaseMenuItem({ reactive: true });
      const box = new St.BoxLayout({ vertical: true, x_expand: true });

      const titleBox = new St.BoxLayout({ vertical: false });
      const dot = new St.Label({ text: '\u25CF ' });
      dot.set_style(`color: ${getStatusColor(run)};`);
      titleBox.add_child(dot);

      const maxChar = Math.floor(this._settings.get_int('menu-width') / 7.5);
      const titleText = (run.displayTitle || '').trim();
      const shortTitle = titleText.length > maxChar - 4
        ? titleText.substring(0, maxChar - 7) + '...'
        : titleText;
      titleBox.add_child(new St.Label({ text: shortTitle, x_expand: true }));
      box.add_child(titleBox);

      const sub = `${run.repo} \u2022 ${run.workflowName}`;
      const subLabel = new St.Label({ text: sub });
      subLabel.set_style('font-size: 0.85em; color: #888; padding-left: 14px;');
      box.add_child(subLabel);

      item.add_child(box);
      item.connect('activate', () => {
        if (run.url) Gio.AppInfo.launch_default_for_uri(run.url, null);
      });
      this.menu.addMenuItem(item);
      this._dynamicItems.push(item);
    }

    _renderData(myPrs, reviewPrs, actions) {
      this._clearDynamic();
      const showMy = this._settings.get_boolean('show-my-prs');
      const showReview = this._settings.get_boolean('show-review-prs');
      const showActions = this._settings.get_boolean('show-actions');
      let hasPrev = false;

      if (showMy) {
        this._addSection(t.opened);
        if (myPrs.length === 0) {
          const none = new PopupMenu.PopupMenuItem(t.none, { reactive: false });
          this.menu.addMenuItem(none);
          this._dynamicItems.push(none);
        } else {
          myPrs.forEach(pr => this._addPrRow(pr));
        }
        hasPrev = true;
      }

      if (showReview) {
        if (hasPrev) {
          const sep = new PopupMenu.PopupSeparatorMenuItem();
          this.menu.addMenuItem(sep);
          this._dynamicItems.push(sep);
        }
        this._addSection(t.review);
        if (reviewPrs.length === 0) {
          const none = new PopupMenu.PopupMenuItem(t.none, { reactive: false });
          this.menu.addMenuItem(none);
          this._dynamicItems.push(none);
        } else {
          reviewPrs.forEach(pr => this._addPrRow(pr));
        }
        hasPrev = true;
      }

      if (showActions) {
        if (hasPrev) {
          const sep = new PopupMenu.PopupSeparatorMenuItem();
          this.menu.addMenuItem(sep);
          this._dynamicItems.push(sep);
        }
        this._addSection(t.actions);
        const repos = this._settings.get_string('actions-repos').trim();
        if (!repos) {
          const none = new PopupMenu.PopupMenuItem(t.noRepos, { reactive: false });
          this.menu.addMenuItem(none);
          this._dynamicItems.push(none);
        } else if (actions.length === 0) {
          const none = new PopupMenu.PopupMenuItem(t.noRuns, { reactive: false });
          this.menu.addMenuItem(none);
          this._dynamicItems.push(none);
        } else {
          actions.forEach(run => this._addActionRow(run));
        }
      }

      if (!showMy && !showReview && !showActions) {
        this._addSection(t.none);
      }
    }

    _onMenuOpen() {
      this._applyMenuWidth();
      if (this._hasCache) {
        this._renderData(this._cachedMyPrs, this._cachedReviewPrs, this._cachedActions);
      } else {
        this._clearDynamic();
        this._addSection(t.loading);
      }
      this._fetchInBackground();
    }

    _ensureUsername(callback) {
      if (this._usernameLoaded) {
        callback(this._ghUsername);
        return;
      }
      const ghPath = this._settings.get_string('gh-path');
      runGhAsync(ghPath, ['api', 'user', '--jq', '.login'], (stdout) => {
        if (stdout && stdout.trim()) this._ghUsername = stdout.trim();
        this._usernameLoaded = true;
        callback(this._ghUsername);
      });
    }

    _fetchInBackground() {
      this._fetchId++;
      const currentFetch = this._fetchId;
      const ghPath = this._settings.get_string('gh-path');
      const limit = this._settings.get_int('max-items').toString();
      const showMy = this._settings.get_boolean('show-my-prs');
      const showReview = this._settings.get_boolean('show-review-prs');
      const showActions = this._settings.get_boolean('show-actions');

      let myPrs = showMy ? null : [];
      let reviewPrs = showReview ? null : [];
      let actions = showActions ? null : [];

      const tryUpdate = () => {
        if (myPrs === null || reviewPrs === null || actions === null) return;
        if (currentFetch !== this._fetchId) return;

        this._cachedMyPrs = myPrs;
        this._cachedReviewPrs = reviewPrs;
        this._cachedActions = actions;
        this._hasCache = true;

        if (this.menu.isOpen) {
          this._renderData(myPrs, reviewPrs, actions);
        }
      };

      if (showMy) {
        runGhAsync(ghPath, ['search', 'prs', '--author=@me', '--state=open', '--json', 'number,title,url,repository', '--limit', limit], (stdout) => {
          myPrs = parseJson(stdout);
          tryUpdate();
        });
      }

      if (showReview) {
        runGhAsync(ghPath, ['search', 'prs', '--review-requested=@me', '--state=open', '--json', 'number,title,url,repository', '--limit', limit], (stdout) => {
          reviewPrs = parseJson(stdout);
          tryUpdate();
        });
      }

      if (showActions) {
        this._fetchActions(currentFetch, (runs) => {
          actions = runs;
          tryUpdate();
        });
      }

      if (!showMy && !showReview && !showActions) {
        tryUpdate();
      }
    }

    _fetchActions(currentFetch, callback) {
      const repos = this._settings.get_string('actions-repos')
        .split(',').map(r => r.trim()).filter(r => r.length > 0);

      if (repos.length === 0) {
        callback([]);
        return;
      }

      const ghPath = this._settings.get_string('gh-path');
      const hoursAgo = this._settings.get_int('actions-hours-ago');
      const cutoff = new Date(Date.now() - hoursAgo * 3600 * 1000);
      const limit = this._settings.get_int('max-items').toString();

      let workflowConfig;
      try {
        workflowConfig = JSON.parse(this._settings.get_string('actions-workflows') || '{}');
      } catch (_) {
        workflowConfig = {};
      }

      this._ensureUsername((username) => {
        if (currentFetch !== this._fetchId) return;

        let pending = repos.length;
        let allRuns = [];

        repos.forEach(repo => {
          const args = [
            'run', 'list', '-R', repo,
            '--json', 'status,conclusion,displayTitle,createdAt,url,workflowName',
            '--limit', limit,
          ];
          if (username) args.push('--user', username);

          runGhAsync(ghPath, args, (stdout) => {
            const runs = parseJson(stdout);
            const filtered = runs
              .filter(r => new Date(r.createdAt) >= cutoff)
              .filter(r => {
                const repoWf = workflowConfig[repo];
                if (!repoWf || Object.keys(repoWf).length === 0) return true;
                if (repoWf[r.workflowName] === undefined) return true;
                return repoWf[r.workflowName];
              })
              .map(r => ({ ...r, repo }));

            allRuns = allRuns.concat(filtered);
            pending--;

            if (pending === 0) {
              allRuns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
              callback(allRuns);
            }
          });
        });
      });
    }
  }
);

let _indicator = null;

export default class GhPrIndicatorExtension extends Extension {
  enable() {
    const settings = this.getSettings();
    _indicator = new GhPrIndicator(settings);
    Main.panel.addToStatusArea(this.uuid, _indicator, 0, 'right');
  }

  disable() {
    if (_indicator) {
      _indicator.destroy();
      _indicator = null;
    }
  }
}
