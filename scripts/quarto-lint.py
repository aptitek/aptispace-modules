import re
import sys
from pathlib import Path

def process_quarto_nesting(content: str, add_comments: bool = True) -> str:
    lines = content.split('\n')
    output_lines = []
    
    # Pile pour suivre l'imbrication : list de dicts {'type': 'div'|'code', 'class': str, 'depth': int}
    stack = []
    
    # Regex pour capturer l'indentation, les délimiteurs et le reste de la ligne
    re_div = re.compile(r'^(\s*)(:{3,})\s*(.*)$')
    re_code = re.compile(r'^(\s*)(`{3,})\s*(.*)$')
    
    def extract_div_class(meta_str):
        """Extrait la classe principale d'une Div Quarto (ex: {.columns} -> columns)"""
        match = re.search(r'\.([a-zA-Z0-9_-]+)', meta_str)
        if match:
            return match.group(1)
        # S'il n'y a pas de point, on nettoie les accolades et on prend le premier mot
        clean = re.sub(r'[{}]', '', meta_str).strip()
        return clean.split()[0] if clean else "div"

    def extract_code_lang(meta_str):
        """Extrait le langage d'un bloc de code (ex: {python} -> python)"""
        clean = re.sub(r'[{}]', '', meta_str).strip()
        if clean.startswith('.'):
            clean = clean[1:]
        return clean.split()[0] if clean else "code"

    opened_codes = 0
    closed_codes = 0
    opened_divs = 0
    closed_divs = 0
    orphans = 0

    for line_idx, line in enumerate(lines, start=1):
        code_match = re_code.match(line)
        div_match = re_div.match(line)
        
        # On vérifie si le bloc actuel dans la pile est un bloc de code
        in_code_block = len(stack) > 0 and stack[-1]['type'] == 'code'
        
        if code_match:
            indent, marker, meta = code_match.groups()
            meta_clean = re.sub(r'<!--.*?-->', '', meta).strip() # Retire d'anciens commentaires
            
            if in_code_block:
                # Fermeture du bloc de code actuel
                popped = stack.pop()
                close_marker = "```"
                closed_codes += 1
                print(f"    [NESTING] Line {line_idx}: Code block '{popped['class']}' closed with '{close_marker}'.")
                output_lines.append(f"{indent}{close_marker}")
            else:
                # Ouverture d'un bloc de code
                depth = len([s for s in stack if s['type'] == 'div'])
                lang = extract_code_lang(meta_clean)
                stack.append({'type': 'code', 'class': lang, 'marker': marker, 'line': line_idx, 'depth': depth})
                opened_codes += 1
                new_marker = "```"
                print(f"    [NESTING] Line {line_idx}: Code block '{lang}' opened with '{new_marker}' (level {depth + 1}).")
                output_lines.append(f"{indent}{new_marker}{meta_clean}".rstrip())
                
        elif div_match and not in_code_block:
            indent, marker, meta = div_match.groups()
            meta_clean = re.sub(r'<!--.*?-->', '', meta).strip()
            
            if meta_clean:
                # Ouverture d'une Div
                depth = len([s for s in stack if s['type'] == 'div'])
                div_class = extract_div_class(meta_clean)
                stack.append({'type': 'div', 'class': div_class, 'marker': marker, 'line': line_idx, 'depth': depth})
                opened_divs += 1
                new_marker = ':' * (3 + depth)
                print(f"    [NESTING] Line {line_idx}: Div '{div_class}' opened with '{new_marker}' (level {depth + 1}).")
                output_lines.append(f"{indent}{new_marker} {meta_clean}".rstrip())
            else:
                # Fermeture d'une Div
                if stack and stack[-1]['type'] == 'div':
                    popped = stack.pop()
                    new_marker = ':' * (3 + popped['depth'])
                    closed_divs += 1
                    print(f"    [NESTING] Line {line_idx}: Div '{popped['class']}' closed with '{new_marker}'.")
                    output_lines.append(f"{indent}{new_marker}")
                else:
                    # Séparateur orphelin (erreur de syntaxe ou cas particulier), on le laisse tel quel
                    orphans += 1
                    print(f"    [NESTING] WARNING: Line {line_idx}: Orphan closing marker '{line.strip()}' found (no matching open div in stack).")
                    output_lines.append(line)
        else:
            output_lines.append(line)
            
    print(f"    [NESTING SUMMARY] Opened: {opened_divs} divs, {opened_codes} code blocks. Closed: {closed_divs} divs, {closed_codes} code blocks. Orphans: {orphans}.")
    if stack:
        print(f"    [NESTING] Automatically closing {len(stack)} unclosed element(s) at the end of the document to balance the structure.")
        for item in reversed(stack):
            if item['type'] == 'div':
                new_marker = ':' * (3 + item['depth'])
                print(f"      - Closing div '{item['class']}' opened at line {item['line']} with '{new_marker}'")
                output_lines.append(new_marker)
            elif item['type'] == 'code':
                new_marker = "```"
                print(f"      - Closing code block '{item['class']}' opened at line {item['line']} with '{new_marker}'")
                output_lines.append(new_marker)
        stack.clear()
    else:
        print(f"    [NESTING SUCCESS] Document structure is perfectly balanced.")
        
    return '\n'.join(output_lines)

def renumber_titles(content: str) -> str:
    """Re-numérote séquentiellement et hiérarchiquement les numéros dans les titres (ex: ## 1.2 Title)"""
    lines = content.split('\n')
    cleaned = []
    
    in_code_block = False
    in_frontmatter = False
    
    # Compteurs pour les niveaux H1 à H6
    counters = [0] * 7
    
    for i, line in enumerate(lines):
        if re.match(r'^\s*`{3,}', line):
            in_code_block = not in_code_block
            cleaned.append(line)
            continue
            
        if i == 0 and line.strip() == '---':
            in_frontmatter = True
            cleaned.append(line)
            continue
        elif in_frontmatter and line.strip() == '---':
            in_frontmatter = False
            cleaned.append(line)
            continue
            
        if in_code_block or in_frontmatter:
            cleaned.append(line)
            continue
            
        header_match = re.match(r'^(\s*#{1,6}\s+)(.*)$', line)
        if header_match:
            prefix, rest = header_match.groups()
            level = prefix.strip().count('#')
            
            # Incrémente le niveau actuel et remet à zéro les sous-niveaux
            counters[level] += 1
            for l in range(level + 1, 7):
                counters[l] = 0
                
            # Détecte un préfixe numérique (ex: "1.", "1.2", "2.3.4")
            number_match = re.match(r'^([0-9]+(?:\.[0-9]+)*\.?\s+)(.*)$', rest)
            if number_match:
                orig_num, text = number_match.groups()
                
                # Construit le nouveau numéro hiérarchique
                start_level = 1
                while start_level < level and counters[start_level] == 0:
                    start_level += 1
                    
                num_parts = [str(counters[l]) for l in range(start_level, level + 1)]
                new_num = ".".join(num_parts)
                
                # Conserve le point final si l'original en avait un
                if orig_num.strip().endswith('.'):
                    new_num += '.'
                    
                new_line = f"{prefix}{new_num} {text}"
                cleaned.append(new_line)
            else:
                cleaned.append(line)
        else:
            cleaned.append(line)
            
    return '\n'.join(cleaned)

def clean_titles(content: str) -> str:
    """Retire l'emphase (gras, italique) des titres markdown (lignes commençant par #)"""
    lines = content.split('\n')
    cleaned = []
    for line in lines:
        if re.match(r'^\s*#{1,6}\s+', line):
            match = re.match(r'^(\s*#{1,6}\s+)(.*)$', line)
            prefix, text = match.groups()
            # Supprime le gras : **texte** -> texte et __texte__ -> texte
            text = re.sub(r'\*\*(.*?)\*\*', r'\1', text)
            text = re.sub(r'__(.*?)__', r'\1', text)
            # Supprime l'italique : *texte* -> texte et _texte_ -> texte
            text = re.sub(r'\*(.*?)\*', r'\1', text)
            text = re.sub(r'_(.*?)_', r'\1', text)
            cleaned.append(prefix + text)
        else:
            cleaned.append(line)
    return '\n'.join(cleaned)

def remove_hr_above_titles(content: str) -> str:
    """Supprime les lignes de séparation '---' situées juste au-dessus des titres, hors frontmatter"""
    lines = content.split('\n')
    cleaned = []
    in_frontmatter = False
    
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        
        # Détection du frontmatter Quarto au tout début
        if i == 0 and line.strip() == '---':
            in_frontmatter = True
            cleaned.append(line)
            i += 1
            continue
        elif in_frontmatter and line.strip() == '---':
            in_frontmatter = False
            cleaned.append(line)
            i += 1
            continue
            
        if not in_frontmatter and line.strip() == '---':
            # Regarde la ligne non vide suivante
            next_title_idx = -1
            for j in range(i + 1, n):
                if lines[j].strip() != '':
                    if re.match(r'^\s*#{1,6}\s+', lines[j]):
                        next_title_idx = j
                    break
            
            # Si un titre suit directement (avec potentiellement des lignes vides), on retire la ligne '---'
            if next_title_idx != -1:
                i += 1
                continue
                
        cleaned.append(line)
        i += 1
        
    return '\n'.join(cleaned)

def renumber_lists(content: str) -> str:
    """Re-numérote séquentiellement les listes ordonnées markdown en gérant l'imbrication"""
    lines = content.split('\n')
    cleaned = []
    
    in_code_block = False
    in_frontmatter = False
    
    # Dictionnaire associant le niveau d'indentation au compteur actuel
    active_lists = {}
    
    for i, line in enumerate(lines):
        if re.match(r'^\s*`{3,}', line):
            in_code_block = not in_code_block
            cleaned.append(line)
            active_lists.clear()
            continue
            
        if i == 0 and line.strip() == '---':
            in_frontmatter = True
            cleaned.append(line)
            continue
        elif in_frontmatter and line.strip() == '---':
            in_frontmatter = False
            cleaned.append(line)
            continue
            
        if in_code_block or in_frontmatter:
            cleaned.append(line)
            continue
            
        ordered_match = re.match(r'^(\s*)(\d+)\.\s+(.*)$', line)
        unordered_match = re.match(r'^(\s*)([-*+])\s+(.*)$', line)
        
        if ordered_match:
            indent, num_str, rest = ordered_match.groups()
            indent_len = len(indent)
            
            # Nettoie les listes de niveau d'indentation supérieur
            active_lists = {k: v for k, v in active_lists.items() if k <= indent_len}
            
            if indent_len in active_lists:
                active_lists[indent_len] += 1
            else:
                active_lists[indent_len] = 1
                
            new_num = active_lists[indent_len]
            new_line = f"{indent}{new_num}. {rest}"
            cleaned.append(new_line)
            
        elif unordered_match:
            indent, marker, rest = unordered_match.groups()
            indent_len = len(indent)
            # Nettoie les compteurs de listes ordonnées de niveau d'indentation supérieur ou égal
            active_lists = {k: v for k, v in active_lists.items() if k < indent_len}
            cleaned.append(line)
            
        elif line.strip() == '':
            cleaned.append(line)
            
        else:
            line_indent = len(line) - len(line.lstrip())
            # Nettoie les compteurs de listes ordonnées de niveau d'indentation supérieur ou égal
            active_lists = {k: v for k, v in active_lists.items() if k < line_indent}
            cleaned.append(line)
            
    return '\n'.join(cleaned)

def add_empty_line_above_lists(content: str) -> str:
    """Ajoute une ligne vide au-dessus du début d'une liste markdown"""
    lines = content.split('\n')
    cleaned = []
    
    in_code_block = False
    in_frontmatter = False
    
    def is_list_item(line_str: str) -> bool:
        return bool(re.match(r'^\s*([-*+])\s+', line_str) or re.match(r'^\s*\d+\.\s+', line_str))
        
    for i, line in enumerate(lines):
        # Ne pas toucher aux listes dans les blocs de code
        if re.match(r'^\s*`{3,}', line):
            in_code_block = not in_code_block
            cleaned.append(line)
            continue
            
        # Ne pas toucher aux listes dans le frontmatter
        if i == 0 and line.strip() == '---':
            in_frontmatter = True
            cleaned.append(line)
            continue
        elif in_frontmatter and line.strip() == '---':
            in_frontmatter = False
            cleaned.append(line)
            continue
            
        if not in_code_block and not in_frontmatter:
            if is_list_item(line):
                if cleaned:
                    prev_line = cleaned[-1]
                    # Si la ligne précédente n'est pas vide et n'est pas déjà un élément de liste, on ajoute une ligne vide
                    if prev_line.strip() != '' and not is_list_item(prev_line):
                        cleaned.append('')
                        
        cleaned.append(line)
        
    return '\n'.join(cleaned)

def format_table(lines: list) -> list:
    """Formate un tableau markdown avec un espacement approprié et alignement propre"""
    parsed_rows = []
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('|'):
            stripped = stripped[1:]
        if stripped.endswith('|'):
            stripped = stripped[:-1]
        cells = [c.strip() for c in stripped.split('|')]
        parsed_rows.append(cells)
    
    if len(parsed_rows) < 2:
        return lines
        
    num_cols = max(len(row) for row in parsed_rows)
    for row in parsed_rows:
        while len(row) < num_cols:
            row.append("")
            
    sep_row = parsed_rows[1]
    is_sep = all(all(char in '-: ' for char in cell) for cell in sep_row if cell)
    if not is_sep:
        return lines
        
    alignments = []
    for cell in sep_row:
        left = cell.startswith(':')
        right = cell.endswith(':')
        if left and right:
            alignments.append('center')
        elif left:
            alignments.append('left')
        elif right:
            alignments.append('right')
        else:
            alignments.append('left')
    while len(alignments) < num_cols:
        alignments.append('left')
        
    col_widths = [0] * num_cols
    for r_idx, row in enumerate(parsed_rows):
        if r_idx == 1:
            continue
        for j, cell in enumerate(row):
            col_widths[j] = max(col_widths[j], len(cell))
            
    for j in range(num_cols):
        col_widths[j] = max(col_widths[j], 3)
        
    formatted_lines = []
    for r_idx, row in enumerate(parsed_rows):
        if r_idx == 1:
            formatted_cells = []
            for j in range(num_cols):
                w = col_widths[j]
                align = alignments[j]
                if align == 'center':
                    cell_str = ':' + '-' * (w - 2) + ':'
                elif align == 'left':
                    cell_str = ':' + '-' * (w - 1)
                elif align == 'right':
                    cell_str = '-' * (w - 1) + ':'
                else:
                    cell_str = '-' * w
                formatted_cells.append(cell_str)
        else:
            formatted_cells = []
            for j in range(num_cols):
                cell = row[j]
                w = col_widths[j]
                align = alignments[j]
                if align == 'center':
                    cell_str = cell.center(w)
                elif align == 'right':
                    cell_str = cell.rjust(w)
                else:
                    cell_str = cell.ljust(w)
                formatted_cells.append(cell_str)
                
        formatted_line = "| " + " | ".join(formatted_cells) + " |"
        formatted_lines.append(formatted_line)
        
    return formatted_lines

def format_tables_in_content(content: str) -> str:
    """Détecte et formate tous les tableaux markdown du document"""
    lines = content.split('\n')
    output = []
    
    i = 0
    n = len(lines)
    while i < n:
        line = lines[i]
        if line.strip().startswith('|') and '|' in line:
            table_lines = []
            while i < n and lines[i].strip().startswith('|') and '|' in lines[i]:
                table_lines.append(lines[i])
                i += 1
            formatted = format_table(table_lines)
            output.extend(formatted)
        else:
            output.append(line)
            i += 1
            
    return '\n'.join(output)

def clean_empty_lines_and_whitespace(content: str) -> str:
    """Nettoie les espaces de fin de ligne et réduit les lignes vides consécutives"""
    lines = content.split('\n')
    cleaned_lines = []
    
    in_frontmatter = False
    
    for i, line in enumerate(lines):
        line = line.rstrip()
        
        if i == 0 and line == '---':
            in_frontmatter = True
        elif in_frontmatter and line == '---':
            in_frontmatter = False
            
        cleaned_lines.append(line)
        
    collapsed = []
    in_frontmatter = False
    for i, line in enumerate(cleaned_lines):
        if i == 0 and line == '---':
            in_frontmatter = True
        elif in_frontmatter and line == '---':
            in_frontmatter = False
            
        if not in_frontmatter:
            # Réduit les lignes vides consécutives à une seule
            if line == '' and collapsed and collapsed[-1] == '':
                continue
        collapsed.append(line)
        
    # S'assurer d'une seule ligne vide à la fin du fichier
    while len(collapsed) > 1 and collapsed[-1] == '' and collapsed[-2] == '':
        collapsed.pop()
        
    return '\n'.join(collapsed)

def process_quarto_content(content: str, add_comments: bool = True) -> str:
    print("\n  [LINT] Étape 1: Analyse structurelle de l'imbrication des blocs et divs...")
    content = process_quarto_nesting(content, add_comments=add_comments)
    
    print("  [LINT] Étape 2: Re-numérotation hiérarchique des titres...")
    content = renumber_titles(content)
    
    print("  [LINT] Étape 3: Nettoyage de l'emphase des titres...")
    content = clean_titles(content)
    
    print("  [LINT] Étape 4: Suppression des séparateurs '---' juste au-dessus des titres...")
    content = remove_hr_above_titles(content)
    
    print("  [LINT] Étape 5: Formatage et alignement des tableaux Markdown...")
    content = format_tables_in_content(content)
    
    print("  [LINT] Étape 6: Re-numérotation séquentielle des listes ordonnées...")
    content = renumber_lists(content)
    
    print("  [LINT] Étape 7: Ajout de lignes vides au-dessus des listes...")
    content = add_empty_line_above_lists(content)
    
    print("  [LINT] Étape 8: Nettoyage final des lignes vides et des espaces...")
    content = clean_empty_lines_and_whitespace(content)
    
    print("  [LINT SUCCESS] Traitement du contenu Quarto terminé avec succès.\n")
    return content

def main():
    if len(sys.argv) < 2:
        print("Usage: python format_quarto.py <fichier_ou_dossier> [--no-comments]")
        sys.exit(1)
        
    target = Path(sys.argv[1])
    add_comments = "--no-comments" not in sys.argv
    
    files_to_process = []
    if target.is_file():
        if "_extensions" not in target.parts and ".quarto" not in target.parts:
            files_to_process.append(target)
    elif target.is_dir():
        for p in target.glob('**/*.md'):
            if "_extensions" not in p.parts and ".quarto" not in p.parts:
                files_to_process.append(p)
        for p in target.glob('**/*.qmd'):
            if "_extensions" not in p.parts and ".quarto" not in p.parts:
                files_to_process.append(p)
        
    for file_path in files_to_process:
        print(f"Formatage de : {file_path}")
        original_content = file_path.read_text(encoding='utf-8')
        new_content = process_quarto_content(original_content, add_comments=add_comments)
        
        if original_content != new_content:
            file_path.write_text(new_content, encoding='utf-8')
            print("  -> Fichier mis à jour.")
        else:
            print("  -> Déjà formaté.")

if __name__ == "__main__":
    main()