import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const I18N = {
  'pt': {
    groupSections: 'Secoes',
    showMyPrs: 'Mostrar PRs abertas por mim',
    showMyPrsDesc: 'Exibir a secao de PRs que voce abriu',
    showReviewPrs: 'Mostrar PRs pendentes de revisao',
    showReviewPrsDesc: 'Exibir a secao de PRs aguardando sua revisao',
    groupAppearance: 'Aparencia',
    menuWidth: 'Largura do menu (px)',
    menuWidthDesc: 'Largura do popup em pixels',
    maxItems: 'Maximo de itens por secao',
    maxItemsDesc: 'Quantidade maxima de itens buscados em cada secao',
    groupAdvanced: 'Avancado',
    ghPath: 'Caminho do gh',
    ghPathDesc: 'Caminho absoluto para o binario do GitHub CLI',
    groupActions: 'GitHub Actions',
    showActions: 'Mostrar GitHub Actions',
    showActionsDesc: 'Exibir secao de workflow runs',
    actionsHours: 'Periodo (horas)',
    actionsHoursDesc: 'Mostrar runs das ultimas N horas',
    actionsRepos: 'Repositorios',
    actionsReposDesc: 'Separados por virgula (ex: org/repo1, org/repo2)',
    groupWorkflows: 'Filtro de Workflows',
    loadWorkflows: 'Carregar workflows disponiveis',
    noWorkflows: 'Adicione repos e clique em carregar',
    loadingWorkflows: 'Carregando...',
  },
  'en': {
    groupSections: 'Sections',
    showMyPrs: 'Show PRs opened by me',
    showMyPrsDesc: 'Display the section with PRs you authored',
    showReviewPrs: 'Show PRs pending review',
    showReviewPrsDesc: 'Display the section with PRs awaiting your review',
    groupAppearance: 'Appearance',
    menuWidth: 'Menu width (px)',
    menuWidthDesc: 'Width of the popup menu in pixels',
    maxItems: 'Max items per section',
    maxItemsDesc: 'Maximum items fetched per section',
    groupAdvanced: 'Advanced',
    ghPath: 'gh binary path',
    ghPathDesc: 'Absolute path to the GitHub CLI binary',
    groupActions: 'GitHub Actions',
    showActions: 'Show GitHub Actions',
    showActionsDesc: 'Display the workflow runs section',
    actionsHours: 'Time window (hours)',
    actionsHoursDesc: 'Show runs from the last N hours',
    actionsRepos: 'Repositories',
    actionsReposDesc: 'Comma-separated (e.g. org/repo1, org/repo2)',
    groupWorkflows: 'Workflow Filter',
    loadWorkflows: 'Load available workflows',
    noWorkflows: 'Add repos above and click load',
    loadingWorkflows: 'Loading...',
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

export default class GhPrPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    const page = new Adw.PreferencesPage({ title: 'GitHub PRs' });
    window.add(page);

    const sectionsGroup = new Adw.PreferencesGroup({ title: t.groupSections });
    page.add(sectionsGroup);

    const myPrsRow = new Adw.SwitchRow({
      title: t.showMyPrs,
      subtitle: t.showMyPrsDesc,
    });
    settings.bind('show-my-prs', myPrsRow, 'active', 0);
    sectionsGroup.add(myPrsRow);

    const reviewPrsRow = new Adw.SwitchRow({
      title: t.showReviewPrs,
      subtitle: t.showReviewPrsDesc,
    });
    settings.bind('show-review-prs', reviewPrsRow, 'active', 0);
    sectionsGroup.add(reviewPrsRow);

    const appearanceGroup = new Adw.PreferencesGroup({ title: t.groupAppearance });
    page.add(appearanceGroup);

    const widthRow = new Adw.SpinRow({
      title: t.menuWidth,
      subtitle: t.menuWidthDesc,
      adjustment: new Gtk.Adjustment({
        lower: 250, upper: 800, step_increment: 10, page_increment: 50,
        value: settings.get_int('menu-width'),
      }),
    });
    settings.bind('menu-width', widthRow, 'value', 0);
    appearanceGroup.add(widthRow);

    const maxItemsRow = new Adw.SpinRow({
      title: t.maxItems,
      subtitle: t.maxItemsDesc,
      adjustment: new Gtk.Adjustment({
        lower: 5, upper: 50, step_increment: 1, page_increment: 5,
        value: settings.get_int('max-items'),
      }),
    });
    settings.bind('max-items', maxItemsRow, 'value', 0);
    appearanceGroup.add(maxItemsRow);

    const advancedGroup = new Adw.PreferencesGroup({ title: t.groupAdvanced });
    page.add(advancedGroup);

    const ghPathRow = new Adw.EntryRow({ title: t.ghPath });
    ghPathRow.set_text(settings.get_string('gh-path'));
    ghPathRow.connect('changed', () => {
      settings.set_string('gh-path', ghPathRow.get_text());
    });
    advancedGroup.add(ghPathRow);

    const actionsGroup = new Adw.PreferencesGroup({ title: t.groupActions });
    page.add(actionsGroup);

    const showActionsRow = new Adw.SwitchRow({
      title: t.showActions,
      subtitle: t.showActionsDesc,
    });
    settings.bind('show-actions', showActionsRow, 'active', 0);
    actionsGroup.add(showActionsRow);

    const hoursRow = new Adw.SpinRow({
      title: t.actionsHours,
      subtitle: t.actionsHoursDesc,
      adjustment: new Gtk.Adjustment({
        lower: 1, upper: 72, step_increment: 1, page_increment: 4,
        value: settings.get_int('actions-hours-ago'),
      }),
    });
    settings.bind('actions-hours-ago', hoursRow, 'value', 0);
    actionsGroup.add(hoursRow);

    const reposRow = new Adw.EntryRow({
      title: t.actionsRepos,
    });
    reposRow.set_text(settings.get_string('actions-repos'));
    reposRow.connect('changed', () => {
      settings.set_string('actions-repos', reposRow.get_text());
    });
    actionsGroup.add(reposRow);

    const workflowGroup = new Adw.PreferencesGroup({ title: t.groupWorkflows });
    page.add(workflowGroup);

    let wfRows = [];

    const renderWorkflows = () => {
      wfRows.forEach(r => workflowGroup.remove(r));
      wfRows = [];

      let data;
      try { data = JSON.parse(settings.get_string('actions-workflows')); } catch (_) { data = {}; }

      const repos = Object.keys(data).sort();
      if (repos.length === 0) {
        const emptyRow = new Adw.ActionRow({ title: t.noWorkflows, sensitive: false });
        workflowGroup.add(emptyRow);
        wfRows.push(emptyRow);
        return;
      }

      for (const repo of repos) {
        const repoHeader = new Adw.ActionRow({ title: repo, sensitive: false });
        workflowGroup.add(repoHeader);
        wfRows.push(repoHeader);

        for (const wf of Object.keys(data[repo]).sort()) {
          const row = new Adw.SwitchRow({ title: wf, active: data[repo][wf] });
          row.connect('notify::active', () => {
            let current;
            try { current = JSON.parse(settings.get_string('actions-workflows')); } catch (_) { current = {}; }
            if (!current[repo]) current[repo] = {};
            current[repo][wf] = row.active;
            settings.set_string('actions-workflows', JSON.stringify(current));
          });
          workflowGroup.add(row);
          wfRows.push(row);
        }
      }
    };

    const loadWorkflows = () => {
      const ghPath = settings.get_string('gh-path');
      const repos = settings.get_string('actions-repos')
        .split(',').map(r => r.trim()).filter(r => r);

      if (repos.length === 0) return;

      wfRows.forEach(r => workflowGroup.remove(r));
      wfRows = [];
      const loadingRow = new Adw.ActionRow({ title: t.loadingWorkflows, sensitive: false });
      workflowGroup.add(loadingRow);
      wfRows.push(loadingRow);

      let existing;
      try { existing = JSON.parse(settings.get_string('actions-workflows')); } catch (_) { existing = {}; }

      let pending = repos.length;
      const result = {};

      repos.forEach(repo => {
        try {
          const proc = Gio.Subprocess.new(
            [ghPath, 'workflow', 'list', '-R', repo, '--json', 'name'],
            Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
          );
          proc.communicate_utf8_async(null, null, (_proc, res) => {
            try {
              const [, stdout] = _proc.communicate_utf8_finish(res);
              const workflows = JSON.parse(stdout.trim());
              result[repo] = {};
              workflows.forEach(w => {
                const prev = existing[repo] && existing[repo][w.name];
                result[repo][w.name] = prev !== undefined ? prev : true;
              });
            } catch (_) {}
            pending--;
            if (pending === 0) {
              settings.set_string('actions-workflows', JSON.stringify(result));
              renderWorkflows();
            }
          });
        } catch (_) {
          pending--;
          if (pending === 0) {
            settings.set_string('actions-workflows', JSON.stringify(result));
            renderWorkflows();
          }
        }
      });
    };

    const loadRow = new Adw.ActionRow({ title: t.loadWorkflows });
    const loadBtn = new Gtk.Button({
      icon_name: 'view-refresh-symbolic',
      valign: Gtk.Align.CENTER,
    });
    loadBtn.add_css_class('flat');
    loadBtn.connect('clicked', loadWorkflows);
    loadRow.add_suffix(loadBtn);
    workflowGroup.add(loadRow);

    renderWorkflows();
  }
}
