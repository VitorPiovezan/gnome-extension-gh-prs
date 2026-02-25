# GitHub PRs - Extensao GNOME

Indicador no header que lista suas PRs abertas e as pendentes de revisao. Sincronizado ao abrir o menu (so PRs abertas).

## Requisitos

- [GitHub CLI (gh)](https://cli.github.com/) instalado e autenticado (`gh auth login`)
- GNOME Shell 45+

## Instalacao

```bash
cp -r /home/vitorpiovezan/Documentos/gnome-extensions/gh-pr-indicator ~/.local/share/gnome-shell/extensions/gh-pr-indicator@local
gnome-extensions enable gh-pr-indicator@local
```

Reinicie o Shell (Alt+F2, `r`) se a extensao nao aparecer.

## Configuracao

Opcional: crie `config.json` na pasta da extensao para mudar o caminho do `gh`:

```json
{"gh-path": "/usr/bin/gh"}
```

Use `which gh` para ver o caminho no seu sistema.

## Uso

Clique no icone (ramo de git) no header. O menu mostra:
- **Abertas por mim**: PRs que voce abriu (open)
- **Pendentes de revisao**: PRs em que voce foi solicitado a revisar

Cada vez que voce abre o menu, a lista e atualizada. Clique em uma linha para abrir a PR no navegador.
