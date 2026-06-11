#!/bin/bash
set -e

# Use QUARTO_PROJECT_DIR if set, otherwise use current directory
if [ -n "$QUARTO_PROJECT_DIR" ]; then
  BASE_DIR="$QUARTO_PROJECT_DIR"
else
  BASE_DIR="."
fi

FONT_DIR="$BASE_DIR/assets/fonts"
mkdir -p "$FONT_DIR"

download_font() {
  local filename="$1"
  local url="$2"
  local dest="$FONT_DIR/$filename"
  if [ ! -f "$dest" ]; then
    echo "Downloading $filename..."
    curl -L -s -o "$dest" "$url"
  else
    echo "$filename already exists."
  fi
}

# 1. Recursive (from zip)
RECURSIVE_FILE="$FONT_DIR/Recursive_VF_1.085.ttf"
if [ ! -f "$RECURSIVE_FILE" ]; then
  echo "Downloading Recursive font..."
  curl -L -s -o recursive.zip "https://github.com/arrowtype/recursive/releases/download/v1.085/ArrowType-Recursive-1.085.zip"
  unzip -q -j -o recursive.zip "ArrowType-Recursive-1.085/Recursive_Desktop/Recursive_VF_1.085.ttf" -d "$FONT_DIR/"
  rm recursive.zip
  
  if [ -d "$HOME/.local/share/fonts" ] || [ "$(uname)" = "Linux" ]; then
    mkdir -p "$HOME/.local/share/fonts/recursive"
    cp "$RECURSIVE_FILE" "$HOME/.local/share/fonts/recursive/"
    if command -v fc-cache >/dev/null 2>&1; then
      fc-cache -f "$HOME/.local/share/fonts/recursive"
    fi
  fi
fi

# 2. EB Garamond (Sérif)
download_font "EBGaramond.ttf" "https://github.com/google/fonts/raw/main/ofl/ebgaramond/EBGaramond%5Bwght%5D.ttf"

# 3. Inter (Sans-Sérif)
download_font "Inter.ttf" "https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf"

# 4. Arvo (Slab)
download_font "Arvo.ttf" "https://github.com/google/fonts/raw/main/ofl/arvo/Arvo-Regular.ttf"

# 5. Pacifico (Cursive)
download_font "Pacifico.ttf" "https://github.com/google/fonts/raw/main/ofl/pacifico/Pacifico-Regular.ttf"

# 6. Fira Code (Monospace)
download_font "FiraCode.ttf" "https://github.com/google/fonts/raw/main/ofl/firacode/FiraCode%5Bwght%5D.ttf"

# 7. Press Start 2P (Display)
download_font "PressStart2P.ttf" "https://github.com/google/fonts/raw/main/ofl/pressstart2p/PressStart2P-Regular.ttf"

echo "Font download sync complete."
