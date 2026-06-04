import os
import sys
import re
import shutil
import subprocess
import platform
import urllib.request
import zipfile
import gzip
import tempfile
from pathlib import Path

# ==============================================================================
# 1. BOOTSTRAPING & VIRTUAL ENVIRONMENT
# ==============================================================================

def get_venv_python() -> str:
    """Finds the python executable for the nearest .venv directory."""
    if sys.prefix != sys.base_prefix:
        return sys.executable
        
    current = Path.cwd()
    # Search up to root directory for .venv
    for parent in [current] + list(current.parents):
        venv_py = parent / ".venv" / ("Scripts" if sys.platform == "win32" else "bin") / ("python.exe" if sys.platform == "win32" else "python3")
        if venv_py.exists():
            return str(venv_py)
            
    return sys.executable

def ensure_running_in_venv():
    """If a .venv is found and we are not running inside it, re-run the script using the venv's python."""
    venv_py = get_venv_python()
    if venv_py != sys.executable:
        print(f"  [BOOTSTRAP] Re-running script inside virtual environment: {venv_py}")
        res = subprocess.run([venv_py] + sys.argv)
        sys.exit(res.returncode)

def ensure_dependencies():
    """Ensure that required python packages are installed in the current environment."""
    required_packages = {
        'jsbeautifier': 'jsbeautifier',
        'ruff': 'ruff',
        'clang_format': 'clang-format',
        'yamlfix': 'yamlfix'
    }
    missing = []
    for import_name, pkg_name in required_packages.items():
        try:
            __import__(import_name)
        except ImportError:
            missing.append(pkg_name)
            
    if missing:
        print(f"  [BOOTSTRAP] Missing formatting packages in .venv: {', '.join(missing)}")
        print("  [BOOTSTRAP] Installing them into the current virtual environment...")
        try:
            subprocess.run([sys.executable, "-m", "pip", "install", *missing], check=True)
            print("  [BOOTSTRAP] Installation successful!")
        except Exception as e:
            print(f"  [BOOTSTRAP] WARNING: Failed to install dependencies: {e}")

# ==============================================================================
# 2. LOCAL BINARY DOWNLOADER & CACHE
# ==============================================================================

def get_bin_dir() -> Path:
    """Returns the local project binary cache directory."""
    py_bin_dir = Path(sys.executable).parent
    if sys.prefix == sys.base_prefix:
        local_bin = Path(__file__).parent.parent / ".bin"
        local_bin.mkdir(exist_ok=True)
        return local_bin
    return py_bin_dir

def download_binary(tool_name: str) -> str:
    """Downloads a precompiled binary for the current platform if not already cached."""
    bin_dir = get_bin_dir()
    ext = ".exe" if sys.platform == "win32" else ""
    local_path = bin_dir / f"{tool_name}{ext}"
    
    if local_path.exists():
        return str(local_path)
        
    print(f"  [DOWNLOAD] Downloading {tool_name} precompiled binary for your system...")
    
    os_name = platform.system().lower()
    machine = platform.machine().lower()
    
    is_arm = "arm" in machine or "aarch" in machine
    is_64 = "64" in machine or "amd64" in machine
    
    url = ""
    
    # --- STYLUA ---
    if tool_name == "stylua":
        version = "0.20.0"
        plat_str = ""
        if os_name == "linux":
            plat_str = "linux-x86_64" if not is_arm else "linux-aarch64"
        elif os_name == "darwin":
            plat_str = "macos-x86_64" if not is_arm else "macos-aarch64"
        elif os_name == "windows":
            plat_str = "win64" if is_64 else "win32"
            
        if plat_str:
            url = f"https://github.com/JohnnyMorganz/StyLua/releases/download/v{version}/stylua-{plat_str}.zip"
            
    # --- SHFMT ---
    elif tool_name == "shfmt":
        version = "3.8.0"
        plat_str = ""
        arch_str = "amd64" if not is_arm else "arm64"
        if os_name == "linux":
            plat_str = f"linux_{arch_str}"
        elif os_name == "darwin":
            plat_str = f"darwin_{arch_str}"
        elif os_name == "windows":
            plat_str = f"windows_{arch_str}.exe"
            
        if plat_str:
            url = f"https://github.com/mvdan/sh/releases/download/v{version}/shfmt_v{version}_{plat_str}"
            
    # --- TAPLO ---
    elif tool_name == "taplo":
        version = "0.8.1"
        arch_str = "x86_64" if not is_arm else "aarch64"
        if os_name == "linux":
            url = f"https://github.com/tamasfe/taplo/releases/download/{version}/taplo-linux-{arch_str}.gz"
        elif os_name == "darwin":
            url = f"https://github.com/tamasfe/taplo/releases/download/{version}/taplo-darwin-{arch_str}.gz"
        elif os_name == "windows":
            url = f"https://github.com/tamasfe/taplo/releases/download/{version}/taplo-windows-{arch_str}.zip"

    if not url:
        print(f"  [DOWNLOAD] No precompiled binary configuration found for {tool_name} on platform {os_name}/{machine}.")
        return ""
        
    try:
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)
            archive_path = temp_path / f"archive{Path(url).suffix}"
            
            print(f"    Fetching {url} ...")
            req = urllib.request.Request(
                url, 
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
            )
            with urllib.request.urlopen(req) as response:
                with open(archive_path, 'wb') as f_out:
                    shutil.copyfileobj(response, f_out)
            
            if url.endswith(".zip"):
                with zipfile.ZipFile(archive_path, 'r') as zip_ref:
                    zip_ref.extractall(temp_path)
                binary_files = list(temp_path.glob(f"**/{tool_name}{ext}"))
                if binary_files:
                    shutil.copy2(binary_files[0], local_path)
            elif url.endswith(".gz"):
                with gzip.open(archive_path, 'rb') as f_in:
                    with open(local_path, 'wb') as f_out:
                        shutil.copyfileobj(f_in, f_out)
            else:
                shutil.copy2(archive_path, local_path)
                
            if local_path.exists():
                if os_name != "windows":
                    os.chmod(local_path, 0o755)
                print(f"  [DOWNLOAD] Success! Cached {tool_name} binary at {local_path}")
                return str(local_path)
                
    except Exception as e:
        print(f"  [DOWNLOAD] ERROR: Failed to download {tool_name}: {e}")
        
    return ""

# ==============================================================================
# 3. ROUTED CODE FORMATTING LOGIC
# ==============================================================================

def format_via_temp_file(cmd_list: list, code: str, suffix: str) -> str:
    """Writes code to a temp file, runs the command list, reads it back, and cleans up."""
    with tempfile.NamedTemporaryFile(suffix=suffix, mode='w+', delete=False, encoding='utf-8') as f:
        f.write(code)
        f.flush()
        temp_path = f.name
        
    try:
        actual_cmd = [c.replace('{file}', temp_path) if isinstance(c, str) else c for c in cmd_list]
        subprocess.run(actual_cmd, capture_output=True, check=True)
        with open(temp_path, 'r', encoding='utf-8') as f_read:
            return f_read.read()
    except Exception as e:
        return code
    finally:
        try:
            os.unlink(temp_path)
        except Exception:
            pass

def format_code_block(code: str, lang: str) -> str:
    """Formats raw code block contents using cached libraries or binaries."""
    lang = lang.lower().strip()
    ext = ".exe" if sys.platform == "win32" else ""
    py_bin_dir = Path(sys.executable).parent
    
    # 1. PYTHON
    if lang in ('python', 'py'):
        ruff_bin = py_bin_dir / f"ruff{ext}"
        ruff_cmd = str(ruff_bin) if ruff_bin.exists() else "ruff"
        try:
            res = subprocess.run([ruff_cmd, "format", "-"], input=code, text=True, capture_output=True, check=True)
            return res.stdout
        except Exception:
            pass
            
    # 2. JS / TS / HTML / CSS / SCSS / JSON
    elif lang in ('javascript', 'js', 'typescript', 'ts', 'json', 'html', 'css', 'scss'):
        try:
            import jsbeautifier
            opts = jsbeautifier.default_options()
            opts.indent_size = 2
            
            if lang in ('html',):
                return jsbeautifier.beautify_html(code, opts)
            elif lang in ('css', 'scss'):
                return jsbeautifier.beautify_css(code, opts)
            else:
                return jsbeautifier.beautify(code, opts)
        except Exception as e:
            print(f"    [FORMAT ERROR] jsbeautifier error: {e}")
            
    # 3. C / C++ / JAVA
    elif lang in ('c', 'cpp', 'java'):
        cf_bin = py_bin_dir / f"clang-format{ext}"
        cf_cmd = str(cf_bin) if cf_bin.exists() else "clang-format"
        try:
            filename = f"main.{lang}"
            res = subprocess.run([cf_cmd, f"-assume-filename={filename}"], input=code, text=True, capture_output=True, check=True)
            return res.stdout
        except Exception:
            pass

    # 4. XML
    elif lang in ('xml',):
        try:
            import xml.dom.minidom
            dom = xml.dom.minidom.parseString(code)
            formatted = dom.toprettyxml(indent="  ")
            lines = [line for line in formatted.split('\n') if line.strip() != '']
            return '\n'.join(lines)
        except Exception:
            pass

    # 5. YAML
    elif lang in ('yaml', 'yml'):
        yf_bin = py_bin_dir / f"yamlfix{ext}"
        yf_cmd = str(yf_bin) if yf_bin.exists() else "yamlfix"
        try:
            return format_via_temp_file([yf_cmd, '{file}'], code, '.yaml')
        except Exception:
            if shutil.which('npx'):
                try:
                    res = subprocess.run(['npx', 'prettier', '--parser', 'yaml'], input=code, text=True, capture_output=True, check=True)
                    return res.stdout
                except Exception:
                    pass

    # 6. LUA
    elif lang in ('lua',):
        stylua_bin = download_binary("stylua")
        if stylua_bin:
            try:
                res = subprocess.run([stylua_bin, "-"], input=code, text=True, capture_output=True, check=True)
                return res.stdout
            except Exception:
                pass
                
    # 7. BASH / SHELL
    elif lang in ('bash', 'sh'):
        shfmt_bin = download_binary("shfmt")
        if shfmt_bin:
            try:
                res = subprocess.run([shfmt_bin, "-i", "2", "-"], input=code, text=True, capture_output=True, check=True)
                return res.stdout
            except Exception:
                pass
                
    # 8. TOML
    elif lang in ('toml',):
        taplo_bin = download_binary("taplo")
        if taplo_bin:
            try:
                res = subprocess.run([taplo_bin, "format", "-"], input=code, text=True, capture_output=True, check=True)
                return res.stdout
            except Exception:
                pass

    # 9. R
    elif lang in ('r',):
        if shutil.which('Rscript'):
            try:
                r_code = f"styler::style_text(readLines(con='stdin'))"
                res = subprocess.run(['Rscript', '-e', r_code], input=code, text=True, capture_output=True, check=True)
                return res.stdout
            except Exception:
                pass

    # 10. PHP
    elif lang in ('php',):
        if shutil.which('php-cs-fixer'):
            try:
                return format_via_temp_file(['php-cs-fixer', 'fix', '{file}'], code, '.php')
            except Exception:
                pass

    return code

# ==============================================================================
# 4. MARKDOWN EXTRACTION & PROCESSING
# ==============================================================================

def process_code_blocks(content: str) -> str:
    """Extracts, formats, and re-injects code blocks preserving base indentation."""
    lines = content.split('\n')
    output_lines = []
    stack = []
    current_code_lines = []
    
    re_code = re.compile(r'^(\s*)(`{3,})\s*(.*)$')
    
    def extract_code_lang(meta_str):
        clean = re.sub(r'<!--.*?-->', '', meta_str).strip()
        clean = re.sub(r'[{}]', '', clean).strip()
        if clean.startswith('.'):
            clean = clean[1:]
        return clean.split()[0] if clean else "code"
        
    for line_idx, line in enumerate(lines, start=1):
        code_match = re_code.match(line)
        in_code_block = len(stack) > 0 and stack[-1]['type'] == 'code'
        
        if code_match:
            indent, marker, meta = code_match.groups()
            meta_clean = re.sub(r'<!--.*?-->', '', meta).strip()
            
            if in_code_block:
                popped = stack.pop()
                close_marker = "```"
                
                lang = popped['class']
                raw_code = '\n'.join(current_code_lines)
                
                # Format the block
                formatted_code = format_code_block(raw_code, lang)
                
                # Re-apply indentation
                for f_line in formatted_code.split('\n'):
                    if f_line.strip() == '':
                        output_lines.append('')
                    else:
                        output_lines.append(f"{popped['indent']}{f_line}")
                        
                current_code_lines = []
                output_lines.append(f"{indent}{close_marker}")
            else:
                lang = extract_code_lang(meta_clean)
                stack.append({
                    'type': 'code', 
                    'class': lang, 
                    'marker': marker, 
                    'line': line_idx, 
                    'indent': indent
                })
                output_lines.append(line)
                current_code_lines = []
        elif in_code_block:
            block_indent = stack[-1]['indent']
            if line.startswith(block_indent):
                current_code_lines.append(line[len(block_indent):])
            else:
                current_code_lines.append(line)
        else:
            output_lines.append(line)
            
    if stack:
        for popped in reversed(stack):
            if popped['type'] == 'code':
                raw_code = '\n'.join(current_code_lines)
                for f_line in raw_code.split('\n'):
                    output_lines.append(f"{popped['indent']}{f_line}")
                output_lines.append(f"{popped['indent']}```")
        stack.clear()
        
    return '\n'.join(output_lines)

# ==============================================================================
# 5. ENTRYPOINT MAIN
# ==============================================================================

def main():
    ensure_running_in_venv()
    ensure_dependencies()
    
    if len(sys.argv) < 2:
        print("Usage: python code-lint.py <fichier_ou_dossier>")
        sys.exit(1)
        
    target = Path(sys.argv[1])
    
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
        print(f"Formatage des blocs de code de : {file_path}")
        original_content = file_path.read_text(encoding='utf-8')
        new_content = process_code_blocks(original_content)
        
        if original_content != new_content:
            file_path.write_text(new_content, encoding='utf-8')
            print("  -> Blocs de code mis à jour.")
        else:
            print("  -> Blocs de code déjà formatés.")

if __name__ == "__main__":
    main()
