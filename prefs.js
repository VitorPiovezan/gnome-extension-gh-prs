import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import GLib from 'gi://GLib';
import { ExtensionPreferences } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const I18N = {
  'pt': {
    title: 'GitHub PRs',
    groupSections: 'Secoes',
    showMyPrs: 'Mostrar PRs abertas por mim',
    showMyPrsDesc: 'Exibir a secao de PRs que voce abriu',
    showReviewPrs: 'Mostrar PRs pendentes de revisao',
    showReviewPrsDesc: 'Exibir a secao de PRs aguardando sua revisao',
    groupAppearance: 'Aparencia',
    menuWidth: 'Largura do menu (px)',
    menuWidthDesc: 'Largura do popup em pixels',
    maxItems: 'Maximo de PRs por secao',
    maxItemsDesc: 'Quantidade maxima de PRs buscadas em cada secao',
    groupAdvanced: 'Avancado',
    ghPath: 'Caminho do gh',
    ghPathDesc: 'Caminho absoluto para o binario do GitHub CLI',
  },
  'en': {
    title: 'GitHub PRs',
    groupSections: 'Sections',
    showMyPrs: 'Show PRs opened by me',
    showMyPrsDesc: 'Display the section with PRs you authored',
    showReviewPrs: 'Show PRs pending review',
    showReviewPrsDesc: 'Display the section with PRs awaiting your review',
    groupAppearance: 'Appearance',
    menuWidth: 'Menu width (px)',
    menuWidthDesc: 'Width of the popup menu in pixels',
    maxItems: 'Max PRs per section',
    maxItemsDesc: 'Maximum number of PRs fetched per section',
    groupAdvanced: 'Advanced',
    ghPath: 'gh binary path',
    ghPathDesc: 'Absolute path to the GitHub CLI binary',
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

    const page = new Adw.PreferencesPage({ title: t.title });
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
        lower: 250,
        upper: 800,
        step_increment: 10,
        page_increment: 50,
        value: settings.get_int('menu-width'),
      }),
    });
    settings.bind('menu-width', widthRow, 'value', 0);
    appearanceGroup.add(widthRow);

    const maxItemsRow = new Adw.SpinRow({
      title: t.maxItems,
      subtitle: t.maxItemsDesc,
      adjustment: new Gtk.Adjustment({
        lower: 5,
        upper: 50,
        step_increment: 1,
        page_increment: 5,
        value: settings.get_int('max-items'),
      }),
    });
    settings.bind('max-items', maxItemsRow, 'value', 0);
    appearanceGroup.add(maxItemsRow);

    const advancedGroup = new Adw.PreferencesGroup({ title: t.groupAdvanced });
    page.add(advancedGroup);

    const ghPathRow = new Adw.EntryRow({
      title: t.ghPath,
    });
    ghPathRow.set_text(settings.get_string('gh-path'));
    ghPathRow.connect('changed', () => {
      settings.set_string('gh-path', ghPathRow.get_text());
    });
    advancedGroup.add(ghPathRow);
  }
}
