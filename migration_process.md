# Guide de Migration de Contenu : Aptispace

Ce guide documente deux axes de migration :

1. **Migration de contenu** — des anciens formats (`.md`, `.ipynb`, `.html`) vers les modules QMD courts d'Aptispace (sections 1.x).
2. **Migration des composants et simulations** — du système `atom/mol/org` legacy vers les composants natifs Quarto/OJS d'Aptispace (sections 2.x).

## 1.1. Structure Hiérarchique Cible

Pour éviter le modèle d'un projet par cours (avec un site Cloudflare Pages distinct par cours), le nouveau système unifie tout le contenu au sein d'une unique arborescence structurée par **Discipline** et par **Thème**.

Les modules doivent être créés sous le répertoire `modules/` selon l'arborescence suivante :
```text
2.Aptispace/
└── modules/
    ├── <discipline-slug>/
    │   └── <theme-slug>/
    │       ├── assets/                 # Images et fichiers associés à ce thème
    │       ├── index.qmd               # Page de garde du thème (Facultatif)
    │       ├── <module-1-slug>.qmd     # Module notionnel 1
    │       ├── <module-2-slug>.qmd     # Module notionnel 2
    │       └── resources.qmd           # Téléchargements (PDFs, ZIPs, PPTXs)
```

### Table des correspondances initiales :
| Répertoire d'origine   | Discipline (`discipline-slug`) | Thème (`theme-slug`) | Titre du Thème               |
| :--------------------- | :----------------------------- | :------------------- | :--------------------------- |
| `Docker`               | `systeme-reseau`               | `docker`             | Docker                       |
| `Linux`                | `systeme-reseau`               | `linux`              | Linux                        |
| `SQL`                  | `systeme-reseau`               | `sql`                | SQL                          |
| `POO Avancé`           | `developpement`                | `poo-avance`         | Programmation Orientée Objet |
| `UML`                  | `developpement`                | `uml`                | Modélisation UML             |
| `Developement Desktop` | `developpement`                | `desktop`            | Développement Desktop        |
| `Informatique`         | `developpement`                | `informatique`       | Bases de l'Informatique      |
| `IA`                   | `data-ia`                      | `ia`                 | Intelligence Artificielle    |
| `Datasciences`         | `data-ia`                      | `datascience`        | Data Science                 |

## 1.2. Découpage en Modules Notionnels

Chaque page `.qmd` générée doit être un **module court** expliquant une seule notion à la fois.

### Règle de découpage par Titre H2 (`##`) :

1. **Identifier les sections H2** dans les fichiers d'origine. Par exemple, dans `Bases de Docker.md` :
   - `## 1.1. Introduction : Pourquoi Docker ?`
   - `## 1.2. Architecture de Docker`
2. **Créer un fichier distinct** pour chaque section H2.
3. **Nettoyer le titre du module** :
   - Retirer les numéros (ex: `1.1.`, `1.2.`).
   - Retirer les styles de titre (ex: pas de `**` ou de `*` dans les titres).
   - Retirer les émojis en début de titre.
   - Exemple : `## 1.1. Introduction : Pourquoi Docker ?` devient le titre de module : `"Introduction : Pourquoi Docker ?"`
4. **Générer le Slug** :
   - Convertir le titre nettoyé en minuscules, remplacer les espaces et caractères spéciaux par des tirets `-`.
   - Exemple de fichier : `intro-pourquoi-docker.qmd`.

## 1.3. Traduction des Formats Sources

### A. Fichiers Markdown (`.md` / `.qmd`)

- Extraire chaque bloc compris entre deux balises `##` (ou de la première balise `##` jusqu'à la fin de la section).
- Écrire un nouveau fichier `.qmd` en insérant le frontmatter Quarto :
  ```markdown
  ---
  title: "Titre du Module Nettoyé"
  ---

  [Contenu du module...]
  ```

### B. Notebooks Jupyter (`.ipynb`)
Pour les répertoires contenant uniquement des notebooks (ou si les notebooks sont plus complets que les `.md`) :

1. Lire le fichier `.ipynb` au format JSON.
2. Parcourir les cellules :
   - Les cellules de type **markdown** sont ajoutées telles quelles au document de travail.
   - Les cellules de type **code** doivent être enveloppées dans un bloc de code correspondant au langage de programmation spécifié dans les métadonnées du notebook (ex: ` ```java ` pour Java, ` ```python ` pour Python).
3. Une fois le document reconstruit sous forme de texte markdown, appliquer la même méthode de découpage par H2 pour générer les modules unitaires.

### C. Pages HTML (`.html`)
Pour les ressources historiques au format HTML (ex: dans `Informatique/HTML/`) :

1. Extraire le contenu textuel et structurel en ignorant les balises `<script>`, `<style>` et les conteneurs d'en-tête/pied de page.
2. Convertir les balises sémantiques principales en syntaxe Markdown :
   - `<h1>` / `<h2>` / `<h3>` $\rightarrow$ `#` / `##` / `###`
   - `<p>` $\rightarrow$ Paragraphe de texte
   - `<ul>` / `<ol>` / `<li>` $\rightarrow$ Listes à puces `*` ou ordonnées `1.`
   - `<code>` / `<pre>` $\rightarrow$ Blocs ou lignes de code ` ``` `
   - `<a>` $\rightarrow$ Liens `[texte](url)`
3. Découper ensuite le texte converti en modules `.qmd` unifiés.

## 1.4. Gestion des Fichiers Annexes et Médias

### A. Images

1. Repérer toutes les images locales référencées dans les cours (ex: `![Description](image.png)`).
2. Déplacer l'image dans le répertoire `modules/<discipline-slug>/<theme-slug>/assets/`.
3. Corriger le chemin dans le fichier `.qmd` : `![Description](assets/image.png)`.

### B. Fichiers de Référence (PDFs, ZIPs, PPTXs)
Pour les supports complémentaires (ex: `polytech-se-memo.pdf` dans Linux, `devoir.zip` dans Réseaux, présentations PowerPoint) :

1. Déplacer les fichiers dans `modules/<discipline-slug>/<theme-slug>/assets/`.
2. Créer une page `resources.qmd` dans le dossier du thème avec le frontmatter suivant :
   ```markdown
   ---
   title: "Ressources et Téléchargements"
   ---

   Retrouvez ci-dessous les supports de cours complémentaires :

   - [Fiche Mémo - PDF](assets/polytech-se-memo.pdf)
   - [Sujet de Devoir - ZIP](assets/devoir.zip)
   ```

## 1.5. Déclaration dans la Navigation Quarto

Une fois les modules générés, ils doivent être référencés de façon ordonnée dans la navigation globale.

Ouvrir `2.Aptispace/_quarto.yml` et remplacer `contents: auto` de la barre latérale par une configuration de contenu structurée :

```yaml
website:
  sidebar:
    style: "docked"
    search: false
    contents:
      - section: "💻 Développement"
        contents:
          - section: "Programmation Orientée Objet"
            contents:
              - modules/developpement/poo-avance/outils.qmd
              - modules/developpement/poo-avance/rappels.qmd
              - modules/developpement/poo-avance/solid.qmd
              - modules/developpement/poo-avance/resources.qmd
          - section: "Modélisation UML"
            contents:
              - modules/developpement/uml/modeliser-systemes.qmd
              - modules/developpement/uml/resources.qmd
      - section: "🌐 Systèmes & Infrastructure"
        contents:
          - section: "Docker"
            contents:
              - modules/systeme-reseau/docker/intro-pourquoi-docker.qmd
              - modules/systeme-reseau/docker/architecture-docker.qmd
              - modules/systeme-reseau/docker/dockerfile.qmd
              - modules/systeme-reseau/docker/docker-compose.qmd
              - modules/systeme-reseau/docker/resources.qmd
```

# 2. Migration des Composants et Simulations

## 2.1. Philosophie Générale

Le système legacy repose sur une hiérarchie de classes JS (`atom.js` → `mol.js` → `org.js`) qui construisent le DOM par concaténation de chaînes HTML. Le système moderne délègue cette responsabilité à :

| Rôle legacy                 | Équivalent moderne                                                                          |
| :-------------------------- | :------------------------------------------------------------------------------------------ |
| Construire le DOM depuis JS | Syntaxe QMD native + filtres Lua                                                            |
| Gérer les inputs OJS        | Filtre `ojs-inputs` (Span → `<input>` + binding OJS automatique)                            |
| Créer des cartes et onglets | Filtres `cards` + `tabs`                                                                    |
| Visualiser des données      | `aptitek.createBar/Line/Funnel/Piramid/WordCloud`                                           |
| Simuler des états/réseaux   | `aptitek.renderStateMachineGraph`, `aptitek.createCabling`, `aptitek.createRamStorageGraph` |

**Règles absolues à respecter :**

- **Zéro HTML dans les QMD.** Toute construction DOM est dans un module JS (`assets/js/`).
- **Zéro `ui.*`.** L'objet `ui` est déprécié. Utiliser `aptitek.*` exclusivement.
- **Cellules OJS fines.** Maximum 3 lignes par cellule : accès via `aptitek.*`, passage des inputs réactifs, retour du résultat.
- **Zéro style inline dans QMD.** Classes Bootstrap ou `data-state` uniquement.

## 2.2. Structure de Simulation Standard (Shell)

Chaque simulation suit cette structure dans le QMD. **Tous les blocs sont optionnels** sauf la carte et la zone centrale.

```markdown
::: {.card-window .mb-4}
#### [emoji] Titre court et engageant {.bi-icon-name}

<!-- BARRE DE CONTRÔLES : onglets + boutons d'action (optionnel) -->
:::: {.tabs .nom-tabset}
##### Onglet A {.bi-icon}
Contenu de l'onglet A.

##### Onglet B {.bi-icon}
Contenu de l'onglet B.

##### [Action]{.btn .bi-play-fill #btn-action} {.tab-right .no-pane}
::::

<!-- DONNÉES CACHÉES (optionnel) — tableaux sources pour parseTableData -->
:::: {#data-source .d-none}
| col1 | col2 |
| :--- | :--- |
| val  | val  |
::::

<!-- ZONE DE SIMULATION CENTRALE -->
::: {#simulation-id .chart-container-lg}
:::

<!-- MÉTRIQUES (optionnel) — valeurs réactives en grand format -->
::: {.metrics}
| Métrique A       | Métrique B       |
| :--------------- | :--------------- |
| [input-id]{.val} | [input-id]{.val} |
:::

<!-- TERMINAL DE RÉSULTAT (optionnel) -->
:::: {.terminal .mt-3 .d-none}
#### Résultat {.bi-terminal}
::::: {.feedback-card .feedback-validated .terminal-line .text-success .fw-bold .mb-3}
[+] Message de succès ({{score}}/{{total}}).
:::::
::::: {.feedback-card .feedback-error .terminal-line .text-danger .fw-bold .mb-3}
[-] Message d'erreur ({{score}}/{{total}}).
:::::
::::: {.feedback-details .reveal-lines}
:::::
::::

:::
```

**Règles de nommage dans ce shell :**

- `#simulation-id` : `kebab-case`, unique dans la page, sans `#` dans les appels `createBar/createWordCloud`, **avec** `#` dans `renderStateMachineGraph/createCabling/createGraph`.
- `.nom-tabset` : classe utilisée par `createTabsetWatcher` pour lier l'onglet actif à une variable OJS `mutable`.
- Bouton d'action `.no-pane` : ne crée pas de panneau, n'existe que comme contrôle dans la barre.

## 2.3. Tableau de Migration des Atomes (`atom.*`)

Les atomes sont les briques indivisibles. Dans le système moderne, ils sont remplacés par la syntaxe QMD native via les filtres Lua.

### Texte et typographie

| Legacy (`atom.*`)              | Moderne (QMD)                                  |
| :----------------------------- | :--------------------------------------------- |
| `atom.text({ type: "title" })` | Titre Markdown `####` dans `.card-window`      |
| `atom.text({ type: "label" })` | `.text-muted .small` (classe Bootstrap inline) |
| `atom.text({ type: "value" })` | `[id]{.val}` (filtre `ojs-inputs`)             |
| `atom.label(text)`             | Texte Markdown brut ou `.fw-bold`              |

### Badges et états

| Legacy                                     | Moderne                         |
| :----------------------------------------- | :------------------------------ |
| `atom.badge({ colorClass: "is-info" })`    | `[Texte]{.badge .bg-info}`      |
| `atom.badge({ colorClass: "is-success" })` | `[Texte]{.badge .bg-success}`   |
| `atom.badge({ colorClass: "is-warning" })` | `[Texte]{.badge .bg-warning}`   |
| `atom.badge({ colorClass: "is-danger" })`  | `[Texte]{.badge .bg-danger}`    |
| `atom.badge({ colorClass: "" })`           | `[Texte]{.badge .bg-secondary}` |

### Inputs de contrôle

| Legacy (`atom.*`)                                  | Moderne (filtre `ojs-inputs`)                                   |
| :------------------------------------------------- | :-------------------------------------------------------------- |
| `atom.slider({ label, min, max, value, id })`      | `[Label]{.slider #id value=50 min=0 max=100}`                   |
| `atom.numberInput({ label, min, max, value, id })` | `[Label]{.number #id value=10 min=1 max=200}`                   |
| `atom.select({ label, options, value, id })`       | `[Label]{.select #id options="A,B,C" value="A"}`                |
| `atom.button({ label })`                           | `[Label]{.btn .bi-play-fill #btn-id}` dans un onglet `.no-pane` |
| `atom.multitab({ options })`                       | `::: {.tabs}` avec `#####` headers                              |

Le filtre génère automatiquement le binding OJS :

- Pour les inputs : `id_var = Generators.input(document.getElementById('id'))`
- Pour les boutons `.no-pane` : `btn_id = Generators.observe(...)` (clics comptés)

**Les tirets dans l'ID sont convertis en `_` dans le nom de variable OJS :**
`#inp-lr` → variable OJS `inp_lr`

### Progression

| Legacy                                           | Moderne (filtre `ojs-inputs`)                         |
| :----------------------------------------------- | :---------------------------------------------------- |
| `atom.progressBar({ value: 42, max: 100 })`      | `[42%]{.progressbar}`                                 |
| `atom.progressBar({ value: 0.42, max: 1 })`      | `[0.42]{.progressbar}`                                |
| `atom.progressBar({ colorClass: "is-success" })` | `[80%]{.progressbar color='success'}`                 |
| `atom.progressBar({ colorClass: "is-danger" })`  | `[30%]{.progressbar color='danger'}`                  |
| Barre réactive liée à un input OJS               | `[inp-id]{.progressbar color='info' animated='true'}` |
| Dans un tableau structuré (mobo)                 | `[]{.progress-bar .bg-success data-progress=70}`      |

### Terminal

| Legacy                                     | Moderne                                         |
| :----------------------------------------- | :---------------------------------------------- |
| `atom.terminalWindow({ header, content })` | `::: {.terminal}` + `#### Titre {.bi-terminal}` |
| `atom.logLine({ message, type: "info" })`  | Texte Markdown dans le `.terminal`              |
| `atom.logLine({ type: "success" })`        | `.terminal-line .text-success`                  |
| `atom.logLine({ type: "danger" })`         | `.terminal-line .text-danger`                   |
| `atom.logLine({ type: "warning" })`        | `.terminal-line .text-warning`                  |

## 2.4. Tableau de Migration des Molécules (`mol.*`)

### Cartes et mises en page

| Legacy (`mol.*`)                        | Moderne (filtre `cards` + grille)                                         |
| :-------------------------------------- | :------------------------------------------------------------------------ |
| `mol.card({ header, content })`         | `::: {.card-window}` + `#### Titre {.bi-icon}`                            |
| `mol.card({ colorClass: "is-info" })`   | Badge inline dans le header : `[Qualitative]{.badge .bg-info .float-end}` |
| `mol.comparisonLayout({ left, right })` | `::: {.row}` + `:::: {.col}` + `:::: {.col}`                              |
| `mol.vectorSpace({ height, label })`    | `::: {#id .chart-container-*}`                                            |

Tailles de conteneur disponibles :

| Classe                | Hauteur approximative |
| :-------------------- | :-------------------- |
| `.chart-container-xs` | ~150 px               |
| `.chart-container-sm` | ~200 px               |
| `.chart-container`    | ~300 px               |
| `.chart-container-md` | ~350 px               |
| `.chart-container-lg` | ~450 px               |
| `.chart-container-xl` | ~550 px               |

### Métriques réactives

| Legacy                                                | Moderne                                                    |
| :---------------------------------------------------- | :--------------------------------------------------------- |
| `mol.metricCard({ title, value, trend: "positive" })` | `::: {.metrics}` avec `[id]{.val}`                         |
| `mol.metricCard()` côte à côte                        | Colonnes du tableau `.metrics` — couleur auto par position |

Le composant `.metrics` colore automatiquement : col 1 → `--accent-primary`, col 2 → `--accent-success`, col 3 → `--accent-warning`, col 4 → `--accent-danger`.

### Toggle et onglets

| Legacy                           | Moderne (filtre `tabs`)                                |
| :------------------------------- | :----------------------------------------------------- |
| `mol.toggle({ options, value })` | `::: {.tabs}` + headers `#####`                        |
| Toggle lié à OJS (`viewof`)      | `.tabs` + `createTabsetWatcher()` dans une cellule OJS |
| Options alignées à droite        | Dernier onglet `.tab-right`                            |

Pattern OJS pour lier un tabset à une variable réactive :

```{ojs}
mutable maVariable = "valeur-defaut"

_tabWatcher = {
  const w = createTabsetWatcher(
    ".nom-tabset",
    { "Onglet A": "valeur-a", "Onglet B": "valeur-b" },
    (val) => { mutable maVariable = val; }
  );
  invalidation.then(() => w.destroy());
  return null;
}
```

### Console terminal avec feedback

`mol.terminalConsole()` avec séquence animée → bloc `.terminal` + `.reveal-lines` + `renderFeedbackUI()` :

```markdown
:::: {#feedback-panel .terminal .mt-3 .d-none}
#### Résultat {.bi-terminal}
::::: {.feedback-card .feedback-incomplete .terminal-line .text-warning .fw-bold .mb-3}
[!] Incomplet : {{score}}/{{total}} connectés.
:::::
::::: {.feedback-card .feedback-validated .terminal-line .text-success .fw-bold .mb-3}
[+] Validé : {{score}}/{{total}} corrects.
:::::
::::: {.feedback-card .feedback-error .terminal-line .text-danger .fw-bold .mb-3}
[-] Erreurs détectées : {{score}}/{{total}} corrects.
:::::
::::: {.feedback-details .reveal-lines}
:::::
::::
```

```{ojs}
// Appel JS :
renderFeedbackUI("#feedback-panel", { status: "validated", score: 3, total: 4 }, listData)
```

## 2.5. Tableau de Migration des Organismes (`org.*`)

### Visualisations Plotly

| Legacy (`org.*` / `mol.*`)            | Moderne (`aptitek.*`)                            |
| :------------------------------------ | :----------------------------------------------- |
| `org.plotlyWrapper({ data, layout })` | Appel direct `createBar/createLine/…`            |
| `mol.interactiveContinuousGraph()`    | `createLine("id", { x, y }, "Titre", options)`   |
| `mol.interactiveHistogram()`          | `createBar("id", { x, y }, "Titre", options)`    |
| `mol.interactivePyramid()`            | `createPiramid("id", { text, values }, options)` |
| `mol.wordCloud3D()`                   | `createWordCloud("id", words, options)`          |

**Important :** Les fonctions Plotly prennent l'ID **sans `#`**. `createWordCloud` aussi. `renderStateMachineGraph` et `createGraph` prennent l'ID **avec `#`**.

Toujours utiliser `getThemeColor("--sol-variable", "#fallback")` pour les couleurs :

```{ojs}
createBar("mon-graphe", { x: labels, y: values }, "Titre", {
  marker: { color: getThemeColor("--sol-green", "#859900") },
  layout: {
    margin: { t: 45, b: 40, l: 50, r: 20 },
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent"
  }
})
```

### Inspecteur de DataFrame

`org.dataframeInspector()` → Tableau Markdown standard + classes Bootstrap :

```markdown
:::: {#data-source .d-none}
| Nom   | Age | Salaire |
| :---- | :-- | :------ |
| Alice | 30  | 50k     |
| Bob   | 25  | 45k     |
::::
```

```{ojs}
tableData = parseTableData("#data-source table")
```

Le tableau est ensuite utilisable dans les fonctions JS (ex : `createRamStorageGraph`).

### Matrice de confusion

`org.confusionMatrix()` → Tableau Markdown stylisé (Bootstrap) :

```markdown
| \          |    Prédit +   |    Prédit −   |
| :--------- | :-----------: | :-----------: |
| **Réel +** | [tp]{.val} TP | [fn]{.val} FN |
| **Réel −** | [fp]{.val} FP | [tn]{.val} TN |
```

### Simulateur d'ensemble

`org.ensembleSimulator()` → Grille `.row` + `.col` avec `.card-window` par arbre, alimentée depuis OJS :

```markdown
::: {#ensemble-container .row}
:::
```

```{ojs}
renderEnsemble = {
  numTrees;
  const container = document.querySelector("#ensemble-container");
  container.innerHTML = "";
  Array.from({ length: numTrees }, (_, i) => {
    const col = document.createElement("div");
    col.className = "col";
    col.innerHTML = `<div class="card-window"><h4>Arbre ${i + 1}</h4><div class="card-body">…</div></div>`;
    container.appendChild(col);
  });
}
```

### Simulateur de splitting

`org.splitSimulator()` → `createBar()` avec un slider OJS :

```markdown
- [Ratio d'entraînement]{.slider #train-ratio value=80 min=10 max=90}

::: {#split-graph .chart-container-md}
:::
```

```{ojs}
renderSplit = {
  const train = train_ratio;
  createBar("split-graph", {
    x: ["Train", "Test"],
    y: [train, 100 - train]
  }, "Répartition des données", {
    marker: { color: [getThemeColor("--sol-blue", "#268bd2"), getThemeColor("--sol-green", "#859900")] }
  })
}
```

### Machine à états

`renderStateMachineGraph` remplace toute simulation de machine à états :

```markdown
::: {.card-window .mb-4}
#### Titre du simulateur {.bi-diagram-3}

:::: {.tabs}
##### Graphique {.bi-graph-up}
::::: {#mon-sm .state-machine-wrapper}
:::::

##### [Lancer]{#btn-sm .bi-play-fill .btn} {.tab-right .no-pane}
::::
:::
```

```{ojs}
smGraph = {
  const nodes = [
    { id: "A", label: "Début", status: "entry", shape: "circle" },
    { id: "B", label: "Traitement", status: "default", shape: "rounded rect" }
  ];
  const links = [
    { source: "A", target: "B", label: "init", condition: true }
  ];
  const graph = renderStateMachineGraph("#mon-sm", { nodes, links }, {
    nodeRadius: 22, fontSize: 9,
    enableZoom: false, zoomToFit: true, zoomToFitPadding: 50, height: 300
  });
  invalidation.then(() => { if (graph?.destroy) graph.destroy(); });
  return graph;
}
```

Animation via `StateMachine` (voir section 2.6).

### Câblage interactif

`createCabling` remplace tout exercice de type "relier les éléments" :

```markdown
::: {.card-window}
#### Titre de l'exercice {.bi-ethernet}

:::: {#data-cabling .d-none}
| id  | label | match  | feedback             |
| :-- | :---- | :----- | :------------------- |
| v1  | Var A | type-x | Explication correcte |
::::

Reliez chaque élément à sa catégorie.

:::: {.cabling-panel}
::::: {.cabling-workspace-wrapper}
:::::: {#cabling-canvas}
::::::

:::::: {#power-lever .lever-wrapper}
::::::: {.lever-housing}
[ON]{.lever-label-top}
:::::::: {.lever-slot}::::::::
:::::::: {.lever-handle}::::::::
:::::::: {.lever-led}::::::::
[OFF]{.lever-label-bottom}
:::::::
[Circuit alimenté]{#lever-status-on .lever-status .is-on}
[Circuit coupé]{#lever-status-off .lever-status .is-off}
::::::
:::::
::::

```
viewof powerOn = createLever("#power-lever", invalidation)
```

:::: {#feedback-cabling .terminal .mt-4 .d-none}
#### Diagnostic {.bi-terminal}
::::: {.feedback-card .feedback-incomplete .terminal-line .text-warning .fw-bold .mb-3}
[!] Brassage incomplet ({{score}}/{{total}}).
:::::
::::: {.feedback-card .feedback-validated .terminal-line .text-success .fw-bold .mb-3}
[+] Excellent ! Signal pur ({{score}}/{{total}}).
:::::
::::: {.feedback-card .feedback-error .terminal-line .text-danger .fw-bold .mb-3}
[-] Erreurs détectées ({{score}}/{{total}}).
:::::
::::: {.feedback-details .reveal-lines}:::::
::::

:::
```

```{ojs}
leftItems = parseTableData("#data-cabling table")
rightItems = Array.from(new Set(leftItems.map(i => i.match)))
  .map(id => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1) }))

engine = {
  const m = createCabling("#cabling-canvas", leftItems, rightItems,
    (state) => { if (state.score < leftItems.length) renderFeedbackUI("#feedback-cabling", { status: "hidden" }); }
  );
  invalidation.then(() => m.destroy());
  return m;
}

uiLogic = {
  powerOn;
  if (!powerOn) { engine.clearValidation(); renderFeedbackUI("#feedback-cabling", { status: "hidden" }); return; }
  const state = engine.validate();
  if (state.status === "validated") state.status = state.score === leftItems.length ? "validated" : "error";
  const listData = leftItems.map(item => {
    const ok = state.connections?.[item.id] === item.match;
    const rMatch = rightItems.find(r => r.id === state.connections?.[item.id]);
    return { label: item.label, rightLabel: rMatch?.label ?? "?", badgeClass: ok ? "text-success" : "text-danger", badgeText: ok ? "OK" : "Erreur", feedback: ok ? item.feedback : "Incohérence détectée." };
  });
  renderFeedbackUI("#feedback-cabling", state, listData);
}
```

## 2.6. Patterns OJS Avancés

### `StateMachine` — Animation pas à pas

`StateMachine` pilote une animation séquentielle liée à un bouton de déclenchement :

```{ojs}
animGraph = {
  // 1. Créer le graphe (voir renderStateMachineGraph ci-dessus)
  const graph = renderStateMachineGraph("#mon-sm", { nodes, links }, options);

  // 2. Définir les étapes
  const steps = [
    { activeNode: "A", activeLink: null, pastNodes: [], pastLinks: [] },
    { activeNode: "B", activeLink: "A-B", pastNodes: ["A"], pastLinks: [] }
  ];

  // 3. Créer la machine à états
  const sm = new StateMachine({
    states: steps,
    interval: 1200,
    loop: false,
    onStateChange: (step, index) => {
      nodes.forEach(n => {
        if (n.id === step.activeNode) n.status = "current";
        else if (step.pastNodes.includes(n.id)) n.status = "past";
        else n.status = "default";
      });
      links.forEach(l => {
        const srcId = typeof l.source === "object" ? l.source.id : l.source;
        const tgtId = typeof l.target === "object" ? l.target.id : l.target;
        const lid = `${srcId}-${tgtId}`;
        if (lid === step.activeLink) l.status = "current";
        else if (step.pastLinks.includes(lid)) l.status = "past";
        else l.status = "default";
      });
      graph.graphData({ nodes, links });
    }
  });

  invalidation.then(() => { sm.stop(); graph?.destroy?.(); });
  return { graph, sm };
}

// 4. Lier le bouton à la machine
_toggle = {
  if (btn_sm === 0) return;
  const { sm } = animGraph;
  if (sm.isPlaying) { sm.stop(); sm.currentIndex = 0; }
  else sm.start();
}
```

### `renderTemplate` — Mise à jour d'un bloc HTML avec des données

Pour mettre à jour un tableau ou un bloc contenant des `{{placeholder}}` :

```{ojs}
updateInspector = {
  const el = document.querySelector("#mon-inspecteur");
  el.style.setProperty("--inspector-color", tok.color);
  renderTemplate(el, {
    titre: tok.text,
    index: `${idx + 1}`,
    label: tok.label ?? "-"
  });
}
```

Correspondance dans le QMD (le template HTML dans le DOM) :

```markdown
:::: {#mon-inspecteur}
| Prop      | Valeur                      |
| :-------- | :-------------------------- |
| **Titre** | [**{{titre}}**]{.font-code} |
| **Index** | [**{{index}}**]{.font-code} |
| **Label** | [**{{label}}**]{.font-code} |
::::
```

### `parseTableData` — Lire un tableau Markdown depuis le DOM

Les données sources cachées dans un `.d-none` sont lues via :

```{ojs}
tableData = parseTableData("#data-source table")
// Retourne : [{ col1: "val", col2: "val" }, ...]
```

Les noms de colonnes sont les en-têtes du tableau Markdown (en minuscules, tels quels).

### `createTabsetWatcher` — Réactivité sur les onglets Bootstrap

Lie l'onglet actif d'un tabset à une variable OJS `mutable` :

```{ojs}
mutable monMode = "valeur-defaut"

_watcher = {
  const w = createTabsetWatcher(
    ".ma-classe-tabset",           // sélecteur CSS du tabset
    {                              // map label-onglet → valeur OJS
      "Label Onglet A": "val-a",
      "Label Onglet B": "val-b"
    },
    (val) => { mutable monMode = val; }
  );
  invalidation.then(() => w.destroy());
  return null;
}
```

## 2.7. Migration des Classes CSS

### Préfixes à supprimer

| Classe legacy                     | Remplacement moderne                                                 |
| :-------------------------------- | :------------------------------------------------------------------- |
| `atom-text-title`                 | Titre Markdown `####` dans la carte                                  |
| `atom-text-label`                 | `.text-muted .small` (Bootstrap)                                     |
| `atom-text-value`                 | `[id]{.val}`                                                         |
| `atom-label`                      | Texte Markdown brut ou `.fw-bold`                                    |
| `mol-toggle`                      | `.tabs` (filtre tabs)                                                |
| `mol-toggle.is-horizontal`        | `.tabs` standard                                                     |
| `ui-card`                         | `.card-window` (filtre cards)                                        |
| `ui-card is-info`                 | `.card-window` + `[Badge]{.badge .bg-info .float-end}` dans le titre |
| `ui-terminal`                     | `.terminal`                                                          |
| `ui-terminal-header`              | `#### Titre {.bi-terminal}` dans `.terminal`                         |
| `ui-terminal-body`                | Corps du bloc `.terminal`                                            |
| `ui-terminal-line is-success`     | `.terminal-line .text-success`                                       |
| `ui-terminal-line is-danger`      | `.terminal-line .text-danger`                                        |
| `ui-terminal-line is-warning`     | `.terminal-line .text-warning`                                       |
| `ui-terminal-line is-muted`       | `.terminal-line .text-muted`                                         |
| `ui-badge is-info`                | `[Texte]{.badge .bg-info}`                                           |
| `ui-badge is-success`             | `[Texte]{.badge .bg-success}`                                        |
| `ui-badge is-warning`             | `[Texte]{.badge .bg-warning}`                                        |
| `ui-badge is-danger`              | `[Texte]{.badge .bg-danger}`                                         |
| `ui-progress` + `ui-progress-bar` | `[val%]{.progressbar}`                                               |
| `ui-canvas`                       | `::: {#id .chart-container-*}`                                       |
| `ui-multitab-container`           | `.tabs` (filtre tabs)                                                |
| `ui-card-header`                  | En-tête `.card-window` (header H4)                                   |
| `is-info` (état)                  | `.text-info` ou `data-state="info"`                                  |
| `is-success` (état)               | `.text-success` ou `data-state="success"`                            |
| `is-danger` (état)                | `.text-danger` ou `data-state="danger"`                              |
| `is-warning` (état)               | `.text-warning` ou `data-state="warning"`                            |
| `is-debug` / `is-muted`           | `.text-muted`                                                        |
| `premium-*`                       | Supprimer — toutes les fonctionnalités sont natives                  |

### Classes conservées (natif moderne)

Ces classes sont définies dans le SCSS moderne et sont à conserver :

| Classe                   | Source            | Usage                                |
| :----------------------- | :---------------- | :----------------------------------- |
| `.card-window`           | Filtre `cards`    | Carte fenêtre macOS                  |
| `.terminal`              | Filtre `cards`    | Terminal sombre                      |
| `.cabling-panel`         | `networks.js`     | Zone jsPlumb                         |
| `.lever-wrapper`         | `custom/lever.js` | Levier ON/OFF                        |
| `.ram-motherboard`       | `custom/ram.js`   | Conteneur barrettes RAM              |
| `.ram-stick`             | `custom/ram.js`   | Barrette RAM individuelle            |
| `.ram-byte-box`          | `custom/ram.js`   | Case d'octet                         |
| `.motherboard-view`      | `custom/mobo.js`  | SVG carte mère interactif            |
| `.state-machine-wrapper` | `networks.js`     | Conteneur machine à états            |
| `.reveal-lines`          | SCSS global       | Animation séquentielle               |
| `.feedback-card`         | `core.js`         | Carte de feedback cachée             |
| `.feedback-details`      | `core.js`         | Détails de feedback                  |
| `.metrics`               | SCSS global       | Tableau métriques grand format       |
| `.concept-details`       | SCSS global       | Détails conceptuels pliables         |
| `.chart-container-*`     | SCSS global       | Conteneur de graphique Plotly/Canvas |

## 2.8. Checklist de Migration par Simulation

Pour chaque simulation ou composant legacy à migrer, suivre ces étapes dans l'ordre :

1. **Identifier le type de composant** : Atom / Molécule / Organisme.
2. **Chercher l'équivalent natif** dans `demo.qmd` avant d'écrire du JS custom.
3. **Créer le shell de carte** : `.card-window` avec titre + icône Bootstrap Icons.
4. **Ajouter les onglets** si plusieurs vues sont nécessaires (`.tabs` + `createTabsetWatcher`).
5. **Déclarer les inputs** via le filtre `ojs-inputs` (Spans `{.slider}`, `{.number}`, `{.select}`, `{.btn}`).
6. **Déclarer la zone centrale** : `{#id .chart-container-*}` vide dans le QMD.
7. **Écrire la cellule OJS** (≤ 3 lignes) qui appelle `aptitek.*` avec les inputs réactifs.
8. **Ajouter `.metrics`** si des valeurs agrégées doivent être affichées en bas.
9. **Ajouter `.terminal`** + `renderFeedbackUI()` si la simulation produit un feedback de validation.
10. **Supprimer tout code `ui.*`**, toute classe `atom-*`, `mol-*`, `org-*`, `ui-*`, `premium-*`.
11. **Vérifier zéro style inline** dans le QMD et dans les cellules OJS.
12. **Généraliser** : si la logique créée est réutilisable dans d'autres modules, la déplacer dans `assets/js/custom/` ou `assets/js/networks.js`.
