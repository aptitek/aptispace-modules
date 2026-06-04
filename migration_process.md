# Guide de Migration de Contenu : Aptispace

Ce guide documente le processus de migration des anciens contenus de cours de différents formats (fichiers Markdown volumineux, Notebooks Jupyter, pages HTML) vers le nouveau système de modules d'apprentissage courts d'Aptispace.

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
