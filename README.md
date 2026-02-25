# GitHub PRs - GNOME Extension

A panel indicator that lists your open pull requests and PRs pending your review. Data is fetched every time you open the menu and cached for instant display on subsequent opens.

Supports **pt-BR** and **en-US** automatically based on your system language.

## Requirements

- [GitHub CLI (gh)](https://cli.github.com/) installed and authenticated (`gh auth login`)
- GNOME Shell 45+

## Installation

```bash
git clone https://github.com/VitorPiovezan/gnome-extension-gh-prs.git
cp -r gnome-extension-gh-prs ~/.local/share/gnome-shell/extensions/gh-pr-indicator@local
gnome-extensions enable gh-pr-indicator@local
```

Restart the Shell (Alt+F2, type `r`) if the extension doesn't show up.

## Configuration

Optional: create a `config.json` in the extension folder to change the `gh` binary path:

```json
{"gh-path": "/usr/bin/gh"}
```

Run `which gh` to find the path on your system.

## Usage

Click the branch icon in the top bar. The menu shows:
- **Opened by me**: PRs you authored (open state)
- **Pending review**: PRs where your review was requested

The first time you open the menu it fetches fresh data. On subsequent opens it shows the cached list instantly and refreshes in the background. Click any item to open the PR in your browser.
